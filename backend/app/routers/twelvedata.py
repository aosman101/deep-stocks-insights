"""
Twelve Data Router — /api/twelvedata
  GET /quote/{symbol}              — real-time quote
  GET /time-series/{symbol}        — OHLCV time series
  GET /indicators/{symbol}         — multi-indicator summary
  GET /indicator/{symbol}/{name}   — single technical indicator
  GET /exchange-rate               — forex exchange rate
  GET /forex-pairs                 — list available forex pairs
  GET /search                      — symbol search
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/twelvedata", tags=["Twelve Data"])


def _require_key():
    if not settings.TWELVE_DATA_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Twelve Data API key not configured. Add TWELVE_DATA_API_KEY to .env",
        )


VALID_INTERVALS = {
    "1min", "5min", "15min", "30min", "45min",
    "1h", "2h", "4h", "1day", "1week", "1month",
}


# ─── Real-time Quote ─────────────────────────────────────────

@router.get("/quote/{symbol}")
async def quote(
    symbol: str,
    _: User = Depends(get_current_active_user),
):
    """Fetch real-time quote for a stock, forex pair, or crypto (e.g. AAPL, EUR/USD, BTC/USD)."""
    _require_key()
    try:
        from app.services.twelvedata_service import get_quote
        return await get_quote(symbol)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Twelve Data quote failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Time Series ─────────────────────────────────────────────

@router.get("/time-series/{symbol}")
async def time_series(
    symbol: str,
    interval: str = Query(default="1day", description="1min|5min|15min|30min|1h|4h|1day|1week|1month"),
    outputsize: int = Query(default=100, ge=1, le=5000),
    _: User = Depends(get_current_active_user),
):
    """Fetch OHLCV time series data."""
    _require_key()
    if interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail=f"Interval must be one of: {sorted(VALID_INTERVALS)}")
    try:
        from app.services.twelvedata_service import get_time_series
        return await get_time_series(symbol, interval, outputsize)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Twelve Data time series failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Multi-Indicator Summary ─────────────────────────────────

@router.get("/indicators/{symbol}")
async def indicator_summary(
    symbol: str,
    interval: str = Query(default="1day"),
    _: User = Depends(get_current_active_user),
):
    """
    Fetch a summary of key technical indicators from Twelve Data.
    Includes: RSI, MACD, Bollinger Bands, SMA(50/200), ADX, ATR, Stochastic, CCI.
    """
    _require_key()
    if interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail=f"Interval must be one of: {sorted(VALID_INTERVALS)}")
    try:
        from app.services.twelvedata_service import get_indicator_summary
        return await get_indicator_summary(symbol, interval)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Twelve Data indicators failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Single Indicator ────────────────────────────────────────

@router.get("/indicator/{symbol}/{name}")
async def single_indicator(
    symbol: str,
    name: str,
    interval: str = Query(default="1day"),
    outputsize: int = Query(default=50, ge=1, le=500),
    time_period: int = Query(default=14, ge=1, le=200),
    _: User = Depends(get_current_active_user),
):
    """
    Fetch a single technical indicator series.
    Supported: sma, ema, rsi, macd, bbands, stoch, adx, atr, cci, obv, wma, etc.
    """
    _require_key()
    allowed = {"sma", "ema", "wma", "rsi", "macd", "bbands", "stoch", "adx", "atr", "cci", "obv", "vwap"}
    if name not in allowed:
        raise HTTPException(status_code=400, detail=f"Indicator must be one of: {sorted(allowed)}")
    if interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail=f"Interval must be one of: {sorted(VALID_INTERVALS)}")
    try:
        from app.services.twelvedata_service import get_indicator
        return await get_indicator(symbol, name, interval, outputsize, time_period=time_period)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Twelve Data {name} failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Forex ────────────────────────────────────────────────────

@router.get("/exchange-rate")
async def exchange_rate(
    from_currency: str = Query(..., description="e.g. EUR"),
    to_currency: str = Query(default="USD", description="e.g. USD"),
    _: User = Depends(get_current_active_user),
):
    """Fetch real-time forex exchange rate."""
    _require_key()
    try:
        from app.services.twelvedata_service import get_exchange_rate
        return await get_exchange_rate(from_currency.upper(), to_currency.upper())
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Twelve Data exchange rate failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forex-pairs")
async def forex_pairs(
    _: User = Depends(get_current_active_user),
):
    """List available forex pairs."""
    _require_key()
    try:
        from app.services.twelvedata_service import get_forex_pairs
        return await get_forex_pairs()
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Twelve Data forex pairs failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Symbol Search ────────────────────────────────────────────

@router.get("/search")
async def search_symbols(
    q: str = Query(..., description="Search query (e.g. 'Apple', 'AAPL')"),
    limit: int = Query(default=10, ge=1, le=50),
    _: User = Depends(get_current_active_user),
):
    """Search for symbols by name or ticker."""
    _require_key()
    try:
        from app.services.twelvedata_service import search_symbols
        return await search_symbols(q, outputsize=limit)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Twelve Data search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
