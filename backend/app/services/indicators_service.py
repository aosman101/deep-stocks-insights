"""
Deep Stock Insights - Technical Indicators Service
Computes all indicators from OHLCV DataFrames.

Indicators implemented:
  Moving Averages : SMA(20/50/200), EMA(12/26/50), WMA(20)
  Momentum        : RSI(14), Stochastic(14,3), Williams %R, CCI(20), Momentum(10), ROC(10)
  Trend           : MACD(12,26,9), ADX(14), Aroon(25)
  Volatility      : Bollinger Bands(20,2), ATR(14), Keltner Channels(20,2)
  Volume          : OBV, VWAP, MFI(14)
  Other           : Line of Best Fit (linear regression), Pivot Points, Fibonacci Levels
"""

import logging
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Optional
from scipy import stats

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
#  Low-level indicator functions
# ─────────────────────────────────────────────────────────────

def sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period, min_periods=period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def wma(series: pd.Series, period: int) -> pd.Series:
    weights = np.arange(1, period + 1)
    return series.rolling(period).apply(lambda x: np.dot(x, weights) / weights.sum(), raw=True)


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def stochastic(high: pd.Series, low: pd.Series, close: pd.Series,
               k_period: int = 14, d_period: int = 3):
    lowest_low = low.rolling(k_period).min()
    highest_high = high.rolling(k_period).max()
    k = 100 * (close - lowest_low) / (highest_high - lowest_low).replace(0, np.nan)
    d = k.rolling(d_period).mean()
    return k, d


def williams_r(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    highest_high = high.rolling(period).max()
    lowest_low = low.rolling(period).min()
    return -100 * (highest_high - close) / (highest_high - lowest_low).replace(0, np.nan)


def cci(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 20) -> pd.Series:
    tp = (high + low + close) / 3
    sma_tp = tp.rolling(period).mean()
    mad = tp.rolling(period).apply(lambda x: np.mean(np.abs(x - x.mean())), raw=True)
    return (tp - sma_tp) / (0.015 * mad.replace(0, np.nan))


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = ema(close, fast)
    ema_slow = ema(close, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low - close.shift()).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(com=period - 1, min_periods=period).mean()


def bollinger_bands(close: pd.Series, period: int = 20, std_dev: float = 2.0):
    middle = sma(close, period)
    std = close.rolling(period).std()
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    width = (upper - lower) / middle.replace(0, np.nan)
    pct = (close - lower) / (upper - lower).replace(0, np.nan)
    return upper, middle, lower, width, pct


def keltner_channels(high: pd.Series, low: pd.Series, close: pd.Series,
                     period: int = 20, multiplier: float = 2.0):
    middle = ema(close, period)
    atr_val = atr(high, low, close, period)
    upper = middle + multiplier * atr_val
    lower = middle - multiplier * atr_val
    return upper, lower


def adx_components(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14):
    tr = atr(high, low, close, 1)
    dm_plus = high.diff().clip(lower=0)
    dm_minus = (-low.diff()).clip(lower=0)
    dm_plus = dm_plus.where(dm_plus > dm_minus, 0)
    dm_minus = dm_minus.where(dm_minus > dm_plus, 0)

    atr_val = tr.ewm(com=period - 1, min_periods=period).mean()
    di_plus = 100 * dm_plus.ewm(com=period - 1, min_periods=period).mean() / atr_val.replace(0, np.nan)
    di_minus = 100 * dm_minus.ewm(com=period - 1, min_periods=period).mean() / atr_val.replace(0, np.nan)

    dx = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus).replace(0, np.nan)
    adx_val = dx.ewm(com=period - 1, min_periods=period).mean()
    return adx_val, di_plus, di_minus


def adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    adx_val, _, _ = adx_components(high, low, close, period)
    return adx_val


def aroon(high: pd.Series, low: pd.Series, period: int = 25):
    aroon_up = high.rolling(period + 1).apply(lambda x: float(np.argmax(x)) / period * 100, raw=True)
    aroon_down = low.rolling(period + 1).apply(lambda x: float(np.argmin(x)) / period * 100, raw=True)
    return aroon_up, aroon_down


def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    direction = np.sign(close.diff()).fillna(0)
    return (direction * volume).cumsum()


def vwap(high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series) -> pd.Series:
    tp = (high + low + close) / 3
    return (tp * volume).cumsum() / volume.cumsum().replace(0, np.nan)


def mfi(high: pd.Series, low: pd.Series, close: pd.Series,
        volume: pd.Series, period: int = 14) -> pd.Series:
    tp = (high + low + close) / 3
    mf = tp * volume
    pos_mf = mf.where(tp > tp.shift(1), 0)
    neg_mf = mf.where(tp < tp.shift(1), 0)
    pos_mf_sum = pos_mf.rolling(period).sum()
    neg_mf_sum = neg_mf.rolling(period).sum()
    mfr = pos_mf_sum / neg_mf_sum.replace(0, np.nan)
    return 100 - (100 / (1 + mfr))


def line_of_best_fit(close: pd.Series, window: int = 50):
    """
    Fit a linear regression to the most recent `window` close prices.
    Returns slope, R², and the predicted next value.
    """
    if len(close) < window:
        return None, None, None
    recent = close.iloc[-window:].values
    x = np.arange(len(recent))
    slope, intercept, r_value, p_value, std_err = stats.linregress(x, recent)
    predicted_next = slope * len(recent) + intercept
    return float(slope), float(r_value ** 2), float(predicted_next)


def momentum(close: pd.Series, period: int = 10) -> pd.Series:
    return close - close.shift(period)


def roc(close: pd.Series, period: int = 10) -> pd.Series:
    return ((close - close.shift(period)) / close.shift(period).replace(0, np.nan)) * 100


def pivot_points(high: float, low: float, close: float) -> Dict[str, float]:
    """Classic floor pivot points for the latest candle."""
    pp = (high + low + close) / 3
    r1 = 2 * pp - low
    s1 = 2 * pp - high
    r2 = pp + (high - low)
    s2 = pp - (high - low)
    r3 = high + 2 * (pp - low)
    s3 = low - 2 * (high - pp)
    return {"pp": pp, "r1": r1, "r2": r2, "r3": r3, "s1": s1, "s2": s2, "s3": s3}


def fibonacci_levels(swing_high: float, swing_low: float) -> Dict[str, float]:
    """Fibonacci retracement levels from a swing high/low."""
    diff = swing_high - swing_low
    return {
        "0.0%": swing_high,
        "23.6%": swing_high - 0.236 * diff,
        "38.2%": swing_high - 0.382 * diff,
        "50.0%": swing_high - 0.500 * diff,
        "61.8%": swing_high - 0.618 * diff,
        "78.6%": swing_high - 0.786 * diff,
        "100.0%": swing_low,
    }


# ─────────────────────────────────────────────────────────────
#  Signal scoring
# ─────────────────────────────────────────────────────────────

def _score_signal(signals: list) -> tuple:
    """Count bullish/bearish signals and return overall bias."""
    bullish = sum(1 for s in signals if s == "BULLISH")
    bearish = sum(1 for s in signals if s == "BEARISH")
    if bullish > bearish + 1:
        overall = "BULLISH"
    elif bearish > bullish + 1:
        overall = "BEARISH"
    else:
        overall = "NEUTRAL"
    return overall, bullish, bearish


# ─────────────────────────────────────────────────────────────
#  Main public function
# ─────────────────────────────────────────────────────────────

def compute_indicators(df: pd.DataFrame) -> Dict:
    """
    Given a DataFrame with columns [timestamp, open, high, low, close, volume],
    compute all technical indicators and return a structured dict
    matching the TechnicalIndicators schema.
    """
    if df.empty or len(df) < 20:
        return {"error": "Insufficient data for indicator calculation (need ≥ 20 rows)"}

    # Ensure correct types
    close = df["close"].astype(float)
    high = df["high"].astype(float) if "high" in df.columns else close
    low = df["low"].astype(float) if "low" in df.columns else close
    vol = df["volume"].astype(float) if "volume" in df.columns else pd.Series(np.ones(len(close)))
    vol = vol.fillna(1.0)
    ts = df["timestamp"].iloc[-1]
    current_price = float(close.iloc[-1])

    def last(series: pd.Series) -> Optional[float]:
        val = series.iloc[-1]
        if pd.notna(val) and np.isfinite(val):
            return round(float(val), 6)
        return None

    # --- Moving Averages ---
    sma20 = last(sma(close, 20))
    sma50 = last(sma(close, 50)) if len(close) >= 50 else None
    sma200 = last(sma(close, 200)) if len(close) >= 200 else None
    ema12 = last(ema(close, 12))
    ema26 = last(ema(close, 26))
    ema50 = last(ema(close, 50)) if len(close) >= 50 else None
    wma20 = last(wma(close, 20))

    # --- Momentum ---
    rsi14 = last(rsi(close, 14))
    stoch_k_s, stoch_d_s = stochastic(high, low, close)
    stoch_k_val = last(stoch_k_s)
    stoch_d_val = last(stoch_d_s)
    wr = last(williams_r(high, low, close))
    cci20 = last(cci(high, low, close, 20))
    mom10 = last(momentum(close, 10))
    roc10 = last(roc(close, 10))

    # --- Trend ---
    macd_line, macd_sig, macd_hist = macd(close)
    macd_val = last(macd_line)
    macd_signal_val = last(macd_sig)
    macd_hist_val = last(macd_hist)
    adx14 = last(adx(high, low, close, 14)) if len(close) >= 28 else None
    aroon_up_s, aroon_down_s = aroon(high, low, 25) if len(close) >= 26 else (None, None)
    aroon_up_val = last(aroon_up_s) if aroon_up_s is not None else None
    aroon_down_val = last(aroon_down_s) if aroon_down_s is not None else None

    # --- Volatility ---
    bb_upper_s, bb_mid_s, bb_lower_s, bb_width_s, bb_pct_s = bollinger_bands(close)
    bb_upper_val = last(bb_upper_s)
    bb_mid_val = last(bb_mid_s)
    bb_lower_val = last(bb_lower_s)
    bb_width_val = last(bb_width_s)
    bb_pct_val = last(bb_pct_s)
    atr14 = last(atr(high, low, close, 14))
    kc_upper_s, kc_lower_s = keltner_channels(high, low, close)
    kc_upper_val = last(kc_upper_s)
    kc_lower_val = last(kc_lower_s)

    # --- Volume ---
    obv_val = last(obv(close, vol))
    vwap_val = last(vwap(high, low, close, vol))
    mfi14 = last(mfi(high, low, close, vol, 14)) if len(close) >= 14 else None

    # --- Line of Best Fit ---
    window = min(50, len(close))
    lobf_slope, lobf_r2, lobf_next = line_of_best_fit(close, window)

    # ─── Signal Scoring ───────────────────────────────────────
    signals = []
    # RSI
    if rsi14 is not None:
        signals.append("BULLISH" if rsi14 < 50 else "BEARISH")
    # MACD
    if macd_val is not None and macd_signal_val is not None:
        signals.append("BULLISH" if macd_val > macd_signal_val else "BEARISH")
    # Price vs SMA20
    if sma20:
        signals.append("BULLISH" if current_price > sma20 else "BEARISH")
    # Price vs SMA50
    if sma50:
        signals.append("BULLISH" if current_price > sma50 else "BEARISH")
    # Stochastic
    if stoch_k_val is not None:
        signals.append("BULLISH" if stoch_k_val < 50 else "BEARISH")
    # Bollinger %B
    if bb_pct_val is not None:
        signals.append("BULLISH" if bb_pct_val < 0.5 else "BEARISH")
    # Williams %R
    if wr is not None:
        signals.append("BULLISH" if wr < -50 else "BEARISH")

    overall, bull_count, bear_count = _score_signal(signals)

    return {
        "asset": None,  # filled by caller
        "current_price": current_price,
        "timestamp": ts,

        "sma_20": sma20,
        "sma_50": sma50,
        "sma_200": sma200,
        "ema_12": ema12,
        "ema_26": ema26,
        "ema_50": ema50,
        "wma_20": wma20,

        "rsi_14": rsi14,
        "stoch_k": stoch_k_val,
        "stoch_d": stoch_d_val,
        "williams_r": wr,
        "cci_20": cci20,
        "momentum_10": mom10,
        "roc_10": roc10,

        "macd": macd_val,
        "macd_signal": macd_signal_val,
        "macd_histogram": macd_hist_val,
        "adx_14": adx14,
        "aroon_up": aroon_up_val,
        "aroon_down": aroon_down_val,

        "bb_upper": bb_upper_val,
        "bb_middle": bb_mid_val,
        "bb_lower": bb_lower_val,
        "bb_width": bb_width_val,
        "bb_percent": bb_pct_val,
        "atr_14": atr14,
        "keltner_upper": kc_upper_val,
        "keltner_lower": kc_lower_val,

        "obv": obv_val,
        "vwap": vwap_val,
        "mfi_14": mfi14,

        "lobf_slope": round(lobf_slope, 6) if lobf_slope else None,
        "lobf_r2": round(lobf_r2, 4) if lobf_r2 else None,
        "lobf_predicted_next": round(lobf_next, 4) if lobf_next else None,

        "overall_signal": overall,
        "bullish_count": bull_count,
        "bearish_count": bear_count,

        # Pivot points and Fibonacci (from latest candle)
        "pivot_points": pivot_points(float(high.iloc[-1]), float(low.iloc[-1]), current_price),
        "fibonacci": fibonacci_levels(float(high.max()), float(low.min())),
    }


def compute_correlation_matrix(df: pd.DataFrame) -> Optional[Dict]:
    """
    Compute a correlation matrix between key price/indicator series.
    Returns { labels: [...], values: [[...], ...] } for the frontend heatmap.
    """
    if df.empty or len(df) < 30:
        return None

    close = df["close"].astype(float)
    high = df["high"].astype(float) if "high" in df.columns else close
    low = df["low"].astype(float) if "low" in df.columns else close
    vol = df["volume"].astype(float) if "volume" in df.columns else pd.Series(np.ones(len(close)))

    series_dict = {
        "Close": close,
        "Volume": vol.fillna(0),
        "RSI": rsi(close, 14),
        "SMA20": sma(close, 20),
        "EMA12": ema(close, 12),
        "ATR": atr(high, low, close, 14),
        "OBV": obv(close, vol.fillna(0)),
    }

    corr_df = pd.DataFrame(series_dict)
    corr_df = corr_df.dropna(axis=1, how="all")
    corr_df = corr_df.loc[:, corr_df.nunique(dropna=True) > 1]
    corr_df = corr_df.dropna()
    if len(corr_df) < 20 or corr_df.shape[1] < 2:
        return None

    corr_matrix = corr_df.corr()
    labels = list(corr_matrix.columns)
    values = [[round(float(v), 4) for v in row] for row in corr_matrix.values]

    return {"labels": labels, "values": values}


def compute_indicator_series(df: pd.DataFrame) -> list[Dict]:
    """
    Return a point-by-point indicator series aligned with the OHLCV rows.
    This powers the graph-analysis page overlays and sub-charts.
    """
    if df.empty:
        return []

    close = df["close"].astype(float)
    high = df["high"].astype(float) if "high" in df.columns else close
    low = df["low"].astype(float) if "low" in df.columns else close
    vol = df["volume"].astype(float) if "volume" in df.columns else pd.Series(np.ones(len(close)))
    vol = vol.fillna(1.0)

    sma20_s = sma(close, 20)
    sma50_s = sma(close, 50)
    ema20_s = ema(close, 20)
    rsi14_s = rsi(close, 14)
    stoch_k_s, stoch_d_s = stochastic(high, low, close)
    macd_line, macd_sig, macd_hist = macd(close)
    adx14_s, plus_di_s, minus_di_s = adx_components(high, low, close, 14)
    atr14_s = atr(high, low, close, 14)
    wr_s = williams_r(high, low, close)
    cci20_s = cci(high, low, close, 20)
    bb_upper_s, _, bb_lower_s, _, _ = bollinger_bands(close)
    obv_s = obv(close, vol)

    def _safe_val(series, i):
        v = series.iloc[i]
        if pd.notna(v) and np.isfinite(v):
            return round(float(v), 6)
        return None

    records = []
    for i, row in df.reset_index(drop=True).iterrows():
        record = {
            "timestamp": row["timestamp"],
            "sma_20": _safe_val(sma20_s, i),
            "sma_50": _safe_val(sma50_s, i),
            "ema_20": _safe_val(ema20_s, i),
            "rsi_14": _safe_val(rsi14_s, i),
            "stoch_k": _safe_val(stoch_k_s, i),
            "stoch_d": _safe_val(stoch_d_s, i),
            "macd": _safe_val(macd_line, i),
            "macd_signal": _safe_val(macd_sig, i),
            "macd_histogram": _safe_val(macd_hist, i),
            "adx_14": _safe_val(adx14_s, i),
            "plus_di": _safe_val(plus_di_s, i),
            "minus_di": _safe_val(minus_di_s, i),
            "atr_14": _safe_val(atr14_s, i),
            "williams_r": _safe_val(wr_s, i),
            "cci_20": _safe_val(cci20_s, i),
            "bb_upper": _safe_val(bb_upper_s, i),
            "bb_lower": _safe_val(bb_lower_s, i),
            "obv": _safe_val(obv_s, i),
        }
        records.append(record)

    return records
