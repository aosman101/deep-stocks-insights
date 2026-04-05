"""
Deep Stock Insights - Prediction Service
Orchestrates: data fetch → preprocess → N-HiTS inference → inverse-transform → signal generation.

Two prediction modes:
  1. actual     — direct N-HiTS model output (requires trained weights)
  2. estimated  — ensemble of statistical methods (always available)

Both modes produce buy/sell/hold signals and multi-horizon forecasts.
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict

from app.config import settings
from app.ml.preprocessing import StockPreprocessor
from app.services.market_service import get_historical_data
from app.services.indicators_service import compute_indicators, line_of_best_fit, ema, sma

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
#  Preprocessor registry (one per asset)
# ─────────────────────────────────────────────────────────────

_preprocessors: Dict[str, StockPreprocessor] = {}


def get_preprocessor(asset: str) -> StockPreprocessor:
    asset = asset.upper()
    if asset not in _preprocessors:
        proc = StockPreprocessor(lookback=settings.MODEL_LOOKBACK_WINDOW)
        # Try loading from disk
        import os, pickle
        path = os.path.join(settings.MODEL_SAVE_PATH, f"preprocessor_{asset.lower()}.pkl")
        if os.path.exists(path):
            proc.load(path)
        _preprocessors[asset] = proc
    return _preprocessors[asset]


# ─────────────────────────────────────────────────────────────
#  Signal generation (matches report: 1.5 × 10-day MAE threshold)
# ─────────────────────────────────────────────────────────────

def generate_signal(
    current_price: float,
    predicted_price: float,
    mae: float,
    threshold_multiplier: float = 1.5,
) -> tuple:
    """
    Return (signal, signal_strength, change_pct).
    signal: "BUY" | "HOLD" | "SELL"
    signal_strength: 0–1 reflecting conviction
    """
    threshold = threshold_multiplier * mae
    change = predicted_price - current_price
    change_pct = (change / current_price) * 100 if current_price else 0

    if change > threshold:
        signal = "BUY"
        strength = min(change / (3 * threshold), 1.0)
    elif change < -threshold:
        signal = "SELL"
        strength = min(abs(change) / (3 * threshold), 1.0)
    else:
        signal = "HOLD"
        strength = 1.0 - (abs(change) / threshold) if threshold else 0.5

    return signal, round(strength, 4), round(change_pct, 4)


# ─────────────────────────────────────────────────────────────
#  N-HiTS actual prediction
# ─────────────────────────────────────────────────────────────

async def run_lstm_prediction(asset: str, horizon: str = "1d") -> Dict:
    """
    Run the N-HiTS model for the given asset and horizon.
    Returns a dict matching the PredictionResponse schema.
    """
    asset = asset.upper()

    # Fetch data
    df = await get_historical_data(asset, period="2y")
    if df.empty or len(df) < settings.MODEL_LOOKBACK_WINDOW + 10:
        return {"error": f"Insufficient data for {asset} N-HiTS prediction"}

    # Get model and preprocessor
    from app.ml.nhits_model import get_model

    proc = get_preprocessor(asset)
    model = get_model(asset, n_features=len(proc.feature_names))

    if not model.is_trained:
        logger.warning(f"[{asset}] Model not trained. Attempting training now...")
        result = await train_model(asset)
        if "error" in result:
            return {"error": f"Model for {asset} is not trained. Trigger /admin/train/{asset} first."}

    if not proc.fitted:
        return {"error": f"Preprocessor for {asset} not fitted. Trigger /admin/train/{asset} first."}

    current_price = float(df["close"].iloc[-1])

    # Preprocess for inference
    try:
        X = proc.transform(df)
    except ValueError as e:
        return {"error": str(e)}

    # Deterministic prediction (1-step ahead)
    scaled_pred = model.predict(X)                     # [1, 2]
    real_pred = proc.inverse_transform_targets(scaled_pred)   # [1, 2]

    predicted_close_1d = float(real_pred[0, 0])
    predicted_volume = float(real_pred[0, 1]) if real_pred.shape[1] > 1 else None

    # Scale the prediction for multi-day horizons
    # The model predicts 1-step (1d) change; extrapolate for 3d/7d using sqrt-time scaling
    horizon_days = {"1d": 1, "3d": 3, "7d": 7}.get(horizon, 1)
    delta_1d = predicted_close_1d - current_price
    scaled_delta = delta_1d * np.sqrt(horizon_days)
    predicted_close = current_price + scaled_delta

    # Monte Carlo Dropout for uncertainty
    mc_mean, mc_lower, mc_upper = model.mc_dropout_predict(X, n_samples=50)
    mc_close_mean = float(proc.inverse_transform_targets(mc_mean)[0, 0])
    mc_close_lower = float(proc.inverse_transform_targets(mc_lower)[0, 0])
    mc_close_upper = float(proc.inverse_transform_targets(mc_upper)[0, 0])

    # Scale MC bounds for horizon
    if horizon_days > 1:
        mc_delta_lower = (mc_close_lower - current_price) * np.sqrt(horizon_days)
        mc_delta_upper = (mc_close_upper - current_price) * np.sqrt(horizon_days)
        mc_close_lower = current_price + mc_delta_lower
        mc_close_upper = current_price + mc_delta_upper
        mc_close_mean = current_price + (mc_close_mean - current_price) * np.sqrt(horizon_days)

    # Ensure bounds don't invert after scaling
    if mc_close_lower > mc_close_upper:
        mc_close_lower, mc_close_upper = mc_close_upper, mc_close_lower

    confidence = max(0, min(100, 100 * (1 - (mc_close_upper - mc_close_lower) / current_price * 5)))

    # Compute 10-day MAE from recent predictions (use EMA-based approx if no DB history)
    recent_close = df["close"].values[-10:]
    recent_ema = float(pd.Series(recent_close).ewm(span=3).mean().iloc[-1])
    mae_approx = float(np.mean(np.abs(recent_close - recent_ema)))

    signal, strength, change_pct = generate_signal(current_price, predicted_close, mae_approx)

    return {
        "asset": asset,
        "prediction_type": "actual",
        "predicted_close": round(predicted_close, 4),
        "predicted_open": None,
        "predicted_volume": round(predicted_volume, 2) if predicted_volume else None,
        "predicted_change_pct": round(change_pct, 4),
        "confidence": round(confidence, 2),
        "current_price": round(current_price, 4),
        "prediction_horizon": horizon,
        "signal": signal,
        "signal_strength": strength,
        "model_version": model.version,
        "mae_at_time": round(mae_approx, 4),
        "mc_lower": round(mc_close_lower, 4),
        "mc_upper": round(mc_close_upper, 4),
        "notes": (
            f"N-HiTS prediction using {settings.MODEL_LOOKBACK_WINDOW}-day window. "
            f"MC Dropout uncertainty: [{mc_close_lower:.2f}, {mc_close_upper:.2f}]. "
            f"Use predictions as one of many tools in your research."
        ),
        "created_at": datetime.utcnow(),
    }


async def run_multi_horizon_prediction(asset: str) -> Dict:
    """
    Run 1d, 3d, 7d N-HiTS predictions efficiently.
    Fetches data and runs inference ONCE, then scales for each horizon.
    """
    asset = asset.upper()

    # Single data fetch
    df = await get_historical_data(asset, period="2y")
    if df.empty or len(df) < settings.MODEL_LOOKBACK_WINDOW + 10:
        error_payload = {"error": f"Insufficient data for {asset} N-HiTS prediction"}
        return {
            "asset": asset, "current_price": 0, "model_type": "N-HiTS",
            "prediction_1d": error_payload, "prediction_3d": error_payload,
            "prediction_7d": error_payload, "predictions": [],
            "generated_at": datetime.utcnow(),
        }

    from app.ml.nhits_model import get_model

    proc = get_preprocessor(asset)
    model = get_model(asset, n_features=len(proc.feature_names))

    if not model.is_trained:
        logger.warning(f"[{asset}] Model not trained. Attempting training now...")
        result = await train_model(asset)
        if "error" in result:
            error_payload = {"error": f"Model for {asset} is not trained. Trigger /admin/train/{asset} first."}
            return {
                "asset": asset, "current_price": 0, "model_type": "N-HiTS",
                "prediction_1d": error_payload, "predictions": [],
                "generated_at": datetime.utcnow(),
            }

    if not proc.fitted:
        error_payload = {"error": f"Preprocessor for {asset} not fitted."}
        return {
            "asset": asset, "current_price": 0, "model_type": "N-HiTS",
            "prediction_1d": error_payload, "predictions": [],
            "generated_at": datetime.utcnow(),
        }

    current_price = float(df["close"].iloc[-1])

    # Single preprocess + inference
    try:
        X = proc.transform(df)
    except ValueError as e:
        error_payload = {"error": str(e)}
        return {
            "asset": asset, "current_price": current_price, "model_type": "N-HiTS",
            "prediction_1d": error_payload, "predictions": [],
            "generated_at": datetime.utcnow(),
        }

    scaled_pred = model.predict(X)
    real_pred = proc.inverse_transform_targets(scaled_pred)
    predicted_close_1d = float(real_pred[0, 0])
    predicted_volume = float(real_pred[0, 1]) if real_pred.shape[1] > 1 else None

    # Single MC dropout run
    mc_mean, mc_lower, mc_upper = model.mc_dropout_predict(X, n_samples=50)
    mc_close_mean_1d = float(proc.inverse_transform_targets(mc_mean)[0, 0])
    mc_close_lower_1d = float(proc.inverse_transform_targets(mc_lower)[0, 0])
    mc_close_upper_1d = float(proc.inverse_transform_targets(mc_upper)[0, 0])

    # MAE approximation
    recent_close = df["close"].values[-10:]
    recent_ema = float(pd.Series(recent_close).ewm(span=3).mean().iloc[-1])
    mae_approx = float(np.mean(np.abs(recent_close - recent_ema)))

    delta_1d = predicted_close_1d - current_price

    # Build predictions for each horizon by scaling
    predictions = []
    horizon_results = {}
    for horizon, days in (("1d", 1), ("3d", 3), ("7d", 7)):
        scaled_delta = delta_1d * np.sqrt(days)
        pred_close = current_price + scaled_delta

        if days > 1:
            mc_lower_h = current_price + (mc_close_lower_1d - current_price) * np.sqrt(days)
            mc_upper_h = current_price + (mc_close_upper_1d - current_price) * np.sqrt(days)
        else:
            mc_lower_h = mc_close_lower_1d
            mc_upper_h = mc_close_upper_1d

        # Ensure bounds don't invert after scaling
        if mc_lower_h > mc_upper_h:
            mc_lower_h, mc_upper_h = mc_upper_h, mc_lower_h

        confidence = max(0, min(100, 100 * (1 - (mc_upper_h - mc_lower_h) / current_price * 5)))
        signal, strength, change_pct = generate_signal(current_price, pred_close, mae_approx)

        payload = {
            "asset": asset,
            "prediction_type": "actual",
            "predicted_close": round(pred_close, 4),
            "predicted_open": None,
            "predicted_volume": round(predicted_volume, 2) if predicted_volume else None,
            "predicted_change_pct": round(change_pct, 4),
            "confidence": round(confidence, 2),
            "current_price": round(current_price, 4),
            "prediction_horizon": horizon,
            "signal": signal,
            "signal_strength": strength,
            "model_version": model.version,
            "mae_at_time": round(mae_approx, 4),
            "mc_lower": round(mc_lower_h, 4),
            "mc_upper": round(mc_upper_h, 4),
            "notes": (
                f"N-HiTS prediction using {settings.MODEL_LOOKBACK_WINDOW}-day window. "
                f"MC Dropout uncertainty: [{mc_lower_h:.2f}, {mc_upper_h:.2f}]. "
                f"Use predictions as one of many tools in your research."
            ),
            "created_at": datetime.utcnow(),
            "horizon": horizon,
        }
        predictions.append(payload)
        horizon_results[horizon] = payload

    d1 = horizon_results["1d"]

    # Compute risk levels (reuse the same df)
    indicators = compute_indicators(df)
    atr = indicators.get("atr_14")

    from app.services.risk_service import compute_risk_levels

    levels = compute_risk_levels(asset, current_price, d1.get("signal", "HOLD"), atr)
    risk = {
        "conservative": {
            "stop_loss": levels.get("stop_loss_conservative"),
            "take_profit": levels.get("take_profit_conservative"),
            "risk_reward_ratio": levels.get("rr_conservative"),
        },
        "standard": {
            "stop_loss": levels.get("stop_loss_standard"),
            "take_profit": levels.get("take_profit_standard"),
            "risk_reward_ratio": levels.get("rr_standard"),
        },
        "aggressive": {
            "stop_loss": levels.get("stop_loss_aggressive"),
            "take_profit": levels.get("take_profit_aggressive"),
            "risk_reward_ratio": levels.get("rr_aggressive"),
        },
    }
    uncertainty = {
        "lower": d1.get("mc_lower"),
        "median": d1.get("predicted_close"),
        "upper": d1.get("mc_upper"),
    }

    return {
        "asset": asset,
        "current_price": current_price,
        "model_version": d1.get("model_version"),
        "version": d1.get("model_version"),
        "model_type": "N-HiTS",
        "prediction_1d": horizon_results["1d"],
        "prediction_3d": horizon_results["3d"],
        "prediction_7d": horizon_results["7d"],
        "prediction": d1,
        "predictions": predictions,
        "risk": risk,
        "uncertainty": uncertainty,
        "confidence_lower": d1.get("mc_lower"),
        "confidence_upper": d1.get("mc_upper"),
        "generated_at": datetime.utcnow(),
    }


# ─────────────────────────────────────────────────────────────
#  Estimated / analytics prediction
# ─────────────────────────────────────────────────────────────

async def run_analytics_prediction(asset: str) -> Dict:
    """
    Ensemble of statistical forecasts (always available, no ML training needed):
      - SMA forecast (price × SMA trend slope)
      - EMA forecast
      - Line of Best Fit forecast
      - Exponential smoothing (ETS-like)
      - Monte Carlo simulation
    """
    asset = asset.upper()
    df = await get_historical_data(asset, period="1y")
    if df.empty or len(df) < 30:
        return {"error": f"Insufficient data for {asset} analytics prediction"}

    close = df["close"].astype(float)
    current_price = float(close.iloc[-1])

    # ── SMA forecast ──────────────────────────────────────────
    sma20 = sma(close, 20)
    sma50 = sma(close, min(50, len(close)))
    sma_slope = float((sma20.iloc[-1] - sma20.iloc[-5]) / 5) if len(sma20) >= 5 else 0
    sma_forecast = current_price + sma_slope

    # ── EMA forecast ──────────────────────────────────────────
    ema12 = ema(close, 12)
    ema26 = ema(close, 26)
    ema_momentum = float(ema12.iloc[-1] - ema26.iloc[-1])
    ema_forecast = current_price + ema_momentum * 0.5

    # ── Line of Best Fit forecast ─────────────────────────────
    window = min(50, len(close))
    lobf_slope, lobf_r2, lobf_next = line_of_best_fit(close, window)
    lobf_forecast = float(lobf_next) if lobf_next else current_price

    # ── Exponential smoothing (Holt's method) ─────────────────
    alpha, beta = 0.3, 0.1
    level = float(close.iloc[0])
    trend = 0.0
    for price in close.iloc[1:]:
        prev_level = level
        level = alpha * float(price) + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
    ets_forecast = level + trend

    # ── Ensemble ─────────────────────────────────────────────
    forecasts = [f for f in [sma_forecast, ema_forecast, lobf_forecast, ets_forecast] if f > 0]
    ensemble_forecast = float(np.mean(forecasts))
    ensemble_change_pct = ((ensemble_forecast - current_price) / current_price) * 100

    # Signal from ensemble
    if ensemble_change_pct > 1.0:
        ensemble_signal = "BUY"
        confidence = min(50 + ensemble_change_pct * 5, 85)
    elif ensemble_change_pct < -1.0:
        ensemble_signal = "SELL"
        confidence = min(50 + abs(ensemble_change_pct) * 5, 85)
    else:
        ensemble_signal = "HOLD"
        confidence = 60 - abs(ensemble_change_pct) * 5

    # ── Monte Carlo simulation ────────────────────────────────
    returns = close.pct_change().dropna()
    mu = float(returns.mean())
    sigma = float(returns.std())
    n_sims = 1000
    n_steps = 5   # 5-day horizon

    rng = np.random.default_rng(42)
    simulated = current_price * np.exp(
        np.cumsum(rng.normal(mu, sigma, (n_sims, n_steps)), axis=1)
    )
    final_prices = simulated[:, -1]
    mc_mean = float(final_prices.mean())
    mc_lower_5 = float(np.percentile(final_prices, 5))
    mc_upper_95 = float(np.percentile(final_prices, 95))
    mc_prob_up = float((final_prices > current_price).mean() * 100)

    return {
        "asset": asset,
        "current_price": round(current_price, 4),
        "sma_forecast": round(sma_forecast, 4),
        "ema_forecast": round(ema_forecast, 4),
        "lobf_forecast": round(lobf_forecast, 4),
        "arima_like_forecast": round(ets_forecast, 4),
        "ensemble_forecast": round(ensemble_forecast, 4),
        "ensemble_change_pct": round(ensemble_change_pct, 4),
        "ensemble_signal": ensemble_signal,
        "ensemble_confidence": round(confidence, 2),
        "mc_mean": round(mc_mean, 4),
        "mc_lower_5": round(mc_lower_5, 4),
        "mc_upper_95": round(mc_upper_95, 4),
        "mc_probability_up": round(mc_prob_up, 2),
        "generated_at": datetime.utcnow(),
    }


# ─────────────────────────────────────────────────────────────
#  Model training
# ─────────────────────────────────────────────────────────────

async def train_model(asset: str, period: str = "2y", epochs: int = None) -> Dict:
    """
    Fetch historical data, fit preprocessor, train N-HiTS.
    Runs in a thread executor to avoid blocking the event loop.
    """
    asset = asset.upper()
    epochs = epochs or settings.MODEL_EPOCHS

    logger.info(f"[{asset}] Starting training pipeline (period={period}, epochs={epochs})")

    try:
        df = await get_historical_data(asset, period=period)
        if df.empty or len(df) < settings.MODEL_LOOKBACK_WINDOW + 50:
            return {"error": f"Insufficient historical data for {asset} ({len(df)} rows)"}

        proc = get_preprocessor(asset)
        X_train, y_train, X_val, y_val = proc.fit_transform(df)

        # Save preprocessor
        import os
        os.makedirs(settings.MODEL_SAVE_PATH, exist_ok=True)
        proc.save(
            os.path.join(settings.MODEL_SAVE_PATH, f"preprocessor_{asset.lower()}.pkl")
        )
        _preprocessors[asset] = proc

        from app.ml.nhits_model import get_model

        model = get_model(asset, n_features=len(proc.feature_names))
        if model.model is None:
            model.build()

        # Run training in thread executor so async handler returns promptly
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: model.train(X_train, y_train, X_val, y_val, epochs=epochs),
        )

        return {
            "asset": asset,
            "status": "success",
            "message": f"N-HiTS model trained successfully for {asset}",
            **result,
        }

    except Exception as e:
        logger.error(f"[{asset}] Training failed: {e}", exc_info=True)
        return {"asset": asset, "status": "error", "message": str(e)}
