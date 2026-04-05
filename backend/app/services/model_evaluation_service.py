"""
Deep Stock Insights - Model Evaluation Service

Computes walk-forward scores for:
  - N-HiTS
  - LightGBM
  - Equal-weight ensemble (N-HiTS + LightGBM)
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.config import settings
from app.services.asset_registry import has_nhits
from app.services.lightgbm_service import (
    LIGHTGBM_AVAILABLE,
    LGBMClassifier,
    LGBMRegressor,
    _build_features,
    _build_labels,
    early_stopping,
    get_lightgbm_model,
)

logger = logging.getLogger(__name__)
EVAL_CACHE_TTL_SECONDS = 900
_evaluation_cache: Dict[str, tuple[float, Dict]] = {}


@dataclass
class StepPrediction:
    date: str
    current_close: float
    predicted_close: float
    actual_close: float
    error: float
    was_correct_direction: bool


def _insufficient_df_payload(label: str, reason: str) -> Dict:
    return {
        "key": label.lower().replace("-", "").replace(" ", "_"),
        "label": label,
        "status": "unavailable",
        "reason": reason,
        "total_predictions": 0,
        "verified": 0,
        "correct_directions": 0,
        "directional_accuracy": None,
        "mae": None,
        "rmse": None,
        "mape": None,
        "comparison": [],
    }


def _metrics_from_steps(key: str, label: str, steps: List[StepPrediction], note: str) -> Dict:
    if not steps:
        return {
            "key": key,
            "label": label,
            "status": "unavailable",
            "reason": "No valid predictions were produced during the evaluation window.",
            "total_predictions": 0,
            "verified": 0,
            "correct_directions": 0,
            "directional_accuracy": None,
            "mae": None,
            "rmse": None,
            "mape": None,
            "comparison": [],
            "method": note,
        }

    predicted = np.array([step.predicted_close for step in steps], dtype=float)
    actual = np.array([step.actual_close for step in steps], dtype=float)
    correct = np.array([step.was_correct_direction for step in steps], dtype=bool)
    abs_errors = np.abs(predicted - actual)
    squared_errors = (predicted - actual) ** 2

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(squared_errors)))
    mape = float(np.mean(abs_errors / np.maximum(np.abs(actual), 1e-8)) * 100)
    directional_accuracy = float(np.mean(correct) * 100)

    comparison = [
        {
            "date": step.date,
            "current_close": round(step.current_close, 2),
            "predicted_close": round(step.predicted_close, 2),
            "actual_close": round(step.actual_close, 2),
            "error": round(step.error, 2),
            "was_correct_direction": bool(step.was_correct_direction),
        }
        for step in steps[-60:]
    ]

    return {
        "key": key,
        "label": label,
        "status": "ok",
        "reason": None,
        "total_predictions": len(steps),
        "verified": len(steps),
        "correct_directions": int(np.sum(correct)),
        "directional_accuracy": round(directional_accuracy, 2),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4),
        "comparison": comparison,
        "method": note,
    }


def _pick_latest_summary(methods: Dict[str, Dict]) -> Tuple[str, Dict]:
    preferred_order = ["ensemble", "nhits", "lightgbm"]
    available = [methods[key] for key in preferred_order if methods[key]["status"] == "ok"]
    if not available:
        return "ensemble", methods["ensemble"]

    def sort_key(entry: Dict) -> Tuple[float, float]:
        da = entry.get("directional_accuracy")
        mae = entry.get("mae")
        return (
            da if da is not None else -1.0,
            -(mae if mae is not None else 1e9),
        )

    ranked = sorted(available, key=sort_key, reverse=True)
    best = ranked[0]
    return best["key"], best


def _fit_lightgbm(train_df: pd.DataFrame):
    if not LIGHTGBM_AVAILABLE or LGBMClassifier is None or LGBMRegressor is None:
        raise RuntimeError("LightGBM is not installed in the backend environment.")

    feat_df = _build_features(train_df)
    clf_labels, reg_labels = _build_labels(train_df)
    combined = pd.concat([feat_df, clf_labels.rename("clf"), reg_labels.rename("reg")], axis=1)
    combined = combined.replace([np.inf, -np.inf], np.nan).dropna()
    if len(combined) < 60:
        raise ValueError("Not enough cleaned rows to fit LightGBM.")

    feature_names = list(feat_df.columns)
    X = combined[feature_names].values
    y_clf = combined["clf"].astype(int).values
    y_reg = combined["reg"].values
    if len(np.unique(y_clf)) < 2:
        raise ValueError("LightGBM needs at least two direction classes in the training window.")

    split = int(len(X) * 0.85)
    split = min(max(split, 40), len(X) - 5)
    X_tr, X_val = X[:split], X[split:]
    y_clf_tr, y_clf_val = y_clf[:split], y_clf[split:]
    y_reg_tr, y_reg_val = y_reg[:split], y_reg[split:]

    clf = LGBMClassifier(
        objective="multiclass",
        num_class=3,
        n_estimators=250,
        learning_rate=0.05,
        num_leaves=31,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=0.5,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    reg = LGBMRegressor(
        objective="regression",
        n_estimators=250,
        learning_rate=0.05,
        num_leaves=31,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=0.5,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )

    clf_fit_kwargs = {}
    reg_fit_kwargs = {}
    if len(X_val) >= 5:
        clf_fit_kwargs = {
            "eval_set": [(X_val, y_clf_val)],
            "eval_metric": "multi_logloss",
            "callbacks": [early_stopping(20, verbose=False)],
        }
        reg_fit_kwargs = {
            "eval_set": [(X_val, y_reg_val)],
            "eval_metric": "l2",
            "callbacks": [early_stopping(20, verbose=False)],
        }

    clf.fit(X_tr, y_clf_tr, **clf_fit_kwargs)
    reg.fit(X_tr, y_reg_tr, **reg_fit_kwargs)

    medians = combined[feature_names].median().values
    return clf, reg, feature_names, medians


def _cache_key(asset: str, period: str, df: pd.DataFrame) -> str:
    latest_ts = pd.to_datetime(df["timestamp"].iloc[-1]).strftime("%Y-%m-%dT%H:%M:%S")
    return f"{asset}:{period}:{len(df)}:{latest_ts}"


def _get_cached_evaluation(key: str) -> Optional[Dict]:
    entry = _evaluation_cache.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def _set_cached_evaluation(key: str, payload: Dict):
    _evaluation_cache[key] = (time.monotonic() + EVAL_CACHE_TTL_SECONDS, payload)


def _step_prediction(date: str, current_close: float, predicted_close: float, actual_close: float) -> StepPrediction:
    return StepPrediction(
        date=date,
        current_close=current_close,
        predicted_close=predicted_close,
        actual_close=actual_close,
        error=abs(predicted_close - actual_close),
        was_correct_direction=(predicted_close > current_close) == (actual_close > current_close),
    )


def _recent_window(df: pd.DataFrame) -> tuple[int, int]:
    test_window = min(settings.MODEL_EVAL_TEST_WINDOW, max(15, len(df) // 6))
    start_idx = max(settings.MODEL_LOOKBACK_WINDOW + 1, len(df) - test_window)
    return start_idx, len(df) - start_idx


def _has_saved_nhits_artifacts(asset: str) -> bool:
    weights_path = os.path.join(settings.MODEL_SAVE_PATH, f"nhits_{asset.lower()}.weights.h5")
    proc_path = os.path.join(settings.MODEL_SAVE_PATH, f"preprocessor_{asset.lower()}.pkl")
    return os.path.exists(weights_path) and os.path.exists(proc_path)


def _evaluate_saved_nhits(df: pd.DataFrame, asset: str) -> tuple[List[StepPrediction], Optional[str]]:
    if not has_nhits(asset):
        return [], "N-HiTS is currently enabled only for featured assets."
    if not _has_saved_nhits_artifacts(asset):
        return [], f"No trained N-HiTS artifacts were found for {asset}."

    try:
        from app.ml.nhits_model import get_model
        from app.services.prediction_service import get_preprocessor
    except Exception as exc:
        return [], f"N-HiTS unavailable: {exc}"

    proc = get_preprocessor(asset)
    if not proc.fitted:
        return [], f"Preprocessor for {asset} is not fitted."

    model = get_model(asset, n_features=len(proc.feature_names))
    if not model.is_trained:
        return [], f"N-HiTS weights for {asset} are not loaded."

    start_idx, _ = _recent_window(df)
    steps: List[StepPrediction] = []
    failure_reason = None

    for idx in range(start_idx, len(df)):
        step_df = df.iloc[:idx].copy()
        actual_close = float(df["close"].iloc[idx])
        current_close = float(df["close"].iloc[idx - 1])
        date_str = pd.to_datetime(df["timestamp"].iloc[idx]).strftime("%Y-%m-%d")
        try:
            X_inf = proc.transform(step_df)
            scaled_pred = model.predict(X_inf)
            real_pred = proc.inverse_transform_targets(scaled_pred)
            steps.append(_step_prediction(date_str, current_close, float(real_pred[0, 0]), actual_close))
        except Exception as exc:
            failure_reason = failure_reason or str(exc)
            logger.warning(f"[{asset}] Saved N-HiTS benchmark step failed on {date_str}: {exc}")

    if steps:
        return steps, None
    return [], failure_reason or "Saved N-HiTS model could not generate benchmark predictions."


def _evaluate_lightgbm_holdout(df: pd.DataFrame, asset: str) -> tuple[List[StepPrediction], Optional[str]]:
    start_idx, test_window = _recent_window(df)
    train_df = df.iloc[:start_idx].copy()
    if len(train_df) < 80:
        return [], "Not enough training rows to benchmark LightGBM."

    try:
        model = _model_from_cache_or_fit(asset, train_df)
    except Exception as exc:
        return [], str(exc)

    clf = model["clf"]
    reg = model["reg"]
    feature_names = model["features"]
    medians = model["medians"]

    steps: List[StepPrediction] = []
    for idx in range(start_idx, len(df)):
        step_df = df.iloc[:idx].copy()
        actual_close = float(df["close"].iloc[idx])
        current_close = float(df["close"].iloc[idx - 1])
        date_str = pd.to_datetime(df["timestamp"].iloc[idx]).strftime("%Y-%m-%d")

        try:
            feat_df = _build_features(step_df)
            latest = feat_df[feature_names].replace([np.inf, -np.inf], np.nan).iloc[-1:].values
            latest = np.where(np.isnan(latest), medians, latest)
            latest = np.nan_to_num(latest, nan=0.0, posinf=0.0, neginf=0.0)
            predicted_close = float(reg.predict(latest)[0])
            steps.append(_step_prediction(date_str, current_close, predicted_close, actual_close))
        except Exception as exc:
            logger.warning(f"[{asset}] LightGBM benchmark step failed on {date_str}: {exc}")

    if steps:
        return steps, None
    return [], "LightGBM could not generate benchmark predictions."


def _model_from_cache_or_fit(asset: str, train_df: pd.DataFrame) -> Dict:
    cached = get_lightgbm_model(asset, settings.MODEL_SAVE_PATH)
    if cached is not None:
        feature_names = list(cached["features"])
        feat_train = _build_features(train_df)[feature_names].replace([np.inf, -np.inf], np.nan)
        clean = feat_train.dropna()
        medians = clean.median().values if not clean.empty else np.zeros(len(feature_names))
        return {
            "clf": cached["clf"],
            "reg": cached["reg"],
            "features": feature_names,
            "medians": medians,
        }

    clf, reg, feature_names, medians = _fit_lightgbm(train_df)
    return {
        "clf": clf,
        "reg": reg,
        "features": feature_names,
        "medians": medians,
    }


def _ensemble_from_steps(nhits_steps: List[StepPrediction], lightgbm_steps: List[StepPrediction]) -> List[StepPrediction]:
    nhits_by_date = {step.date: step for step in nhits_steps}
    ensemble_steps: List[StepPrediction] = []
    for step in lightgbm_steps:
        peer = nhits_by_date.get(step.date)
        if peer is None:
            continue
        predicted_close = (peer.predicted_close + step.predicted_close) / 2.0
        ensemble_steps.append(
            _step_prediction(step.date, step.current_close, predicted_close, step.actual_close)
        )
    return ensemble_steps


def evaluate_model_stack(df: pd.DataFrame, asset: str, period: str = "1y") -> Dict:
    df = df.copy().reset_index(drop=True)
    if df.empty or len(df) < max(80, settings.MODEL_LOOKBACK_WINDOW + 30):
        reason = "Insufficient data for model benchmark analysis."
        unavailable = _insufficient_df_payload("N-HiTS", reason)
        return {
            "asset": asset,
            "period": period,
            "methods": {
                "nhits": unavailable,
                "lightgbm": _insufficient_df_payload("LightGBM", reason),
                "ensemble": _insufficient_df_payload("Ensemble", reason),
            },
            "leaderboard": [],
            "best_method": None,
            "best_method_label": None,
            "selected_method": "ensemble",
            "total_predictions": 0,
            "verified": 0,
            "correct_directions": 0,
            "mae": None,
            "rmse": None,
            "mape": None,
            "directional_accuracy": None,
            "comparison": [],
            "method": reason,
            "generated_at": datetime.utcnow().isoformat(),
        }

    cache_key = _cache_key(asset, period, df)
    cached = _get_cached_evaluation(cache_key)
    if cached is not None:
        return cached

    start_idx, test_window = _recent_window(df)
    nhits_steps, nhits_reason = _evaluate_saved_nhits(df, asset)
    lightgbm_steps, lightgbm_reason = _evaluate_lightgbm_holdout(df, asset)
    ensemble_steps = _ensemble_from_steps(nhits_steps, lightgbm_steps)

    note = (
        f"Recent holdout benchmark over the last {test_window} sessions using "
        f"saved/current models without retraining on every request."
    )

    methods = {
        "nhits": _metrics_from_steps("nhits", "N-HiTS", nhits_steps, note),
        "lightgbm": _metrics_from_steps("lightgbm", "LightGBM", lightgbm_steps, note),
        "ensemble": _metrics_from_steps("ensemble", "Ensemble", ensemble_steps, note),
    }

    if methods["nhits"]["status"] != "ok" and nhits_reason:
        methods["nhits"]["reason"] = nhits_reason
    if methods["lightgbm"]["status"] != "ok" and lightgbm_reason:
        methods["lightgbm"]["reason"] = lightgbm_reason
    if methods["ensemble"]["status"] != "ok" and not methods["ensemble"]["reason"]:
        methods["ensemble"]["reason"] = "Ensemble requires valid N-HiTS and LightGBM predictions on the same dates."

    leaderboard = [
        {
            "key": method["key"],
            "label": method["label"],
            "directional_accuracy": method["directional_accuracy"],
            "mae": method["mae"],
            "rmse": method["rmse"],
            "mape": method["mape"],
            "total_predictions": method["total_predictions"],
        }
        for method in methods.values()
        if method["status"] == "ok"
    ]
    leaderboard.sort(
        key=lambda item: (
            item["directional_accuracy"] if item["directional_accuracy"] is not None else -1.0,
            -(item["mae"] if item["mae"] is not None else 1e9),
        ),
        reverse=True,
    )

    best_key, best_method = _pick_latest_summary(methods)
    payload = {
        "asset": asset,
        "period": period,
        "methods": methods,
        "leaderboard": leaderboard,
        "best_method": best_method["key"] if best_method["status"] == "ok" else None,
        "best_method_label": best_method["label"] if best_method["status"] == "ok" else None,
        "generated_at": datetime.utcnow().isoformat(),
    }

    # Compatibility fields consumed by older pages.
    payload.update(
        {
            "total_predictions": best_method.get("total_predictions", 0),
            "verified": best_method.get("verified", 0),
            "correct_directions": best_method.get("correct_directions", 0),
            "mae": best_method.get("mae"),
            "rmse": best_method.get("rmse"),
            "mape": best_method.get("mape"),
            "directional_accuracy": best_method.get("directional_accuracy"),
            "comparison": best_method.get("comparison", []),
            "method": best_method.get("method"),
            "selected_method": best_key,
        }
    )

    _set_cached_evaluation(cache_key, payload)
    return payload
