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

from app.database import get_db
from app.models.prediction import Prediction
from app.core.dependencies import get_current_active_user
from app.models.user import User

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


@router.get("/{asset}", response_model=dict)
async def predict_asset(
    asset: str,
    horizon: str = Query(default="1d", description="1d | 3d | 7d"),
    model_key: str = Query(default="nhits", description="nhits | tft | lightgbm"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Run one prediction model and return the shared model payload.
    Only the default N-HiTS route persists to the historical predictions table.
    """
    model_key = model_key.lower()
    if model_key not in ("nhits", "tft", "lightgbm"):
        raise HTTPException(status_code=400, detail="model_key must be nhits, tft, or lightgbm")
    if horizon not in ("1d", "3d", "7d"):
        raise HTTPException(status_code=400, detail="Horizon must be 1d, 3d, or 7d")

    try:
        from app.services.prediction_service import (
            run_lightgbm_model_prediction,
            run_sequence_prediction,
        )

        if model_key == "lightgbm":
            asset = _validate_asset(asset)
            result = await run_lightgbm_model_prediction(asset)
        else:
            asset = _validate_sequence_asset(asset, model_key)
            result = await run_sequence_prediction(asset, horizon=horizon, model_key=model_key)

        if result.get("status") != "ok":
            raise HTTPException(status_code=503, detail=result.get("error") or result.get("message"))

        if model_key == "nhits":
            pred = result.get("prediction") or {}
            risk_standard = (result.get("risk") or {}).get("standard", {})
            pred_row = Prediction(
                asset=asset,
                prediction_type="actual",
                predicted_close=pred["predicted_close"],
                predicted_volume=pred.get("predicted_volume"),
                predicted_change_pct=pred.get("predicted_change_pct"),
                confidence=pred.get("confidence"),
                current_price=pred.get("current_price"),
                prediction_horizon=horizon,
                signal=pred.get("signal"),
                signal_strength=pred.get("signal_strength"),
                stop_loss=risk_standard.get("stop_loss"),
                take_profit=risk_standard.get("take_profit"),
                risk_reward_ratio=risk_standard.get("risk_reward_ratio"),
                model_version=pred.get("model_version"),
                mae_at_time=pred.get("mae_at_time"),
                notes=pred.get("notes"),
                created_by_user_id=current_user.id,
            )
            db.add(pred_row)
            db.commit()
            result["prediction"]["id"] = pred_row.id

        return result

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
    del db, current_user
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
        return result
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
            "predicted_close": r.predicted_close,
            "predicted_change_pct": r.predicted_change_pct,
            "confidence": r.confidence,
            "current_price": r.current_price,
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
            Prediction.prediction_type == "actual",
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

    return {
        "asset": asset,
        "total_predictions": len(verified),
        "correct_directions": correct,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4),
        "directional_accuracy": round(da, 2),
        "computed_at": datetime.utcnow(),
    }
