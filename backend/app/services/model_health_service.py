"""
Persistent model health snapshots derived from verified prediction history and
walk-forward benchmark payloads.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Iterable, Optional

import numpy as np
from sqlalchemy.orm import Session

from app.models.prediction import ModelMetrics, Prediction


def _upsert_metric_row(
    db: Session,
    *,
    asset: str,
    model_key: str,
    period: str,
    source: str,
    model_version: Optional[str] = None,
    notes: Optional[str] = None,
    metrics: Dict,
) -> ModelMetrics:
    row = (
        db.query(ModelMetrics)
        .filter(
            ModelMetrics.asset == asset,
            ModelMetrics.model_key == model_key,
            ModelMetrics.period == period,
            ModelMetrics.source == source,
        )
        .first()
    )
    if row is None:
        row = ModelMetrics(asset=asset, model_key=model_key, period=period, source=source)
        db.add(row)

    row.model_version = model_version
    row.notes = notes
    row.mae = metrics.get("mae")
    row.rmse = metrics.get("rmse")
    row.mape = metrics.get("mape")
    row.r2_score = metrics.get("r2_score")
    row.directional_accuracy = metrics.get("directional_accuracy")
    row.sharpe_ratio = metrics.get("sharpe_ratio")
    row.annualised_return = metrics.get("annualised_return")
    row.max_drawdown = metrics.get("max_drawdown")
    row.total_predictions = metrics.get("total_predictions", 0)
    row.correct_directions = metrics.get("correct_directions", 0)
    row.computed_at = datetime.utcnow()
    db.flush()
    return row


def refresh_prediction_history_metrics(
    db: Session,
    *,
    asset: Optional[str] = None,
    days: int = 30,
) -> list[ModelMetrics]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    query = db.query(Prediction).filter(
        Prediction.actual_close.isnot(None),
        Prediction.predicted_close.isnot(None),
        Prediction.created_at >= cutoff,
    )
    if asset:
        query = query.filter(Prediction.asset == asset.upper())

    rows = query.order_by(Prediction.asset.asc(), Prediction.model_key.asc(), Prediction.created_at.desc()).all()
    grouped: Dict[tuple[str, str], list[Prediction]] = {}
    for row in rows:
        grouped.setdefault((row.asset, row.model_key or "nhits"), []).append(row)

    snapshots: list[ModelMetrics] = []
    for (group_asset, model_key), preds in grouped.items():
        predicted = np.array([float(p.predicted_close) for p in preds], dtype=float)
        actual = np.array([float(p.actual_close) for p in preds], dtype=float)
        abs_errors = np.abs(predicted - actual)
        squared_errors = (predicted - actual) ** 2
        correct_directions = int(sum(1 for p in preds if p.was_correct_direction))
        directional_accuracy = float(correct_directions / len(preds) * 100) if preds else None

        latest_version = next((p.model_version for p in preds if p.model_version), None)
        metrics = {
            "mae": round(float(np.mean(abs_errors)), 4),
            "rmse": round(float(np.sqrt(np.mean(squared_errors))), 4),
            "mape": round(float(np.mean(abs_errors / np.maximum(np.abs(actual), 1e-8)) * 100), 4),
            "directional_accuracy": round(directional_accuracy, 2) if directional_accuracy is not None else None,
            "total_predictions": len(preds),
            "correct_directions": correct_directions,
        }
        snapshot = _upsert_metric_row(
            db,
            asset=group_asset,
            model_key=model_key,
            period=f"{days}d",
            source="prediction_history",
            model_version=latest_version,
            notes="Rolling metrics computed from verified stored predictions.",
            metrics=metrics,
        )
        snapshots.append(snapshot)

    db.commit()
    return snapshots


def persist_walk_forward_metrics(db: Session, asset: str, period: str, payload: Dict) -> list[ModelMetrics]:
    methods = payload.get("methods", {})
    stored: list[ModelMetrics] = []
    for key, method in methods.items():
        if method.get("status") != "ok":
            continue
        stored.append(
            _upsert_metric_row(
                db,
                asset=asset.upper(),
                model_key=key,
                period=period,
                source="walk_forward",
                model_version=None,
                notes=method.get("method"),
                metrics={
                    "mae": method.get("mae"),
                    "rmse": method.get("rmse"),
                    "mape": method.get("mape"),
                    "directional_accuracy": method.get("directional_accuracy"),
                    "total_predictions": method.get("total_predictions", 0),
                    "correct_directions": method.get("correct_directions", 0),
                },
            )
        )
    db.commit()
    return stored


def latest_model_health(
    db: Session,
    *,
    asset: Optional[str] = None,
    source: Optional[str] = None,
) -> list[ModelMetrics]:
    query = db.query(ModelMetrics)
    if asset:
        query = query.filter(ModelMetrics.asset == asset.upper())
    if source:
        query = query.filter(ModelMetrics.source == source)
    return query.order_by(ModelMetrics.computed_at.desc(), ModelMetrics.asset.asc(), ModelMetrics.model_key.asc()).all()
