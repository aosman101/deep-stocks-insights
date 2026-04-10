"""
Predictions Router — /api/predictions
  GET  /{asset}             — model prediction payload
  GET  /{asset}/multi       — 1d / 3d / 7d sequence-model predictions
  GET  /{asset}/workspace   — all available ML models in one schema
  GET  /{asset}/history     — past predictions stored in DB
  GET  /performance/{asset} — model accuracy metrics
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.prediction import Prediction
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.prediction import GeneratePredictionsRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/predictions", tags=["N-HiTS Predictions"])

from app.services.asset_registry import NHITS_FEATURED, TFT_FEATURED


def _validate_sequence_asset(asset: str, model_key: str) -> str:
    asset = asset.upper()
    supported = NHITS_FEATURED if model_key == "nhits" else TFT_FEATURED
    label = "N-HiTS" if model_key == "nhits" else "TFT"
    if asset not in supported:
        raise HTTPException(status_code=400, detail=f"{label} supported assets: {sorted(supported)}")
    return asset


def _validate_asset(asset: str) -> str:
    """Accept any asset symbol (for history/performance which store all prediction types)."""
    asset = asset.upper()
    if not asset:
        raise HTTPException(status_code=400, detail="Asset symbol is required")
    return asset


def _prediction_item_from_row(row: Prediction) -> dict:
    return {
        "id": row.id,
        "asset": row.asset,
        "model_key": row.model_key,
        "prediction_type": row.prediction_type,
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
        "created_at": row.created_at,
        "run_id": row.run_id,
        "trigger_source": row.trigger_source,
        "input_window_end": row.input_window_end,
    }


def _cached_response_from_rows(rows: list[Prediction]) -> dict:
    if not rows:
        raise ValueError("rows must not be empty")

    horizon_rank = {"1d": 0, "3d": 1, "5d": 2, "7d": 3}
    items = [_prediction_item_from_row(row) for row in rows]
    items.sort(key=lambda item: horizon_rank.get(item.get("prediction_horizon"), 99))
    primary = next((item for item in items if item.get("prediction_horizon") == "1d"), items[0])
    source_row = rows[0]
    return {
        "asset": source_row.asset,
        "model_key": source_row.model_key,
        "model_version": source_row.model_version,
        "prediction_type": source_row.prediction_type,
        "status": "ok",
        "current_price": primary.get("current_price"),
        "prediction": primary,
        "predictions": items,
        "predicted_close": primary.get("predicted_close"),
        "predicted_change_pct": primary.get("predicted_change_pct"),
        "signal": primary.get("signal"),
        "confidence": primary.get("confidence"),
        "prediction_horizon": primary.get("prediction_horizon"),
        "run_id": primary.get("run_id"),
        "trigger_source": primary.get("trigger_source"),
        "input_window_end": primary.get("input_window_end"),
        "cache": {
            "source": "stored_prediction",
            "fresh": True,
            "record_ids": [item["id"] for item in items],
        },
        "generated_at": source_row.created_at,
    }


def _pick_requested_prediction(payload: dict, horizon: str) -> dict:
    predictions = payload.get("predictions") or []
    if not predictions:
        return payload
    chosen = next((item for item in predictions if item.get("prediction_horizon") == horizon), predictions[0])
    payload = dict(payload)
    payload["prediction"] = chosen
    payload["predicted_close"] = chosen.get("predicted_close")
    payload["predicted_change_pct"] = chosen.get("predicted_change_pct")
    payload["signal"] = chosen.get("signal")
    payload["confidence"] = chosen.get("confidence")
    payload["prediction_horizon"] = chosen.get("prediction_horizon")
    return payload


@router.get("/{asset}", response_model=dict)
async def predict_asset(
    asset: str,
    horizon: str = Query(default="1d", description="1d | 3d | 7d"),
    model_key: str = Query(default="nhits", description="nhits | tft | lightgbm | ensemble"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Run one prediction model and return the shared model payload.
    Only the default N-HiTS route persists to the historical predictions table.
    """
    model_key = model_key.lower()
    if model_key not in ("nhits", "tft", "lightgbm", "ensemble"):
        raise HTTPException(status_code=400, detail="model_key must be nhits, tft, lightgbm, or ensemble")
    if horizon not in ("1d", "3d", "7d"):
        raise HTTPException(status_code=400, detail="Horizon must be 1d, 3d, or 7d")

    try:
        from app.services.prediction_service import (
            run_ensemble_prediction,
            run_lightgbm_model_prediction,
            run_sequence_prediction,
        )
        from app.services.prediction_record_service import persist_model_response

        if model_key == "lightgbm":
            asset = _validate_asset(asset)
            result = await run_lightgbm_model_prediction(asset)
        elif model_key == "ensemble":
            asset = _validate_asset(asset)
            if horizon != "1d":
                raise HTTPException(status_code=400, detail="Ensemble predictions currently support only horizon=1d")
            result = await run_ensemble_prediction(asset)
        else:
            asset = _validate_sequence_asset(asset, model_key)
            result = await run_sequence_prediction(asset, horizon=horizon, model_key=model_key)

        if result.get("status") != "ok":
            raise HTTPException(status_code=503, detail=result.get("error") or result.get("message"))
        return persist_model_response(
            db,
            result,
            user_id=current_user.id,
            trigger_source="manual",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction failed for {asset}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset}/multi", response_model=dict)
async def multi_horizon_prediction(
    asset: str,
    model_key: str = Query(default="nhits", description="nhits | tft"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return 1d, 3d, and 7d sequence-model predictions simultaneously."""
    from app.services.prediction_record_service import persist_model_response
    model_key = model_key.lower()
    if model_key not in ("nhits", "tft"):
        raise HTTPException(status_code=400, detail="model_key must be nhits or tft")
    asset = _validate_sequence_asset(asset, model_key)
    try:
        from app.services.prediction_service import run_multi_horizon_prediction

        result = await run_multi_horizon_prediction(asset, model_key=model_key)
        if result.get("status") != "ok":
            raise HTTPException(
                status_code=503,
                detail=result.get("error") or result.get("message")
            )
        return persist_model_response(
            db,
            result,
            user_id=current_user.id,
            trigger_source="manual",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset}/workspace", response_model=dict)
async def prediction_workspace(
    asset: str,
    _: User = Depends(get_current_active_user),
):
    """Return all available ML models for an asset in the shared schema."""
    asset = _validate_asset(asset)
    try:
        from app.services.prediction_service import run_prediction_workspace

        return await run_prediction_workspace(asset)
    except Exception as e:
        logger.error(f"Workspace prediction failed for {asset}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate", response_model=dict)
async def generate_predictions(
    payload: GeneratePredictionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate and optionally persist a prediction snapshot across multiple assets/models.
    This gives the website a single action to refresh the model ledger before the agent runs.
    """
    from app.services.prediction_service import (
        run_ensemble_prediction,
        run_lightgbm_model_prediction,
        run_multi_horizon_prediction,
        run_sequence_prediction,
        run_analytics_prediction,
    )
    from app.services.prediction_record_service import persist_analytics_response, persist_model_response

    supported_model_keys = {"ensemble", "nhits", "tft", "lightgbm"}
    requested_models = [model_key.lower() for model_key in payload.model_keys]
    invalid = [model for model in requested_models if model not in supported_model_keys]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unsupported model_keys: {invalid}")

    results = []
    for raw_asset in payload.assets:
        asset = _validate_asset(raw_asset)
        asset_runs = []
        for model_key in requested_models:
            if model_key == "ensemble":
                result = await run_ensemble_prediction(asset)
            elif model_key == "lightgbm":
                result = await run_lightgbm_model_prediction(asset)
            elif model_key == "nhits":
                if asset not in NHITS_FEATURED:
                    continue
                result = await run_multi_horizon_prediction(asset, model_key="nhits")
            elif model_key == "tft":
                if asset not in TFT_FEATURED:
                    continue
                result = await run_multi_horizon_prediction(asset, model_key="tft")
            else:
                continue

            if payload.persist and result.get("status") == "ok":
                result = persist_model_response(db, result, user_id=current_user.id, trigger_source="refresh")
            asset_runs.append(result)

        if payload.include_analytics:
            analytics = await run_analytics_prediction(asset)
            if payload.persist and "error" not in analytics:
                analytics = persist_analytics_response(db, analytics, user_id=current_user.id, trigger_source="refresh")
            asset_runs.append(analytics)

        results.append({"asset": asset, "runs": asset_runs})

    return {
        "generated_at": datetime.utcnow(),
        "persisted": payload.persist,
        "assets": results,
    }


@router.get("/{asset}/history", response_model=list[dict])
def prediction_history(
    asset: str,
    limit: int = Query(default=50, ge=1, le=500),
    prediction_type: str = Query(default="actual"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Return past predictions for the given asset, newest first."""
    asset = _validate_asset(asset)
    rows = (
        db.query(Prediction)
        .filter(
            Prediction.asset == asset,
            Prediction.prediction_type == prediction_type,
        )
        .order_by(Prediction.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "asset": r.asset,
            "model_key": r.model_key,
            "run_id": r.run_id,
            "trigger_source": r.trigger_source,
            "input_window_end": r.input_window_end,
            "predicted_close": r.predicted_close,
            "predicted_change_pct": r.predicted_change_pct,
            "confidence": r.confidence,
            "current_price": r.current_price,
            "prediction_horizon": r.prediction_horizon,
            "signal": r.signal,
            "signal_strength": r.signal_strength,
            "stop_loss": r.stop_loss,
            "take_profit": r.take_profit,
            "was_correct_direction": r.was_correct_direction,
            "abs_error": r.abs_error,
            "actual_close": r.actual_close,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/performance/{asset}", response_model=dict)
def model_performance(
    asset: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Compute live accuracy metrics from stored predictions that have been verified
    (i.e. where actual_close has been filled in by the background job).
    """
    asset = _validate_asset(asset)

    verified = (
        db.query(Prediction)
        .filter(
            Prediction.asset == asset,
            Prediction.actual_close.isnot(None),
        )
        .all()
    )

    if not verified:
        return {
            "asset": asset,
            "message": "No verified predictions yet. Run predictions and wait for the next day's price to be filled in.",
            "total_predictions": 0,
        }

    import numpy as np
    errors = [abs(p.predicted_close - p.actual_close) for p in verified]
    pct_errors = [abs(p.predicted_close - p.actual_close) / p.actual_close * 100 for p in verified]
    correct = sum(1 for p in verified if p.was_correct_direction)

    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean([e**2 for e in errors])))
    mape = float(np.mean(pct_errors))
    da = float(correct / len(verified) * 100)

    by_model = {}
    for model_key in sorted({(p.model_key or "nhits") for p in verified}):
        model_rows = [p for p in verified if (p.model_key or "nhits") == model_key]
        model_errors = [abs(p.predicted_close - p.actual_close) for p in model_rows]
        model_pct_errors = [abs(p.predicted_close - p.actual_close) / p.actual_close * 100 for p in model_rows]
        model_correct = sum(1 for p in model_rows if p.was_correct_direction)
        by_model[model_key] = {
            "total_predictions": len(model_rows),
            "mae": round(float(np.mean(model_errors)), 4),
            "rmse": round(float(np.sqrt(np.mean([e**2 for e in model_errors]))), 4),
            "mape": round(float(np.mean(model_pct_errors)), 4),
            "directional_accuracy": round(float(model_correct / len(model_rows) * 100), 2),
        }

    return {
        "asset": asset,
        "total_predictions": len(verified),
        "correct_directions": correct,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4),
        "directional_accuracy": round(da, 2),
        "by_model": by_model,
        "computed_at": datetime.utcnow(),
    }
