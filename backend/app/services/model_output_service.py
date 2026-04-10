"""Shared prediction payload helpers for ML model endpoints."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Iterable, Optional

from app.config import settings

MODEL_LABELS = {
    "nhits": "N-HiTS",
    "tft": "TFT",
    "lightgbm": "LightGBM",
    "ensemble": "Ensemble",
    "analytics": "Analytics",
}

MODEL_HORIZONS = {
    "nhits": ["1d", "3d", "7d"],
    "tft": ["1d", "3d", "7d"],
    "lightgbm": ["1d"],
    "ensemble": ["1d"],
    "analytics": ["5d"],
}


def get_model_label(model_key: str) -> str:
    return MODEL_LABELS.get(model_key, model_key.upper())


def get_supported_horizons(model_key: str) -> list[str]:
    return list(MODEL_HORIZONS.get(model_key, ["1d"]))


def _normalise_probabilities(probabilities: Optional[Dict[str, Any]]) -> Optional[Dict[str, float]]:
    if not probabilities:
        return None
    return {
        "SELL": round(float(probabilities.get("SELL", 0.0)), 2),
        "HOLD": round(float(probabilities.get("HOLD", 0.0)), 2),
        "BUY": round(float(probabilities.get("BUY", 0.0)), 2),
    }


def build_prediction_item(
    *,
    asset: str,
    model_key: str,
    predicted_close: float,
    current_price: float,
    horizon: str = "1d",
    prediction_type: str = "actual",
    predicted_open: Optional[float] = None,
    predicted_volume: Optional[float] = None,
    predicted_change_pct: Optional[float] = None,
    confidence: Optional[float] = None,
    signal: Optional[str] = None,
    signal_strength: Optional[float] = None,
    model_version: Optional[str] = None,
    mae_at_time: Optional[float] = None,
    notes: Optional[str] = None,
    mc_lower: Optional[float] = None,
    mc_upper: Optional[float] = None,
    created_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    return {
        "asset": asset,
        "model_key": model_key,
        "model_label": get_model_label(model_key),
        "prediction_type": prediction_type,
        "predicted_close": round(float(predicted_close), 4),
        "predicted_open": round(float(predicted_open), 4) if predicted_open is not None else None,
        "predicted_volume": round(float(predicted_volume), 2) if predicted_volume is not None else None,
        "predicted_change_pct": round(float(predicted_change_pct), 4) if predicted_change_pct is not None else None,
        "confidence": round(float(confidence), 2) if confidence is not None else None,
        "current_price": round(float(current_price), 4) if current_price is not None else None,
        "prediction_horizon": horizon,
        "horizon": horizon,
        "signal": signal,
        "signal_strength": round(float(signal_strength), 4) if signal_strength is not None else None,
        "model_version": model_version,
        "mae_at_time": round(float(mae_at_time), 4) if mae_at_time is not None else None,
        "mc_lower": round(float(mc_lower), 4) if mc_lower is not None else None,
        "mc_upper": round(float(mc_upper), 4) if mc_upper is not None else None,
        "notes": notes,
        "created_at": created_at or datetime.utcnow(),
    }


def build_risk_summary(levels: Optional[Dict[str, Any]]) -> Optional[Dict[str, Dict[str, Optional[float]]]]:
    if not levels:
        return None
    return {
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


def build_model_response(
    *,
    asset: str,
    model_key: str,
    status: str = "ok",
    current_price: Optional[float] = None,
    prediction: Optional[Dict[str, Any]] = None,
    predictions: Optional[Iterable[Dict[str, Any]]] = None,
    model_version: Optional[str] = None,
    prediction_type: str = "actual",
    risk: Optional[Dict[str, Any]] = None,
    uncertainty: Optional[Dict[str, Any]] = None,
    probabilities: Optional[Dict[str, Any]] = None,
    feature_importance: Optional[list[Dict[str, Any]]] = None,
    notes: Optional[str] = None,
    message: Optional[str] = None,
    reason: Optional[str] = None,
    generated_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    prediction_items = list(predictions or [])
    primary = prediction or (prediction_items[0] if prediction_items else None)
    signal_probabilities = _normalise_probabilities(probabilities)
    top_features = feature_importance or []

    payload: Dict[str, Any] = {
        "asset": asset,
        "model_key": model_key,
        "model_label": get_model_label(model_key),
        "model_type": get_model_label(model_key),
        "status": status,
        "prediction_type": prediction_type,
        "current_price": round(float(current_price), 4) if current_price is not None else None,
        "model_version": model_version,
        "version": model_version,
        "supported_horizons": get_supported_horizons(model_key),
        "prediction": primary,
        "predictions": prediction_items,
        "risk": risk,
        "uncertainty": uncertainty,
        "signal_probabilities": signal_probabilities,
        "probabilities": (
            {
                "sell": signal_probabilities["SELL"],
                "hold": signal_probabilities["HOLD"],
                "buy": signal_probabilities["BUY"],
            }
            if signal_probabilities
            else None
        ),
        "feature_importance": top_features,
        "top_features": top_features,
        "notes": notes,
        "message": message,
        "reason": reason,
        "generated_at": generated_at or datetime.utcnow(),
    }

    if primary:
        payload.update(
            {
                "signal": primary.get("signal"),
                "confidence": primary.get("confidence"),
                "predicted_close": primary.get("predicted_close"),
                "predicted_price": primary.get("predicted_close"),
                "predicted_change_pct": primary.get("predicted_change_pct"),
                "prediction_horizon": primary.get("prediction_horizon"),
                "mae_at_time": primary.get("mae_at_time"),
            }
        )
    else:
        payload.update(
            {
                "signal": None,
                "confidence": None,
                "predicted_close": None,
                "predicted_price": None,
                "predicted_change_pct": None,
                "prediction_horizon": None,
                "mae_at_time": None,
            }
        )

    by_horizon = {item.get("prediction_horizon"): item for item in prediction_items if item.get("prediction_horizon")}
    payload["prediction_1d"] = by_horizon.get("1d")
    payload["prediction_3d"] = by_horizon.get("3d")
    payload["prediction_7d"] = by_horizon.get("7d")

    if uncertainty:
        payload["confidence_lower"] = uncertainty.get("lower")
        payload["confidence_upper"] = uncertainty.get("upper")
    else:
        payload["confidence_lower"] = None
        payload["confidence_upper"] = None

    if status != "ok":
        payload["error"] = message or reason or f"{get_model_label(model_key)} is unavailable."

    return payload


def build_workspace_response(asset: str, models: Iterable[Dict[str, Any]], current_price: Optional[float] = None) -> Dict[str, Any]:
    model_items = list(models)
    return {
        "asset": asset,
        "current_price": round(float(current_price), 4) if current_price is not None else None,
        "models": model_items,
        "model_keys": [item.get("model_key") for item in model_items],
        "generated_at": datetime.utcnow(),
    }


def get_model_disk_status(asset: str, model_key: str) -> Dict[str, Any]:
    asset = asset.upper()
    model_key = model_key.lower()
    if model_key == "lightgbm":
        model_path = os.path.join(settings.MODEL_SAVE_PATH, f"lgbm_{asset.lower()}.pkl")
        return {
            "trained": os.path.exists(model_path),
            "version": "cached" if os.path.exists(model_path) else "untrained",
        }

    weights_path = os.path.join(settings.MODEL_SAVE_PATH, f"{model_key}_{asset.lower()}.weights.h5")
    meta_path = os.path.join(settings.MODEL_SAVE_PATH, f"{model_key}_{asset.lower()}_meta.txt")
    version = "untrained"
    if os.path.exists(meta_path):
        with open(meta_path) as handle:
            version = handle.read().strip() or version
    return {
        "trained": os.path.exists(weights_path),
        "version": version,
    }
