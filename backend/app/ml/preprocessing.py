"""
Deep Stock Insights - Data Preprocessing Pipeline (v2)
Preprocessing pipeline:
  - MinMax scaling to [0, 1]
  - 60-day sliding window sequences
  - Multi-output targets: close price + volume
  - Enhanced feature set: 18 technical indicator features
  - Train / validation split (80/20, no shuffle — preserves time order)
"""

import numpy as np
import pandas as pd
import pickle
import os
import logging
from sklearn.preprocessing import MinMaxScaler
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


FEATURES = ["close", "open", "high", "low", "volume"]
ENHANCED_FEATURES = [
    # Price
    "close", "open", "high", "low", "volume",
    # Returns
    "returns_1d", "returns_5d", "returns_10d",
    # Momentum
    "rsi_14", "stoch_k", "momentum_10", "roc_5",
    # Trend
    "macd_hist", "sma_cross", "price_vs_sma20", "price_vs_sma50",
    # Volatility
    "bb_pct", "atr_norm",
    # Volume
    "vol_ratio",
]
TARGETS = ["close", "volume"]          # multi-output matching the report


def _add_technical_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived technical indicator features for the LSTM model."""
    df = df.copy()
    c = df["close"].astype(float)
    h = df["high"].astype(float) if "high" in df.columns else c
    lo = df["low"].astype(float) if "low" in df.columns else c
    v = df["volume"].astype(float) if "volume" in df.columns else pd.Series(1.0, index=df.index)

    # Price returns (multiple timeframes)
    df["returns_1d"] = c.pct_change(1).fillna(0)
    df["returns_5d"] = c.pct_change(5).fillna(0)
    df["returns_10d"] = c.pct_change(10).fillna(0)

    # RSI (14)
    delta = c.diff()
    gain = delta.clip(lower=0).ewm(com=13, min_periods=14).mean()
    loss = (-delta.clip(upper=0)).ewm(com=13, min_periods=14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi_14"] = (100 - (100 / (1 + rs))).fillna(50) / 100  # normalise to [0, 1]

    # Stochastic %K (14, 3)
    low14 = lo.rolling(14).min()
    high14 = h.rolling(14).max()
    df["stoch_k"] = ((c - low14) / (high14 - low14).replace(0, np.nan)).fillna(0.5)

    # Momentum (10-day)
    df["momentum_10"] = (c / c.shift(10).replace(0, np.nan) - 1).fillna(0)

    # Rate of change (5-day)
    df["roc_5"] = c.pct_change(5).fillna(0)

    # MACD histogram (normalised)
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    df["macd_hist"] = ((macd - signal) / c.replace(0, 1)).fillna(0)

    # SMA crossover signal (SMA20 vs SMA50, normalised)
    sma20 = c.rolling(20).mean()
    sma50 = c.rolling(50).mean()
    df["sma_cross"] = ((sma20 - sma50) / c.replace(0, 1)).fillna(0)

    # Price position relative to SMAs (normalised distance)
    df["price_vs_sma20"] = ((c - sma20) / c.replace(0, 1)).fillna(0)
    df["price_vs_sma50"] = ((c - sma50) / c.replace(0, 1)).fillna(0)

    # Bollinger %B
    std20 = c.rolling(20).std()
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    df["bb_pct"] = ((c - bb_lower) / (bb_upper - bb_lower).replace(0, np.nan)).fillna(0.5)

    # ATR normalised
    tr = pd.concat([h - lo, (h - c.shift()).abs(), (lo - c.shift()).abs()], axis=1).max(axis=1)
    atr14 = tr.ewm(com=13, min_periods=14).mean()
    df["atr_norm"] = (atr14 / c.replace(0, 1)).fillna(0)

    # Volume ratio (current / 20-day avg)
    vol_avg = v.rolling(20).mean().replace(0, 1)
    df["vol_ratio"] = (v / vol_avg).fillna(1).clip(0, 10)

    return df


class StockPreprocessor:
    """
    Handles all data preprocessing for the LSTM model.
    One preprocessor instance per asset because scalers
    are fit on that asset's training data and must be saved alongside
    the model weights.
    """

    def __init__(self, lookback: int = 50, use_enhanced: bool = True):
        self.lookback = lookback
        self.feature_scaler = MinMaxScaler(feature_range=(0, 1))
        self.target_scaler = MinMaxScaler(feature_range=(0, 1))
        self.fitted = False
        self.use_enhanced = use_enhanced
        self.feature_names = ENHANCED_FEATURES if use_enhanced else FEATURES
        self.target_names = TARGETS

    # ─────────────────────────────────────────────────────────
    #  Fit + Transform
    # ─────────────────────────────────────────────────────────

    def fit_transform(
        self,
        df: pd.DataFrame,
        val_split: float = 0.2,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Fit scalers on training data and return (X_train, y_train, X_val, y_val).
        Sequences are shaped [samples, lookback, n_features].
        Targets are shaped [samples, n_targets].
        """
        df = self._prepare_df(df)
        split_idx = int(len(df) * (1 - val_split))

        train_df = df.iloc[:split_idx]
        val_df = df.iloc[split_idx - self.lookback:]   # include lookback overlap for sequences

        # Fit only on train
        features_train = self.feature_scaler.fit_transform(train_df[self.feature_names])
        targets_train = self.target_scaler.fit_transform(train_df[self.target_names])
        self.fitted = True

        # Transform validation
        features_val = self.feature_scaler.transform(val_df[self.feature_names])
        targets_val = self.target_scaler.transform(val_df[self.target_names])

        X_train, y_train = self._make_sequences(features_train, targets_train)
        X_val, y_val = self._make_sequences(features_val, targets_val)

        logger.info(
            f"Preprocessed: X_train={X_train.shape}, X_val={X_val.shape}, features={len(self.feature_names)}"
        )
        return X_train, y_train, X_val, y_val

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Transform raw OHLCV into the most recent inference window.
        Returns array of shape [1, lookback, n_features].
        """
        if not self.fitted:
            raise RuntimeError("Preprocessor must be fit before transform. Call fit_transform first.")
        df = self._prepare_df(df)
        if len(df) < self.lookback:
            raise ValueError(
                f"Need at least {self.lookback} rows for inference, got {len(df)}"
            )
        recent = df[self.feature_names].iloc[-self.lookback:]
        scaled = self.feature_scaler.transform(recent)
        return scaled.reshape(1, self.lookback, len(self.feature_names))

    def inverse_transform_targets(self, scaled: np.ndarray) -> np.ndarray:
        """
        Convert scaled model outputs back to real-world units.
        `scaled` has shape [n, n_targets].
        """
        return self.target_scaler.inverse_transform(scaled)

    # ─────────────────────────────────────────────────────────
    #  Helpers
    # ─────────────────────────────────────────────────────────

    def _prepare_df(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate, fill missing values, add features, and select required columns."""
        df = df.copy()

        # Fill missing OHLCV with close (safe fallback for crypto which may lack some fields)
        for col in FEATURES:
            if col not in df.columns:
                df[col] = df["close"] if col != "volume" else 1.0
            df[col] = df[col].ffill().bfill().fillna(0)

        # Add derived technical indicator features if enabled
        if self.use_enhanced:
            df = _add_technical_features(df)

        # Final fill for any remaining NaN in feature columns
        for col in self.feature_names:
            if col in df.columns:
                df[col] = df[col].ffill().bfill().fillna(0)

        return df.sort_index().reset_index(drop=True)

    def _make_sequences(
        self,
        features: np.ndarray,
        targets: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Build sliding-window sequences from scaled arrays."""
        X, y = [], []
        for i in range(self.lookback, len(features)):
            X.append(features[i - self.lookback: i])
            y.append(targets[i])
        return np.array(X), np.array(y)

    # ─────────────────────────────────────────────────────────
    #  Persistence
    # ─────────────────────────────────────────────────────────

    def save(self, path: str):
        """Pickle the scaler pair to disk."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"feature_scaler": self.feature_scaler,
                         "target_scaler": self.target_scaler,
                         "lookback": self.lookback,
                         "fitted": self.fitted,
                         "use_enhanced": self.use_enhanced,
                         "feature_names": self.feature_names}, f)
        logger.info(f"Preprocessor saved → {path}")

    def load(self, path: str):
        """Restore scaler pair from disk."""
        with open(path, "rb") as f:
            state = pickle.load(f)
        self.feature_scaler = state["feature_scaler"]
        self.target_scaler = state["target_scaler"]
        self.lookback = state["lookback"]
        self.fitted = state["fitted"]
        self.use_enhanced = state.get("use_enhanced", False)
        self.feature_names = state.get("feature_names", FEATURES)
        logger.info(f"Preprocessor loaded ← {path} (features={len(self.feature_names)})")
