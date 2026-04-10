"""
Deep Stock Insights - Twelve Data Integration Service
Provides real-time quotes, time series, technical indicators, and forex rates
via the Twelve Data API.

Requires TWELVE_DATA_API_KEY in .env.
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

import httpx
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

TWELVE_BASE = "https://api.twelvedata.com"


def _api_key() -> str:
    key = settings.TWELVE_DATA_API_KEY
    if not key:
        raise ValueError("TWELVE_DATA_API_KEY is not configured. Add it to your .env file.")
    return key


async def _get(endpoint: str, params: dict | None = None) -> dict | list:
    """Make an authenticated GET request to Twelve Data."""
    params = params or {}
    params["apikey"] = _api_key()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{TWELVE_BASE}{endpoint}", params=params)
        data = resp.json()
        if resp.status_code in (401, 403):
            raise ValueError(data.get("message", "TWELVE_DATA_API_KEY is invalid or not authorized."))
        resp.raise_for_status()
        if isinstance(data, dict) and data.get("status") == "error":
            raise ValueError(data.get("message", "Twelve Data API error"))
        return data


# ─────────────────────────────────────────────────────────────
#  Real-time Quote
# ─────────────────────────────────────────────────────────────

async def get_quote(symbol: str) -> Dict:
    """
    Fetch real-time quote for a stock, forex pair, or crypto.
    Examples: AAPL, EUR/USD, BTC/USD
    """
    data = await _get("/quote", {"symbol": symbol})
    return {
        "symbol": data.get("symbol"),
        "name": data.get("name"),
        "exchange": data.get("exchange"),
        "currency": data.get("currency"),
        "open": _float(data.get("open")),
        "high": _float(data.get("high")),
        "low": _float(data.get("low")),
        "close": _float(data.get("close")),
        "previous_close": _float(data.get("previous_close")),
        "change": _float(data.get("change")),
        "change_pct": _float(data.get("percent_change")),
        "volume": _int(data.get("volume")),
        "avg_volume": _int(data.get("average_volume")),
        "fifty_two_week_high": _float(data.get("fifty_two_week", {}).get("high")),
        "fifty_two_week_low": _float(data.get("fifty_two_week", {}).get("low")),
        "timestamp": data.get("datetime"),
        "source": "twelvedata",
    }


# ─────────────────────────────────────────────────────────────
#  Time Series
# ─────────────────────────────────────────────────────────────

async def get_time_series(
    symbol: str,
    interval: str = "1day",
    outputsize: int = 100,
) -> List[Dict]:
    """
    Fetch OHLCV time series.
    Intervals: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month
    """
    data = await _get("/time_series", {
        "symbol": symbol,
        "interval": interval,
        "outputsize": outputsize,
    })
    values = data.get("values", [])
    return [
        {
            "timestamp": v.get("datetime"),
            "open": _float(v.get("open")),
            "high": _float(v.get("high")),
            "low": _float(v.get("low")),
            "close": _float(v.get("close")),
            "volume": _int(v.get("volume")),
        }
        for v in values
    ]


async def get_time_series_df(
    symbol: str,
    interval: str = "1day",
    outputsize: int = 200,
) -> pd.DataFrame:
    """Fetch time series and return as a pandas DataFrame."""
    rows = await get_time_series(symbol, interval, outputsize)
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


# ─────────────────────────────────────────────────────────────
#  Technical Indicators (pre-computed by Twelve Data)
# ─────────────────────────────────────────────────────────────

async def get_indicator(
    symbol: str,
    indicator: str,
    interval: str = "1day",
    outputsize: int = 50,
    **kwargs,
) -> List[Dict]:
    """
    Fetch a pre-computed technical indicator from Twelve Data.
    Supported indicators: sma, ema, rsi, macd, bbands, stoch, adx, atr, cci, obv, etc.
    Extra kwargs are passed as indicator parameters (e.g. time_period=14).
    """
    params = {
        "symbol": symbol,
        "interval": interval,
        "outputsize": outputsize,
        **kwargs,
    }
    data = await _get(f"/{indicator}", params)
    return data.get("values", [])


async def get_indicator_summary(symbol: str, interval: str = "1day") -> Dict:
    """
    Fetch multiple key indicators in parallel and return a summary.
    Includes: RSI, MACD, Bollinger Bands, SMA(50), SMA(200), ADX, ATR.
    """
    import asyncio

    async def _fetch(name: str, **kw):
        try:
            vals = await get_indicator(symbol, name, interval, outputsize=1, **kw)
            return name, vals[0] if vals else None
        except Exception as e:
            logger.warning(f"Twelve Data {name} failed for {symbol}: {e}")
            return name, None

    tasks = [
        _fetch("rsi", time_period=14),
        _fetch("macd", fast_period=12, slow_period=26, signal_period=9),
        _fetch("bbands", time_period=20),
        _fetch("sma", time_period=50),
        _fetch("sma", time_period=200),
        _fetch("adx", time_period=14),
        _fetch("atr", time_period=14),
        _fetch("stoch", fast_k_period=14, slow_k_period=3, slow_d_period=3),
        _fetch("cci", time_period=20),
    ]

    results = await asyncio.gather(*tasks)
    result_map = {}
    for name, val in results:
        if val is None:
            continue
        if name == "sma":
            period = val.get("time_period", "")
            # Distinguish SMA50 vs SMA200 by checking the value key
            key = f"sma_{period}" if period else name
            # Twelve Data returns sma in the "sma" key
            if "sma_50" not in result_map:
                result_map["sma_50"] = _float(val.get("sma"))
            else:
                result_map["sma_200"] = _float(val.get("sma"))
        else:
            result_map[name] = val

    # Flatten into a clean summary
    summary = {
        "symbol": symbol,
        "interval": interval,
        "source": "twelvedata",
    }

    # RSI
    rsi_data = result_map.get("rsi")
    if rsi_data:
        summary["rsi_14"] = _float(rsi_data.get("rsi"))

    # MACD
    macd_data = result_map.get("macd")
    if macd_data:
        summary["macd"] = _float(macd_data.get("macd"))
        summary["macd_signal"] = _float(macd_data.get("macd_signal"))
        summary["macd_histogram"] = _float(macd_data.get("macd_hist"))

    # Bollinger Bands
    bb_data = result_map.get("bbands")
    if bb_data:
        summary["bb_upper"] = _float(bb_data.get("upper_band"))
        summary["bb_middle"] = _float(bb_data.get("middle_band"))
        summary["bb_lower"] = _float(bb_data.get("lower_band"))

    # SMAs
    if "sma_50" in result_map:
        summary["sma_50"] = result_map["sma_50"]
    if "sma_200" in result_map:
        summary["sma_200"] = result_map["sma_200"]

    # ADX
    adx_data = result_map.get("adx")
    if adx_data:
        summary["adx_14"] = _float(adx_data.get("adx"))

    # ATR
    atr_data = result_map.get("atr")
    if atr_data:
        summary["atr_14"] = _float(atr_data.get("atr"))

    # Stochastic
    stoch_data = result_map.get("stoch")
    if stoch_data:
        summary["stoch_k"] = _float(stoch_data.get("slow_k"))
        summary["stoch_d"] = _float(stoch_data.get("slow_d"))

    # CCI
    cci_data = result_map.get("cci")
    if cci_data:
        summary["cci_20"] = _float(cci_data.get("cci"))

    return summary


# ─────────────────────────────────────────────────────────────
#  Forex / Exchange Rates
# ─────────────────────────────────────────────────────────────

async def get_exchange_rate(from_currency: str, to_currency: str) -> Dict:
    """Fetch real-time exchange rate (e.g. EUR → USD)."""
    symbol = f"{from_currency}/{to_currency}"
    data = await _get("/exchange_rate", {"symbol": symbol})
    return {
        "symbol": symbol,
        "rate": _float(data.get("rate")),
        "timestamp": data.get("timestamp"),
        "source": "twelvedata",
    }


async def get_forex_pairs() -> List[Dict]:
    """List available forex pairs."""
    data = await _get("/forex_pairs")
    pairs = data.get("data", []) if isinstance(data, dict) else data
    return [
        {
            "symbol": p.get("symbol"),
            "currency_group": p.get("currency_group"),
            "currency_base": p.get("currency_base"),
            "currency_quote": p.get("currency_quote"),
        }
        for p in (pairs or [])[:100]
    ]


# ─────────────────────────────────────────────────────────────
#  Symbol Search
# ─────────────────────────────────────────────────────────────

async def search_symbols(query: str, outputsize: int = 10) -> List[Dict]:
    """Search for symbols by name or ticker."""
    data = await _get("/symbol_search", {
        "symbol": query,
        "outputsize": outputsize,
    })
    results = data.get("data", []) if isinstance(data, dict) else data
    return [
        {
            "symbol": r.get("symbol"),
            "name": r.get("instrument_name"),
            "type": r.get("instrument_type"),
            "exchange": r.get("exchange"),
            "country": r.get("country"),
            "currency": r.get("currency"),
        }
        for r in (results or [])
    ]


# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────

def _float(val) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _int(val) -> Optional[int]:
    if val is None or val == "":
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None
