"""
Predictions Router — /api/predictions  (Actual N-HiTS model outputs)
  GET  /{asset}            — single next-step prediction
  GET  /{asset}/multi      — 1d / 3d / 7d multi-horizon predictions
  GET  /{asset}/history    — past predictions stored in DB
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

from app.services.asset_registry import NHITS_FEATURED


def _validate_lstm_asset(asset: str) -> str:
    asset = asset.upper()
    if asset not in NHITS_FEATURED:
        raise HTTPException(status_code=400, detail=f"N-HiTS supported assets: {sorted(NHITS_FEATURED)}")
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Run the N-HiTS model for the given asset and return the prediction with
    buy/sell/hold signal, confidence interval, and risk parameters.
    Requires the model to be trained first (admin → /api/admin/train/{asset}).
    """
    asset = _validate_lstm_asset(asset)
    if horizon not in ("1d", "3d", "7d"):
        raise HTTPException(status_code=400, detail="Horizon must be 1d, 3d, or 7d")

    try:
        from app.services.indicators_service import compute_indicators
        from app.services.market_service import get_historical_data
        from app.services.prediction_service import run_lstm_prediction
        from app.services.risk_service import attach_risk_to_prediction

        # Get ATR for risk levels
        df = await get_historical_data(asset, period="1y")
        indicators = compute_indicators(df) if not df.empty else {}
        atr = indicators.get("atr_14")

        result = await run_lstm_prediction(asset, horizon)

        if "error" in result:
            raise HTTPException(status_code=503, detail=result["error"])

        attach_risk_to_prediction(result, atr)

        # Persist to DB
        pred_row = Prediction(
            asset=asset,
            prediction_type="actual",
            predicted_close=result["predicted_close"],
            predicted_volume=result.get("predicted_volume"),
            predicted_change_pct=result.get("predicted_change_pct"),
            confidence=result.get("confidence"),
            current_price=result.get("current_price"),
            prediction_horizon=horizon,
            signal=result.get("signal"),
            signal_strength=result.get("signal_strength"),
            stop_loss=result.get("stop_loss"),
            take_profit=result.get("take_profit"),
            risk_reward_ratio=result.get("risk_reward_ratio"),
            model_version=result.get("model_version"),
            mae_at_time=result.get("mae_at_time"),
            notes=result.get("notes"),
            created_by_user_id=current_user.id,
        )
        db.add(pred_row)
        db.commit()

        result["id"] = pred_row.id
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction failed for {asset}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset}/multi", response_model=dict)
async def multi_horizon_prediction(
    asset: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return 1d, 3d, and 7d N-HiTS predictions simultaneously."""
    asset = _validate_lstm_asset(asset)
    try:
        from app.services.prediction_service import run_multi_horizon_prediction

        result = await run_multi_horizon_prediction(asset)
        if "error" in result.get("prediction_1d", {}):
            raise HTTPException(
                status_code=503,
                detail=result["prediction_1d"]["error"]
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
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
