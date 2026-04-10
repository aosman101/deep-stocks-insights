"""
Analytics Router — /api/analytics  (Estimated / statistical predictions)
  GET /{asset}          — ensemble statistical forecast
  GET /{asset}/mc       — Monte Carlo simulation details
  GET /{asset}/compare  — N-HiTS actual vs statistical estimates side-by-side
  GET /{asset}/accuracy — walk-forward model benchmark results
  GET /{asset}/backtest — simplified walk-forward backtest results
"""

import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.prediction import Prediction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics (Estimated Predictions)"])

from app.services.asset_registry import ALL_ASSETS


def _validate_asset(asset: str) -> str:
    asset = asset.upper()
    if not asset:
        raise HTTPException(status_code=400, detail="Asset symbol is required")
    return asset


@router.get("/{asset}")
async def estimated_prediction(
    asset: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns an ensemble statistical forecast for the given asset.
    No trained N-HiTS model required — uses SMA trend, EMA momentum,
    Line of Best Fit, Holt's exponential smoothing, and Monte Carlo simulation.
    """
    asset = _validate_asset(asset)
    try:
        from app.services.market_service import get_historical_data
        from app.services.indicators_service import compute_indicators
        from app.services.prediction_service import run_analytics_prediction
        from app.services.risk_service import attach_risk_to_prediction
        from app.services.prediction_record_service import persist_analytics_response

        result = await run_analytics_prediction(asset)
        if "error" in result:
            raise HTTPException(status_code=503, detail=result["error"])

        # Attach risk levels
        result["signal"] = result.get("ensemble_signal", "HOLD")
        result["current_price"] = result.get("current_price", 0)
        result["asset"] = asset

        df = await get_historical_data(asset, period="1y")
        indicators = compute_indicators(df) if not df.empty else {}
        atr = indicators.get("atr_14")
        attach_risk_to_prediction(result, atr)

        return persist_analytics_response(
            db,
            result,
            user_id=current_user.id,
            trigger_source="manual",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analytics prediction failed for {asset}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset}/mc")
async def monte_carlo_detail(
    asset: str,
    n_simulations: int = Query(default=500, ge=100, le=5000),
    horizon_days: int = Query(default=30, ge=1, le=365),
    _: User = Depends(get_current_active_user),
):
    """
    Run a detailed Monte Carlo simulation and return
    path statistics for visualisation (fan chart data).
    """
    asset = _validate_asset(asset)
    try:
        import numpy as np
        from app.services.market_service import get_historical_data

        df = await get_historical_data(asset, period="2y")
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {asset}")

        close = df["close"].astype(float)
        current_price = float(close.iloc[-1])
        returns = close.pct_change().dropna()
        mu = float(returns.mean())
        sigma = float(returns.std())

        rng = np.random.default_rng(42)
        simulated = current_price * np.exp(
            np.cumsum(rng.normal(mu, sigma, (n_simulations, horizon_days)), axis=1)
        )

        # Percentile paths for fan chart
        percentiles = [5, 10, 25, 50, 75, 90, 95]
        paths = {
            f"p{p}": [round(float(np.percentile(simulated[:, d], p)), 2)
                      for d in range(horizon_days)]
            for p in percentiles
        }

        final = simulated[:, -1]
        return {
            "asset": asset,
            "current_price": round(current_price, 4),
            "horizon_days": horizon_days,
            "n_simulations": n_simulations,
            "drift_daily": round(mu, 6),
            "volatility_daily": round(sigma, 6),
            "volatility_annualised": round(sigma * np.sqrt(252) * 100, 2),
            "final_price_stats": {
                "mean": round(float(final.mean()), 4),
                "median": round(float(np.median(final)), 4),
                "p5": round(float(np.percentile(final, 5)), 4),
                "p95": round(float(np.percentile(final, 95)), 4),
                "prob_above_current": round(float((final > current_price).mean() * 100), 2),
            },
            "paths": paths,
            "generated_at": datetime.utcnow(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset}/compare")
async def compare_methods(
    asset: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Side-by-side comparison:
      - Latest stored actual predictions by model
      - Latest statistical estimate
      - Current technical indicator signal
    """
    asset = _validate_asset(asset)
    try:
        from app.services.market_service import get_historical_data
        from app.services.indicators_service import compute_indicators

        actual_predictions = (
            db.query(Prediction)
            .filter(Prediction.asset == asset, Prediction.prediction_type == "actual")
            .order_by(Prediction.created_at.desc())
            .all()
        )
        latest_by_model = {}
        for row in actual_predictions:
            latest_by_model.setdefault(row.model_key or "nhits", row)
        primary_actual = (
            latest_by_model.get("ensemble")
            or latest_by_model.get("nhits")
            or latest_by_model.get("tft")
            or latest_by_model.get("lightgbm")
        )

        # Latest estimated prediction from DB
        est_pred = (
            db.query(Prediction)
            .filter(Prediction.asset == asset, Prediction.prediction_type == "estimated")
            .order_by(Prediction.created_at.desc())
            .first()
        )

        # Current indicators
        df = await get_historical_data(asset, period="1y")
        indicators = compute_indicators(df) if not df.empty else {}

        return {
            "asset": asset,
            "lstm_prediction": {
                "predicted_close": primary_actual.predicted_close if primary_actual else None,
                "signal": primary_actual.signal if primary_actual else None,
                "confidence": primary_actual.confidence if primary_actual else None,
                "created_at": primary_actual.created_at if primary_actual else None,
                "model_key": primary_actual.model_key if primary_actual else None,
            } if primary_actual else None,
            "actual_predictions": {
                key: {
                    "predicted_close": row.predicted_close,
                    "signal": row.signal,
                    "confidence": row.confidence,
                    "prediction_horizon": row.prediction_horizon,
                    "created_at": row.created_at,
                    "run_id": row.run_id,
                }
                for key, row in latest_by_model.items()
            },
            "statistical_estimate": {
                "predicted_close": est_pred.predicted_close if est_pred else None,
                "signal": est_pred.signal if est_pred else None,
                "confidence": est_pred.confidence if est_pred else None,
                "created_at": est_pred.created_at if est_pred else None,
            } if est_pred else None,
            "indicator_signal": {
                "overall": indicators.get("overall_signal"),
                "bullish_count": indicators.get("bullish_count"),
                "bearish_count": indicators.get("bearish_count"),
                "rsi_14": indicators.get("rsi_14"),
                "macd": indicators.get("macd"),
                "macd_signal": indicators.get("macd_signal"),
                "adx_14": indicators.get("adx_14"),
            },
            "current_price": indicators.get("current_price"),
            "generated_at": datetime.utcnow(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset}/accuracy")
async def walk_forward_accuracy(
    asset: str,
    period: str = Query(default="1y"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Walk-forward benchmark across N-HiTS, LightGBM, and their equal-weight ensemble.
    Returns model scorecards plus a top-level summary for compatibility with
    older pages that expect a single accuracy payload.
    """
    asset = _validate_asset(asset)
    try:
        from app.services.market_service import get_historical_data

        df = await get_historical_data(asset, period=period)
        if df.empty or len(df) < 30:
            raise HTTPException(status_code=404, detail="Insufficient data for accuracy analysis")

        from app.services.model_evaluation_service import evaluate_model_stack
        from app.services.model_health_service import persist_walk_forward_metrics

        loop = asyncio.get_running_loop()
        payload = await loop.run_in_executor(None, lambda: evaluate_model_stack(df, asset, period))
        persist_walk_forward_metrics(db, asset, period, payload)
        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Accuracy analysis failed for {asset}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset}/backtest")
async def simple_backtest(
    asset: str,
    period: str = Query(default="1y"),
    _: User = Depends(get_current_active_user),
):
    """
    Walk-forward backtest of the SMA crossover strategy
    (SMA20 vs SMA50) as an educational baseline comparison.
    Returns annualised return, Sharpe ratio, and max drawdown.
    """
    asset = _validate_asset(asset)
    try:
        import numpy as np
        import pandas as pd
        from app.services.market_service import get_historical_data

        df = await get_historical_data(asset, period=period)
        if df.empty or len(df) < 60:
            raise HTTPException(status_code=404, detail="Insufficient data for backtest")

        close = df["close"].astype(float)

        sma20 = close.rolling(20).mean()
        sma50 = close.rolling(50).mean()

        position = (sma20 > sma50).astype(int)           # 1 = long, 0 = flat
        daily_ret = close.pct_change()
        strat_ret = (position.shift(1) * daily_ret).dropna()
        bh_ret = daily_ret.dropna()

        def annualised_return(rets): return float((1 + rets).prod() ** (252 / len(rets)) - 1) * 100
        def sharpe(rets): return float(rets.mean() / rets.std() * np.sqrt(252)) if rets.std() > 0 else 0
        def max_dd(rets):
            cum = (1 + rets).cumprod()
            peak = cum.cummax()
            dd = (cum - peak) / peak
            return float(dd.min()) * 100

        total_trades = int((position.diff().abs()).sum())
        total_return_pct = float(((1 + strat_ret).prod() - 1) * 100)
        win_rate = float((strat_ret > 0).mean()) if len(strat_ret) else 0.0
        equity_curve = [
            {
                "date": pd.to_datetime(idx).strftime("%Y-%m-%d"),
                "equity": round(float(val), 4),
            }
            for idx, val in ((1 + strat_ret).cumprod() * 100).items()
        ]

        strategy_metrics = {
            "annualised_return_pct": round(annualised_return(strat_ret), 2),
            "sharpe_ratio": round(sharpe(strat_ret), 4),
            "max_drawdown_pct": round(max_dd(strat_ret), 2),
            "total_trades": total_trades,
        }
        buy_and_hold_metrics = {
            "annualised_return_pct": round(annualised_return(bh_ret), 2),
            "sharpe_ratio": round(sharpe(bh_ret), 4),
            "max_drawdown_pct": round(max_dd(bh_ret), 2),
        }

        return {
            "asset": asset,
            "period": period,
            "strategy": "SMA20 vs SMA50 crossover",
            "strategy_metrics": strategy_metrics,
            "buy_and_hold_metrics": buy_and_hold_metrics,
            "total_trades": total_trades,
            "win_rate": round(win_rate, 4),
            "total_return_pct": round(total_return_pct, 2),
            "sharpe_ratio": strategy_metrics["sharpe_ratio"],
            "equity_curve": equity_curve,
            "note": "Educational simulation. Does not include transaction costs or slippage.",
            "generated_at": datetime.utcnow(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
