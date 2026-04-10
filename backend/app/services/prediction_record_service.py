"""
Prediction record persistence and lookup helpers.

These functions turn model responses into durable audit records so the agent and
analytics layers can reason over stored predictions instead of recomputing them.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.prediction import Prediction

PREFERRED_AGENT_MODEL_ORDER = ("ensemble", "nhits", "tft", "lightgbm", "analytics")


def new_prediction_run_id(prefix: str = "pred") -> str:
    return f"{prefix}_{uuid4().hex[:20]}"


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _record_to_dict(row: Prediction) -> Dict[str, Any]:
    return {
        "id": row.id,
        "asset": row.asset,
        "prediction_type": row.prediction_type,
        "model_key": row.model_key,
        "run_id": row.run_id,
        "trigger_source": row.trigger_source,
        "input_window_end": row.input_window_end,
        "predicted_close": row.predicted_close,
        "predicted_open": row.predicted_open,
        "predicted_volume": row.predicted_volume,
        "predicted_change_pct": row.predicted_change_pct,
        "confidence": row.confidence,
        "current_price": row.current_price,
        "prediction_horizon": row.prediction_horizon,
        "signal": row.signal,
        "signal_strength": row.signal_strength,
        "stop_loss": row.stop_loss,
        "take_profit": row.take_profit,
        "risk_reward_ratio": row.risk_reward_ratio,
        "model_version": row.model_version,
        "mae_at_time": row.mae_at_time,
        "notes": row.notes,
        "created_by_user_id": row.created_by_user_id,
        "created_at": row.created_at,
        "actual_close": row.actual_close,
        "verified_at": row.verified_at,
        "was_correct_direction": row.was_correct_direction,
        "abs_error": row.abs_error,
    }


def _prediction_items(response: Dict[str, Any]) -> list[Dict[str, Any]]:
    items = response.get("predictions") or []
    if items:
        return list(items)
    if response.get("prediction"):
        return [response["prediction"]]
    return []


def persist_model_response(
    db: Session,
    response: Dict[str, Any],
    *,
    user_id: Optional[int] = None,
    trigger_source: str = "manual",
    run_id: Optional[str] = None,
    input_window_end: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Persist a shared model response payload from prediction_service.
    Returns the original payload augmented with record ids and run metadata.
    """
    if response.get("status") != "ok":
        return response

    items = _prediction_items(response)
    if not items:
        return response

    run_id = run_id or response.get("run_id") or new_prediction_run_id()
    model_key = (response.get("model_key") or "nhits").lower()
    prediction_type = response.get("prediction_type", "actual")
    generated_at = _coerce_datetime(response.get("generated_at"))
    input_window_end = input_window_end or _coerce_datetime(response.get("input_window_end")) or generated_at
    standard_risk = (response.get("risk") or {}).get("standard", {})

    persisted_rows: list[Prediction] = []
    for item in items:
        row = Prediction(
            asset=(item.get("asset") or response.get("asset") or "").upper(),
            prediction_type=prediction_type,
            model_key=model_key,
            run_id=run_id,
            trigger_source=trigger_source,
            input_window_end=input_window_end,
            predicted_close=item["predicted_close"],
            predicted_open=item.get("predicted_open"),
            predicted_volume=item.get("predicted_volume"),
            predicted_change_pct=item.get("predicted_change_pct"),
            confidence=item.get("confidence"),
            current_price=item.get("current_price") or response.get("current_price"),
            prediction_horizon=item.get("prediction_horizon") or item.get("horizon") or "1d",
            signal=item.get("signal"),
            signal_strength=item.get("signal_strength"),
            stop_loss=standard_risk.get("stop_loss"),
            take_profit=standard_risk.get("take_profit"),
            risk_reward_ratio=standard_risk.get("risk_reward_ratio"),
            model_version=item.get("model_version") or response.get("model_version"),
            mae_at_time=item.get("mae_at_time") or response.get("mae_at_time"),
            notes=item.get("notes") or response.get("notes"),
            created_by_user_id=user_id,
        )
        db.add(row)
        db.flush()
        item["id"] = row.id
        item["run_id"] = run_id
        item["model_key"] = model_key
        item["trigger_source"] = trigger_source
        item["input_window_end"] = input_window_end
        persisted_rows.append(row)

    db.commit()
    for row in persisted_rows:
        db.refresh(row)

    primary = response.get("prediction")
    if primary is not None:
        matching = next(
            (
                row for row in persisted_rows
                if row.prediction_horizon == (primary.get("prediction_horizon") or primary.get("horizon") or "1d")
            ),
            persisted_rows[0],
        )
        primary["id"] = matching.id
        primary["run_id"] = run_id

    response["run_id"] = run_id
    response["trigger_source"] = trigger_source
    response["input_window_end"] = input_window_end
    response["prediction_records"] = [_record_to_dict(row) for row in persisted_rows]
    response["prediction_record_ids"] = [row.id for row in persisted_rows]
    return response


def persist_analytics_response(
    db: Session,
    payload: Dict[str, Any],
    *,
    user_id: Optional[int] = None,
    trigger_source: str = "manual",
    run_id: Optional[str] = None,
    input_window_end: Optional[datetime] = None,
) -> Dict[str, Any]:
    run_id = run_id or payload.get("run_id") or new_prediction_run_id("analytics")
    input_window_end = input_window_end or _coerce_datetime(payload.get("generated_at"))
    row = Prediction(
        asset=payload["asset"].upper(),
        prediction_type="estimated",
        model_key="analytics",
        run_id=run_id,
        trigger_source=trigger_source,
        input_window_end=input_window_end,
        predicted_close=payload["ensemble_forecast"],
        predicted_change_pct=payload.get("ensemble_change_pct"),
        confidence=payload.get("ensemble_confidence"),
        current_price=payload.get("current_price"),
        prediction_horizon="5d",
        signal=payload.get("ensemble_signal"),
        stop_loss=payload.get("stop_loss"),
        take_profit=payload.get("take_profit"),
        notes="Ensemble statistical estimate (SMA + EMA + LoBF + Holt's).",
        created_by_user_id=user_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    payload["id"] = row.id
    payload["run_id"] = run_id
    payload["model_key"] = "analytics"
    payload["trigger_source"] = trigger_source
    payload["input_window_end"] = input_window_end
    return payload


def latest_prediction_for_agent(
    db: Session,
    asset: str,
    *,
    horizon: str = "1d",
    max_age_hours: int = 48,
    preferred_models: Iterable[str] = PREFERRED_AGENT_MODEL_ORDER,
) -> Optional[Prediction]:
    cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
    rows = (
        db.query(Prediction)
        .filter(
            Prediction.asset == asset.upper(),
            Prediction.prediction_horizon == horizon,
            Prediction.created_at >= cutoff,
            Prediction.signal.isnot(None),
        )
        .order_by(Prediction.created_at.desc())
        .limit(200)
        .all()
    )
    if not rows:
        return None

    latest_by_model: Dict[str, Prediction] = {}
    for row in rows:
        key = (row.model_key or "nhits").lower()
        latest_by_model.setdefault(key, row)

    for model_key in preferred_models:
        chosen = latest_by_model.get(model_key)
        if chosen is not None:
            return chosen

    return rows[0]


def latest_prediction_row(
    db: Session,
    asset: str,
    *,
    model_key: Optional[str] = None,
    prediction_type: Optional[str] = None,
    horizon: Optional[str] = None,
    max_age_minutes: Optional[int] = None,
) -> Optional[Prediction]:
    query = db.query(Prediction).filter(Prediction.asset == asset.upper())
    if model_key:
        query = query.filter(Prediction.model_key == model_key.lower())
    if prediction_type:
        query = query.filter(Prediction.prediction_type == prediction_type)
    if horizon:
        query = query.filter(Prediction.prediction_horizon == horizon)
    if max_age_minutes is not None:
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        query = query.filter(Prediction.created_at >= cutoff)
    return query.order_by(Prediction.created_at.desc()).first()


def latest_prediction_run(
    db: Session,
    asset: str,
    *,
    model_key: str,
    prediction_type: str = "actual",
    max_age_minutes: Optional[int] = None,
) -> list[Prediction]:
    latest = latest_prediction_row(
        db,
        asset,
        model_key=model_key,
        prediction_type=prediction_type,
        max_age_minutes=max_age_minutes,
    )
    if latest is None:
        return []

    if not latest.run_id:
        return [latest]

    return (
        db.query(Prediction)
        .filter(
            Prediction.asset == asset.upper(),
            Prediction.model_key == model_key.lower(),
            Prediction.prediction_type == prediction_type,
            Prediction.run_id == latest.run_id,
        )
        .order_by(Prediction.created_at.desc(), Prediction.prediction_horizon.asc())
        .all()
    )


def latest_prediction_snapshot(
    db: Session,
    asset: str,
    *,
    horizon: str = "1d",
    max_age_hours: int = 48,
    preferred_models: Iterable[str] = PREFERRED_AGENT_MODEL_ORDER,
) -> Optional[Dict[str, Any]]:
    row = latest_prediction_for_agent(
        db,
        asset,
        horizon=horizon,
        max_age_hours=max_age_hours,
        preferred_models=preferred_models,
    )
    if row is None:
        return None
    return _record_to_dict(row)
