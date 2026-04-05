"""
Deep Stock Insights - LightGBM Universal Model Service

Trains and serves LightGBM classifier + regressor models for any supported
stock, crypto, or commodity symbol.
"""

import os
import pickle
import logging
from datetime import datetime
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

try:
    from lightgbm import LGBMClassifier, LGBMRegressor, early_stopping
    LIGHTGBM_AVAILABLE = True
except ImportError:
    logger.warning("lightgbm not installed — install with: pip install lightgbm")
    LIGHTGBM_AVAILABLE = False
    LGBMClassifier = None
    LGBMRegressor = None
    early_stopping = None

_model_cache: Dict[str, dict] = {}

SIGNAL_MAP = {0: "SELL", 1: "HOLD", 2: "BUY"}
SIGNAL_TO_INT = {"SELL": 0, "HOLD": 1, "BUY": 2}


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy().sort_values("timestamp").reset_index(drop=True)
    c = df["close"].astype(float)
    h = df["high"].astype(float) if "high" in df.columns else c
    lo = df["low"].astype(float) if "low" in df.columns else c
    v = df["volume"].astype(float) if "volume" in df.columns else pd.Series(np.ones(len(c)))

    feat = pd.DataFrame(index=df.index)

    for d in [1, 3, 5, 10, 20]:
        feat[f"ret_{d}d"] = c.pct_change(d)

    for p in [20, 50, 200]:
        sma = c.rolling(p).mean()
        feat[f"sma{p}_ratio"] = (c - sma) / sma.replace(0, np.nan)

    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    feat["ema_cross"] = (ema12 - ema26) / ema26.replace(0, np.nan)

    macd = ema12 - ema26
    macd_sig = macd.ewm(span=9, adjust=False).mean()
    feat["macd_hist"] = macd - macd_sig

    delta = c.diff()
    gain = delta.clip(lower=0).ewm(com=13, min_periods=14).mean()
    loss = (-delta.clip(upper=0)).ewm(com=13, min_periods=14).mean()
    feat["rsi"] = 100 - (100 / (1 + gain / loss.replace(0, np.nan)))

    low14 = lo.rolling(14).min()
    high14 = h.rolling(14).max()
    feat["stoch_k"] = 100 * (c - low14) / (high14 - low14).replace(0, np.nan)
    feat["williams_r"] = -100 * (high14 - c) / (high14 - low14).replace(0, np.nan)

    tp = (h + lo + c) / 3
    sma20 = tp.rolling(20).mean()
    mad = tp.rolling(20).apply(lambda x: np.mean(np.abs(x - x.mean())), raw=True)
    feat["cci"] = (tp - sma20) / (0.015 * mad.replace(0, np.nan))

    feat["roc10"] = c.pct_change(10) * 100

    sma20c = c.rolling(20).mean()
    std20 = c.rolling(20).std()
    bb_up = sma20c + 2 * std20
    bb_lo = sma20c - 2 * std20
    feat["bb_pct"] = (c - bb_lo) / (bb_up - bb_lo).replace(0, np.nan)

    tr = pd.concat([h - lo, (h - c.shift()).abs(), (lo - c.shift()).abs()], axis=1).max(axis=1)
    atr14 = tr.ewm(com=13, min_periods=14).mean()
    feat["atr_norm"] = atr14 / c.replace(0, np.nan)

    feat["range_pct"] = (h - lo) / c.replace(0, np.nan)
    feat["vol_chg_1d"] = v.pct_change(1)
    feat["vol_chg_5d"] = v.pct_change(5)
    obv = (np.sign(c.diff()).fillna(0) * v).cumsum()
    feat["obv_norm"] = obv / obv.abs().rolling(20).mean().replace(0, np.nan)

    return feat.replace([np.inf, -np.inf], np.nan)


def _build_labels(
    df: pd.DataFrame,
    forward_days: int = 1,
    buy_threshold: float = 0.01,
    sell_threshold: float = -0.01,
) -> Tuple[pd.Series, pd.Series]:
    c = df["close"].astype(float)
    fwd_ret = c.shift(-forward_days) / c - 1
    clf = fwd_ret.apply(
        lambda r: 2 if r > buy_threshold else (0 if r < sell_threshold else 1)
        if pd.notna(r) else np.nan
    )
    reg = c.shift(-forward_days)
    return clf, reg


def train_lightgbm(symbol: str, df: pd.DataFrame, save_dir: str = "./models") -> Dict:
    if not LIGHTGBM_AVAILABLE:
        return {"status": "error", "message": "lightgbm not installed"}

    symbol = symbol.upper()
    logger.info(f"[LGBM] Training {symbol} on {len(df)} rows")

    feat_df = _build_features(df)
    clf_labels, reg_labels = _build_labels(df)

    combined = pd.concat([feat_df, clf_labels.rename("clf"), reg_labels.rename("reg")], axis=1)
    combined = combined.replace([np.inf, -np.inf], np.nan).dropna()

    if len(combined) < 60:
        return {"status": "error", "message": f"Insufficient data: {len(combined)} rows after cleaning"}

    X = combined[feat_df.columns].values
    y_clf = combined["clf"].astype(int).values
    y_reg = combined["reg"].values

    split = int(len(X) * 0.8)
    X_tr, X_val = X[:split], X[split:]
    y_clf_tr, y_clf_val = y_clf[:split], y_clf[split:]
    y_reg_tr, y_reg_val = y_reg[:split], y_reg[split:]

    clf = LGBMClassifier(
        objective="multiclass",
        num_class=3,
        n_estimators=400,
        learning_rate=0.05,
        num_leaves=31,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=0.5,
        importance_type="gain",
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    clf.fit(
        X_tr,
        y_clf_tr,
        eval_set=[(X_val, y_clf_val)],
        eval_metric="multi_logloss",
        callbacks=[early_stopping(30, verbose=False)],
    )

    reg = LGBMRegressor(
        objective="regression",
        n_estimators=400,
        learning_rate=0.05,
        num_leaves=31,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=0.5,
        importance_type="gain",
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    reg.fit(
        X_tr,
        y_reg_tr,
        eval_set=[(X_val, y_reg_val)],
        eval_metric="l2",
        callbacks=[early_stopping(30, verbose=False)],
    )

    clf_acc = float((clf.predict(X_val) == y_clf_val).mean() * 100)
    reg_mae = float(np.mean(np.abs(reg.predict(X_val) - y_reg_val)))

    version = f"lgbm_{symbol}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}"

    os.makedirs(save_dir, exist_ok=True)
    with open(os.path.join(save_dir, f"lgbm_{symbol.lower()}.pkl"), "wb") as f:
        pickle.dump(
            {
                "clf": clf,
                "reg": reg,
                "features": list(feat_df.columns),
                "version": version,
            },
            f,
        )

    entry = {"clf": clf, "reg": reg, "features": list(feat_df.columns), "version": version}
    _model_cache[symbol] = entry

    logger.info(f"[LGBM] {symbol} trained — dir_acc={clf_acc:.1f}%, mae={reg_mae:.2f}")
    return {
        "status": "success",
        "symbol": symbol,
        "directional_accuracy": round(clf_acc, 2),
        "mae": round(reg_mae, 4),
        "training_samples": split,
        "version": version,
    }


def load_lightgbm(symbol: str, save_dir: str = "./models") -> bool:
    symbol = symbol.upper()
    path = os.path.join(save_dir, f"lgbm_{symbol.lower()}.pkl")
    if not os.path.exists(path):
        return False
    with open(path, "rb") as f:
        entry = pickle.load(f)
    _model_cache[symbol] = entry
    logger.info(f"[LGBM] Loaded {symbol} ({entry['version']})")
    return True


def get_lightgbm_model(symbol: str, save_dir: str = "./models") -> Optional[dict]:
    symbol = symbol.upper()
    if symbol not in _model_cache:
        load_lightgbm(symbol, save_dir)
    return _model_cache.get(symbol)


def predict_lightgbm(symbol: str, df: pd.DataFrame, save_dir: str = "./models") -> Dict:
    symbol = symbol.upper()
    model = get_lightgbm_model(symbol, save_dir)

    if model is None:
        return {
            "symbol": symbol,
            "status": "untrained",
            "message": "Model not trained. Trigger training first.",
        }

    clf = model["clf"]
    reg = model["reg"]
    feature_names = model["features"]

    feat_df = _build_features(df)
    latest_frame = feat_df[feature_names].replace([np.inf, -np.inf], np.nan)
    latest = latest_frame.iloc[-1:].values

    if np.any(np.isnan(latest)):
        feat_all = latest_frame.dropna()
        medians = feat_all.median().values if not feat_all.empty else np.zeros(len(feature_names))
        latest = np.where(np.isnan(latest), medians, latest)
        latest = np.nan_to_num(latest, nan=0.0, posinf=0.0, neginf=0.0)

    signal_int = int(clf.predict(latest)[0])
    raw_proba = clf.predict_proba(latest)[0]
    probability_map = {int(cls): float(prob) for cls, prob in zip(clf.classes_, raw_proba)}

    signal_probabilities = {
        "SELL": round(probability_map.get(0, 0.0) * 100, 2),
        "HOLD": round(probability_map.get(1, 0.0) * 100, 2),
        "BUY": round(probability_map.get(2, 0.0) * 100, 2),
    }

    signal = SIGNAL_MAP[signal_int]
    confidence = signal_probabilities[signal]

    predicted_price = float(reg.predict(latest)[0])
    current_price = float(df["close"].iloc[-1])
    change_pct = (predicted_price - current_price) / current_price * 100 if current_price else 0.0

    imp = clf.feature_importances_
    top5 = sorted(zip(feature_names, imp), key=lambda item: -item[1])[:5]

    return {
        "symbol": symbol,
        "status": "ok",
        "signal": signal,
        "confidence": round(confidence, 2),
        "predicted_price": round(predicted_price, 4),
        "current_price": round(current_price, 4),
        "predicted_change_pct": round(change_pct, 4),
        "signal_probabilities": signal_probabilities,
        "probabilities": {
            "sell": signal_probabilities["SELL"],
            "hold": signal_probabilities["HOLD"],
            "buy": signal_probabilities["BUY"],
        },
        "top_features": [{"feature": k, "importance": round(float(v), 4)} for k, v in top5],
        "model_version": model["version"],
    }
