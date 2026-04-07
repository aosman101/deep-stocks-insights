"""
Deep Stock Insights - Prediction Service

Shared orchestration layer for:
  - N-HiTS
  - TFT
  - LightGBM
  - Statistical analytics
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, Optional

import numpy as np
import pandas as pd

from app.config import settings
from app.ml.preprocessing import StockPreprocessor
from app.services.asset_registry import has_nhits, has_tft
from app.services.indicators_service import compute_indicators, ema, line_of_best_fit, sma
from app.services.market_service import get_historical_data
from app.services.model_output_service import (
    build_model_response,
    build_prediction_item,
    build_risk_summary,
    build_workspace_response,
    get_model_label,
)
from app.services.risk_service import compute_risk_levels

logger = logging.getLogger(__name__)

_preprocessors: Dict[str, StockPreprocessor] = {}


def get_preprocessor(asset: str) -> StockPreprocessor:
    asset = asset.upper()
    if asset not in _preprocessors:
        proc = StockPreprocessor(lookback=settings.MODEL_LOOKBACK_WINDOW)
        path = os.path.join(settings.MODEL_SAVE_PATH, f"preprocessor_{asset.lower()}.pkl")
        if os.path.exists(path):
            proc.load(path)
        _preprocessors[asset] = proc
    return _preprocessors[asset]


def generate_signal(
    current_price: float,
    predicted_price: float,
    mae: float,
    threshold_multiplier: float = 1.5,
) -> tuple[str, float, float]:
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


def _supports_sequence_model(asset: str, model_key: str) -> bool:
    if model_key == "nhits":
        return has_nhits(asset)
    if model_key == "tft":
        return has_tft(asset)
    return False


def _get_sequence_model(asset: str, model_key: str, n_features: int):
    if model_key == "nhits":
        from app.ml.nhits_model import get_model
    elif model_key == "tft":
        from app.ml.tft_model import get_model
    else:
        raise ValueError(f"Unsupported sequence model: {model_key}")
    return get_model(asset, n_features=n_features)


def _sequence_model_note(model_key: str, lower: float, upper: float) -> str:
    label = get_model_label(model_key)
    return (
        f"{label} prediction using {settings.MODEL_LOOKBACK_WINDOW}-day window. "
        f"MC Dropout uncertainty: [{lower:.2f}, {upper:.2f}]. "
        "Use predictions as one of many tools in your research."
    )


def _compute_mae(df: pd.DataFrame) -> float:
    recent_close = df["close"].values[-10:]
    recent_ema = float(pd.Series(recent_close).ewm(span=3).mean().iloc[-1])
    return float(np.mean(np.abs(recent_close - recent_ema)))


def _build_risk(asset: str, current_price: float, signal: str, df: pd.DataFrame):
    indicators = compute_indicators(df)
    atr = indicators.get("atr_14")
    levels = compute_risk_levels(asset, current_price, signal, atr)
    return build_risk_summary(levels)


async def _ensure_sequence_model_ready(asset: str, model_key: str, df: pd.DataFrame):
    proc = get_preprocessor(asset)
    model = _get_sequence_model(asset, model_key, n_features=len(proc.feature_names))

    if not model.is_trained:
        logger.warning(f"[{asset}] {get_model_label(model_key)} is not trained. Attempting training now...")
        result = await train_model(asset, model_key=model_key)
        if result.get("status") != "success":
            return None, None, None, result.get("message") or result.get("error")

    if not proc.fitted:
        return None, None, None, f"Preprocessor for {asset} is not fitted."

    try:
        X = proc.transform(df)
    except ValueError as exc:
        return None, None, None, str(exc)

    return proc, model, X, None


def _scale_sequence_predictions(
    *,
    asset: str,
    model_key: str,
    model_version: str,
    current_price: float,
    predicted_close_1d: float,
    predicted_volume: Optional[float],
    mc_close_lower_1d: float,
    mc_close_upper_1d: float,
    mae_approx: float,
    horizons: list[str],
) -> tuple[list[Dict], Dict[str, Dict], Dict[str, float]]:
    delta_1d = predicted_close_1d - current_price
    predictions: list[Dict] = []
    by_horizon: Dict[str, Dict] = {}

    for horizon, days in (("1d", 1), ("3d", 3), ("7d", 7)):
        if horizon not in horizons:
            continue

        pred_close = current_price + delta_1d * np.sqrt(days)
        if days > 1:
            mc_lower_h = current_price + (mc_close_lower_1d - current_price) * np.sqrt(days)
            mc_upper_h = current_price + (mc_close_upper_1d - current_price) * np.sqrt(days)
        else:
            mc_lower_h = mc_close_lower_1d
            mc_upper_h = mc_close_upper_1d

        if mc_lower_h > mc_upper_h:
            mc_lower_h, mc_upper_h = mc_upper_h, mc_lower_h

        confidence = max(0, min(100, 100 * (1 - (mc_upper_h - mc_lower_h) / current_price * 5)))
        signal, strength, change_pct = generate_signal(current_price, pred_close, mae_approx)

        item = build_prediction_item(
            asset=asset,
            model_key=model_key,
            prediction_type="actual",
            predicted_close=pred_close,
            predicted_open=None,
            predicted_volume=predicted_volume,
            predicted_change_pct=change_pct,
            confidence=confidence,
            current_price=current_price,
            horizon=horizon,
            signal=signal,
            signal_strength=strength,
            model_version=model_version,
            mae_at_time=mae_approx,
            mc_lower=mc_lower_h,
            mc_upper=mc_upper_h,
            notes=_sequence_model_note(model_key, mc_lower_h, mc_upper_h),
            created_at=datetime.utcnow(),
        )
        predictions.append(item)
        by_horizon[horizon] = item

    primary = by_horizon.get("1d") or predictions[0]
    uncertainty = {
        "lower": primary.get("mc_lower"),
        "median": primary.get("predicted_close"),
        "upper": primary.get("mc_upper"),
    }
    return predictions, by_horizon, uncertainty


async def run_sequence_prediction(
    asset: str,
    horizon: str = "1d",
    model_key: str = "nhits",
    df: Optional[pd.DataFrame] = None,
) -> Dict:
    asset = asset.upper()
    model_key = model_key.lower()

    if not _supports_sequence_model(asset, model_key):
        return build_model_response(
            asset=asset,
            model_key=model_key,
            status="unsupported",
            message=f"{get_model_label(model_key)} is available only for featured assets.",
        )

    df = df if df is not None else await get_historical_data(asset, period="2y")
    if df.empty or len(df) < settings.MODEL_LOOKBACK_WINDOW + 10:
        return build_model_response(
            asset=asset,
            model_key=model_key,
            status="error",
            message=f"Insufficient data for {asset} {get_model_label(model_key)} prediction",
        )

    proc, model, X, error = await _ensure_sequence_model_ready(asset, model_key, df)
    if error:
        return build_model_response(
            asset=asset,
            model_key=model_key,
            status="untrained",
            current_price=float(df["close"].iloc[-1]) if not df.empty else None,
            message=error,
        )

    current_price = float(df["close"].iloc[-1])
    scaled_pred = model.predict(X)
    real_pred = proc.inverse_transform_targets(scaled_pred)
    predicted_close_1d = float(real_pred[0, 0])
    predicted_volume = float(real_pred[0, 1]) if real_pred.shape[1] > 1 else None

    mc_mean, mc_lower, mc_upper = model.mc_dropout_predict(X, n_samples=50)
    del mc_mean
    mc_close_lower_1d = float(proc.inverse_transform_targets(mc_lower)[0, 0])
    mc_close_upper_1d = float(proc.inverse_transform_targets(mc_upper)[0, 0])
    mae_approx = _compute_mae(df)

    predictions, _, uncertainty = _scale_sequence_predictions(
        asset=asset,
        model_key=model_key,
        model_version=model.version,
        current_price=current_price,
        predicted_close_1d=predicted_close_1d,
        predicted_volume=predicted_volume,
        mc_close_lower_1d=mc_close_lower_1d,
        mc_close_upper_1d=mc_close_upper_1d,
        mae_approx=mae_approx,
        horizons=[horizon],
    )

    primary = predictions[0]
    return build_model_response(
        asset=asset,
        model_key=model_key,
        status="ok",
        current_price=current_price,
        prediction=primary,
        predictions=predictions,
        model_version=model.version,
        prediction_type="actual",
        risk=_build_risk(asset, current_price, primary.get("signal", "HOLD"), df),
        uncertainty=uncertainty,
        notes=primary.get("notes"),
    )


async def run_multi_horizon_prediction(
    asset: str,
    model_key: str = "nhits",
    df: Optional[pd.DataFrame] = None,
) -> Dict:
    asset = asset.upper()
    model_key = model_key.lower()

    if not _supports_sequence_model(asset, model_key):
        return build_model_response(
            asset=asset,
            model_key=model_key,
            status="unsupported",
            message=f"{get_model_label(model_key)} is available only for featured assets.",
        )

    df = df if df is not None else await get_historical_data(asset, period="2y")
    if df.empty or len(df) < settings.MODEL_LOOKBACK_WINDOW + 10:
        return build_model_response(
            asset=asset,
            model_key=model_key,
            status="error",
            message=f"Insufficient data for {asset} {get_model_label(model_key)} prediction",
        )

    proc, model, X, error = await _ensure_sequence_model_ready(asset, model_key, df)
    if error:
        return build_model_response(
            asset=asset,
            model_key=model_key,
            status="untrained",
            current_price=float(df["close"].iloc[-1]) if not df.empty else None,
            message=error,
        )

    current_price = float(df["close"].iloc[-1])
    scaled_pred = model.predict(X)
    real_pred = proc.inverse_transform_targets(scaled_pred)
    predicted_close_1d = float(real_pred[0, 0])
    predicted_volume = float(real_pred[0, 1]) if real_pred.shape[1] > 1 else None

    mc_mean, mc_lower, mc_upper = model.mc_dropout_predict(X, n_samples=50)
    del mc_mean
    mc_close_lower_1d = float(proc.inverse_transform_targets(mc_lower)[0, 0])
    mc_close_upper_1d = float(proc.inverse_transform_targets(mc_upper)[0, 0])
    mae_approx = _compute_mae(df)

    predictions, by_horizon, uncertainty = _scale_sequence_predictions(
        asset=asset,
        model_key=model_key,
        model_version=model.version,
        current_price=current_price,
        predicted_close_1d=predicted_close_1d,
        predicted_volume=predicted_volume,
        mc_close_lower_1d=mc_close_lower_1d,
        mc_close_upper_1d=mc_close_upper_1d,
        mae_approx=mae_approx,
        horizons=["1d", "3d", "7d"],
    )

    primary = by_horizon["1d"]
    return build_model_response(
        asset=asset,
        model_key=model_key,
        status="ok",
        current_price=current_price,
        prediction=primary,
        predictions=predictions,
        model_version=model.version,
        prediction_type="actual",
        risk=_build_risk(asset, current_price, primary.get("signal", "HOLD"), df),
        uncertainty=uncertainty,
        notes=primary.get("notes"),
    )


async def run_lightgbm_model_prediction(
    asset: str,
    auto_train: bool = True,
    df: Optional[pd.DataFrame] = None,
) -> Dict:
    asset = asset.upper()
    df = df if df is not None else await get_historical_data(asset, period="2y")
    if df.empty:
        return build_model_response(
            asset=asset,
            model_key="lightgbm",
            status="error",
            message=f"No data found for {asset}",
        )

    from app.services.lightgbm_service import predict_lightgbm, train_lightgbm

    result = predict_lightgbm(asset, df, settings.MODEL_SAVE_PATH)
    if result.get("status") == "untrained" and auto_train:
        train_result = train_lightgbm(asset, df, settings.MODEL_SAVE_PATH)
        if train_result.get("status") == "success":
            result = predict_lightgbm(asset, df, settings.MODEL_SAVE_PATH)

    current_price = float(df["close"].iloc[-1])
    if result.get("status") != "ok":
        return build_model_response(
            asset=asset,
            model_key="lightgbm",
            status=result.get("status", "error"),
            current_price=current_price,
            model_version=result.get("model_version"),
            message=result.get("message", "LightGBM prediction is unavailable."),
        )

    prediction = build_prediction_item(
        asset=asset,
        model_key="lightgbm",
        prediction_type="actual",
        predicted_close=result["predicted_price"],
        predicted_open=None,
        predicted_volume=None,
        predicted_change_pct=result.get("predicted_change_pct"),
        confidence=result.get("confidence"),
        current_price=result.get("current_price", current_price),
        horizon="1d",
        signal=result.get("signal"),
        signal_strength=min(max((result.get("confidence", 0.0) / 100), 0.0), 1.0),
        model_version=result.get("model_version"),
        notes="LightGBM next-close forecast with directional class probabilities and feature importance.",
        created_at=datetime.utcnow(),
    )

    risk = _build_risk(asset, current_price, prediction.get("signal", "HOLD"), df)
    return build_model_response(
        asset=asset,
        model_key="lightgbm",
        status="ok",
        current_price=current_price,
        prediction=prediction,
        predictions=[prediction],
        model_version=result.get("model_version"),
        prediction_type="actual",
        risk=risk,
        uncertainty=None,
        probabilities=result.get("signal_probabilities"),
        feature_importance=result.get("top_features"),
        notes=prediction.get("notes"),
    )


async def run_prediction_workspace(asset: str) -> Dict:
    asset = asset.upper()
    df = await get_historical_data(asset, period="2y")
    if df.empty:
        return build_workspace_response(
            asset=asset,
            current_price=None,
            models=[
                build_model_response(
                    asset=asset,
                    model_key="lightgbm",
                    status="error",
                    message=f"No data found for {asset}",
                )
            ],
        )

    models = [await run_lightgbm_model_prediction(asset, df=df)]
    if has_nhits(asset):
        models.insert(0, await run_multi_horizon_prediction(asset, model_key="nhits", df=df))
    if has_tft(asset):
        insert_at = 1 if has_nhits(asset) else 0
        models.insert(insert_at, await run_multi_horizon_prediction(asset, model_key="tft", df=df))
    return build_workspace_response(asset=asset, models=models, current_price=float(df["close"].iloc[-1]))


async def run_lstm_prediction(asset: str, horizon: str = "1d") -> Dict:
    return await run_sequence_prediction(asset, horizon=horizon, model_key="nhits")


async def run_analytics_prediction(asset: str) -> Dict:
    asset = asset.upper()
    df = await get_historical_data(asset, period="1y")
    if df.empty or len(df) < 30:
        return {"error": f"Insufficient data for {asset} analytics prediction"}

    close = df["close"].astype(float)
    current_price = float(close.iloc[-1])

    sma20 = sma(close, 20)
    sma50 = sma(close, min(50, len(close)))
    sma_slope = float((sma20.iloc[-1] - sma20.iloc[-5]) / 5) if len(sma20) >= 5 else 0
    sma_forecast = current_price + sma_slope

    ema12 = ema(close, 12)
    ema26 = ema(close, 26)
    ema_momentum = float(ema12.iloc[-1] - ema26.iloc[-1])
    ema_forecast = current_price + ema_momentum * 0.5

    window = min(50, len(close))
    lobf_slope, lobf_r2, lobf_next = line_of_best_fit(close, window)
    del lobf_slope, lobf_r2
    lobf_forecast = float(lobf_next) if lobf_next else current_price

    alpha, beta = 0.3, 0.1
    level = float(close.iloc[0])
    trend = 0.0
    for price in close.iloc[1:]:
        prev_level = level
        level = alpha * float(price) + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
    ets_forecast = level + trend

    forecasts = [f for f in [sma_forecast, ema_forecast, lobf_forecast, ets_forecast] if f > 0]
    ensemble_forecast = float(np.mean(forecasts))
    ensemble_change_pct = ((ensemble_forecast - current_price) / current_price) * 100

    if ensemble_change_pct > 1.0:
        ensemble_signal = "BUY"
        confidence = min(50 + ensemble_change_pct * 5, 85)
    elif ensemble_change_pct < -1.0:
        ensemble_signal = "SELL"
        confidence = min(50 + abs(ensemble_change_pct) * 5, 85)
    else:
        ensemble_signal = "HOLD"
        confidence = 60 - abs(ensemble_change_pct) * 5

    returns = close.pct_change().dropna()
    mu = float(returns.mean())
    sigma = float(returns.std())
    n_sims = 1000
    n_steps = 5

    rng = np.random.default_rng(42)
    simulated = current_price * np.exp(np.cumsum(rng.normal(mu, sigma, (n_sims, n_steps)), axis=1))
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


async def train_model(
    asset: str,
    period: str = "2y",
    epochs: Optional[int] = None,
    model_key: str = "nhits",
) -> Dict:
    asset = asset.upper()
    model_key = model_key.lower()
    epochs = epochs or settings.MODEL_EPOCHS

    logger.info(
        f"[{asset}] Starting {get_model_label(model_key)} training pipeline "
        f"(period={period}, epochs={epochs})"
    )

    try:
        df = await get_historical_data(asset, period=period)
        if df.empty or len(df) < settings.MODEL_LOOKBACK_WINDOW + 50:
            return {"error": f"Insufficient historical data for {asset} ({len(df)} rows)"}

        proc = get_preprocessor(asset)
        X_train, y_train, X_val, y_val = proc.fit_transform(df)

        os.makedirs(settings.MODEL_SAVE_PATH, exist_ok=True)
        proc.save(os.path.join(settings.MODEL_SAVE_PATH, f"preprocessor_{asset.lower()}.pkl"))
        _preprocessors[asset] = proc

        model = _get_sequence_model(asset, model_key, n_features=len(proc.feature_names))
        if model.model is None:
            model.build()

        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: model.train(X_train, y_train, X_val, y_val, epochs=epochs),
        )

        return {
            "asset": asset,
            "status": "success",
            "message": f"{get_model_label(model_key)} model trained successfully for {asset}",
            "model_key": model_key,
            **result,
        }
    except Exception as exc:
        logger.error(f"[{asset}] Training failed: {exc}", exc_info=True)
        return {"asset": asset, "status": "error", "model_key": model_key, "message": str(exc)}
