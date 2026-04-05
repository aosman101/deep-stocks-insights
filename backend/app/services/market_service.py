"""
Deep Stock Insights - Market Data Service
Fetches live and historical price data for supported crypto, commodity, and stock assets.

Sources:
  Crypto with CoinGecko IDs → CoinGecko public API (no key required)
  GOLD                     → yfinance (GC=F — Gold Futures) + GoldAPI.io (optional, for live spot)
  Stocks / fallback        → yfinance

All data is normalised into a consistent dict/DataFrame format
before being stored in PriceCache or returned to the frontend.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import httpx
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.config import settings
from app.models.price_cache import PriceCache, LiveQuote

logger = logging.getLogger(__name__)

COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# ─────────────────────────────────────────────────────────────
#  In-memory TTL cache — avoids hammering external APIs
# ─────────────────────────────────────────────────────────────

_quote_cache: Dict[str, Tuple[float, Dict]] = {}
_hist_cache: Dict[str, Tuple[float, pd.DataFrame]] = {}
_goldapi_disabled_until = 0.0

QUOTE_TTL = 60        # live quotes cached 1 min
HIST_TTL  = 300       # historical data cached 5 min
GOLD_API_DISABLE_TTL = 3600


def _get_cached_quote(asset: str) -> Optional[Dict]:
    entry = _quote_cache.get(asset)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def _set_cached_quote(asset: str, data: Dict):
    _quote_cache[asset] = (time.monotonic() + QUOTE_TTL, data)


def _get_cached_hist(key: str) -> Optional[pd.DataFrame]:
    entry = _hist_cache.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def _set_cached_hist(key: str, df: pd.DataFrame):
    _hist_cache[key] = (time.monotonic() + HIST_TTL, df)


# ─────────────────────────────────────────────────────────────
#  Shared httpx client (connection pooling)
# ─────────────────────────────────────────────────────────────

_shared_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_connections=20),
        )
    return _shared_client


async def close_shared_client():
    """Call on app shutdown to cleanly close the connection pool."""
    global _shared_client
    if _shared_client and not _shared_client.is_closed:
        await _shared_client.aclose()
        _shared_client = None


# ─────────────────────────────────────────────────────────────
#  CoinGecko helpers
# ─────────────────────────────────────────────────────────────

async def fetch_coingecko_live_quote(asset: str, coingecko_id: str) -> Dict:
    """Fetch a live crypto quote from CoinGecko."""
    url = f"{COINGECKO_BASE}/simple/price"
    params = {
        "ids": coingecko_id,
        "vs_currencies": "usd",
        "include_24hr_change": "true",
        "include_24hr_vol": "true",
        "include_market_cap": "true",
        "include_last_updated_at": "true",
    }
    client = _get_client()
    resp = await client.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()[coingecko_id]
    return {
        "asset": asset,
        "price": data["usd"],
        "price_usd": data["usd"],
        "change_24h_pct": data.get("usd_24h_change", 0),
        "volume_24h": data.get("usd_24h_vol", 0),
        "market_cap": data.get("usd_market_cap", 0),
        "source": "coingecko",
        "updated_at": datetime.utcnow(),
    }


async def fetch_coingecko_historical(
    asset: str,
    coingecko_id: str,
    period: str = "2y",
    interval: str = "1d",
) -> pd.DataFrame:
    """
    Fetch crypto historical OHLCV from CoinGecko.
    Returns a DataFrame with columns: timestamp, open, high, low, close, volume.
    Falls back to yfinance if CoinGecko returns an error or the range is unsupported.
    """
    try:
        days_map = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        days = days_map.get(period, 365)

        if days > 365:
            raise ValueError("CoinGecko limited to 365 days — falling back to yfinance")

        url = f"{COINGECKO_BASE}/coins/{coingecko_id}/ohlc"
        params = {"vs_currency": "usd", "days": days}
        client = _get_client()
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        raw = resp.json()          # [[timestamp_ms, open, high, low, close], ...]

        df = pd.DataFrame(raw, columns=["ts_ms", "open", "high", "low", "close"])
        df["timestamp"] = pd.to_datetime(df["ts_ms"], unit="ms", utc=True)
        df["volume"] = None
        df = df[["timestamp", "open", "high", "low", "close", "volume"]]
        df = df.dropna(subset=["timestamp", "open", "high", "low", "close"])
        logger.info(f"{asset} historical: {len(df)} candles from CoinGecko")
        return df

    except Exception as e:
        from app.services.asset_registry import get_yfinance_ticker

        ticker = get_yfinance_ticker(asset)
        logger.warning(f"CoinGecko OHLC failed for {asset} ({e}), using yfinance {ticker}")
        return _yfinance_ohlcv(ticker, period, interval)


async def fetch_btc_live_quote() -> Dict:
    """Fetch live Bitcoin price from CoinGecko."""
    return await fetch_coingecko_live_quote("BTC", "bitcoin")


async def fetch_btc_historical(period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """Fetch Bitcoin historical OHLCV from CoinGecko."""
    return await fetch_coingecko_historical("BTC", "bitcoin", period, interval)


# ─────────────────────────────────────────────────────────────
#  yfinance helpers (Gold + BTC fallback)
# ─────────────────────────────────────────────────────────────

def _yfinance_ohlcv(ticker: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """
    Synchronously fetch OHLCV via yfinance and return a clean DataFrame.
    Runs in a thread executor so it does not block the async event loop.
    """
    try:
        tkr = yf.Ticker(ticker)
        if period == "25y":
            end = datetime.utcnow()
            start = end - timedelta(days=25 * 365)
            df = tkr.history(start=start, end=end, interval=interval)
        else:
            df = tkr.history(period=period, interval=interval)
        if df.empty:
            logger.warning(f"yfinance returned empty for {ticker}")
            return pd.DataFrame()

        df = df.reset_index()
        df.columns = [c.lower() for c in df.columns]
        # Rename 'date' or 'datetime' → timestamp
        if "date" in df.columns:
            df.rename(columns={"date": "timestamp"}, inplace=True)
        elif "datetime" in df.columns:
            df.rename(columns={"datetime": "timestamp"}, inplace=True)

        df = df[["timestamp", "open", "high", "low", "close", "volume"]].copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        logger.info(f"{ticker} historical: {len(df)} candles from yfinance")
        return df

    except Exception as e:
        logger.error(f"yfinance fetch failed for {ticker}: {e}")
        return pd.DataFrame()


async def fetch_gold_live_quote() -> Dict:
    """
    Fetch live Gold price.
    Tries GoldAPI.io first (if key configured), then falls back to yfinance GC=F.
    """
    global _goldapi_disabled_until

    # Optional GoldAPI.io (live spot price)
    if settings.GOLD_API_KEY and time.monotonic() >= _goldapi_disabled_until:
        try:
            client = _get_client()
            resp = await client.get(
                "https://www.goldapi.io/api/XAU/USD",
                headers={"x-access-token": settings.GOLD_API_KEY},
                timeout=5.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "asset": "GOLD",
                "price": data["price"],
                "price_usd": data["price"],
                "change_24h": data.get("ch", 0),
                "change_24h_pct": data.get("chp", 0),
                "high_24h": data.get("high_price"),
                "low_24h": data.get("low_price"),
                "source": "goldapi",
                "updated_at": datetime.utcnow(),
            }
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (401, 403):
                _goldapi_disabled_until = time.monotonic() + GOLD_API_DISABLE_TTL
                logger.warning(
                    f"GoldAPI rejected the configured key ({e.response.status_code}). "
                    f"Disabling GoldAPI for {GOLD_API_DISABLE_TTL // 60} minutes and falling back to yfinance."
                )
            else:
                logger.warning(f"GoldAPI failed: {e}, falling back to yfinance")
        except Exception as e:
            logger.warning(f"GoldAPI failed: {e}, falling back to yfinance")

    # yfinance fallback: GC=F (Gold Futures - ~15 min delay but free)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _yfinance_gold_quote)


def _yfinance_gold_quote() -> Dict:
    try:
        tkr = yf.Ticker("GC=F")
        info = tkr.fast_info
        hist = tkr.history(period="2d", interval="1d")

        price = info.last_price if hasattr(info, "last_price") else float(hist["Close"].iloc[-1])
        prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
        change = price - prev_close
        change_pct = (change / prev_close) * 100 if prev_close else 0

        return {
            "asset": "GOLD",
            "price": round(price, 2),
            "price_usd": round(price, 2),
            "change_24h": round(change, 2),
            "change_24h_pct": round(change_pct, 4),
            "high_24h": float(hist["High"].iloc[-1]) if not hist.empty else None,
            "low_24h": float(hist["Low"].iloc[-1]) if not hist.empty else None,
            "volume_24h": float(hist["Volume"].iloc[-1]) if not hist.empty else None,
            "source": "yfinance",
            "updated_at": datetime.utcnow(),
        }
    except Exception as e:
        logger.error(f"yfinance gold quote failed: {e}")
        return {
            "asset": "GOLD",
            "price": 0.0,
            "source": "error",
            "updated_at": datetime.utcnow(),
        }


async def fetch_gold_historical(period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """Fetch Gold historical OHLCV from yfinance (GC=F)."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _yfinance_ohlcv, "GC=F", period, interval)


# ─────────────────────────────────────────────────────────────
#  Unified public API
# ─────────────────────────────────────────────────────────────

async def get_live_quote(asset: str) -> Dict:
    """
    Return the latest live quote for any supported asset.
    Uses an in-memory cache (60 s TTL) so rapid page loads don't re-hit APIs.
    """
    from app.services.asset_registry import get_asset, get_yfinance_ticker

    asset = asset.upper()

    cached = _get_cached_quote(asset)
    if cached is not None:
        return cached

    asset_info = get_asset(asset)
    coingecko_id = asset_info.get("coingecko_id")

    if coingecko_id:
        result = await fetch_coingecko_live_quote(asset, coingecko_id)
    elif asset in ("GOLD", "GC=F"):
        result = await fetch_gold_live_quote()
    else:
        loop = asyncio.get_running_loop()
        ticker = get_yfinance_ticker(asset)
        result = await loop.run_in_executor(None, _yfinance_generic_quote, asset, ticker)

    _set_cached_quote(asset, result)
    return result


def _yfinance_generic_quote(symbol: str, ticker: str) -> Dict:
    try:
        tkr = yf.Ticker(ticker)
        hist = tkr.history(period="2d", interval="1d")
        info = tkr.fast_info
        price = float(info.last_price) if hasattr(info, "last_price") and info.last_price else float(hist["Close"].iloc[-1])
        prev  = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
        change = price - prev
        change_pct = (change / prev * 100) if prev else 0
        return {
            "asset": symbol,
            "price": round(price, 4),
            "price_usd": round(price, 4),
            "change_24h": round(change, 4),
            "change_24h_pct": round(change_pct, 4),
            "high_24h": float(hist["High"].iloc[-1]) if not hist.empty else None,
            "low_24h":  float(hist["Low"].iloc[-1])  if not hist.empty else None,
            "volume_24h": float(hist["Volume"].iloc[-1]) if not hist.empty else None,
            "source": "yfinance",
            "updated_at": datetime.utcnow(),
        }
    except Exception as e:
        logger.error(f"Generic quote failed for {symbol}: {e}")
        return {"asset": symbol, "price": 0.0, "source": "error", "updated_at": datetime.utcnow()}


async def get_historical_data(
    asset: str,
    period: str = "1y",
    interval: str = "1d",
) -> pd.DataFrame:
    """Return historical OHLCV DataFrame for any asset (cached 5 min)."""
    from app.services.asset_registry import get_asset, get_yfinance_ticker

    asset = asset.upper()
    cache_key = f"{asset}:{period}:{interval}"

    cached = _get_cached_hist(cache_key)
    if cached is not None:
        return cached

    asset_info = get_asset(asset)
    coingecko_id = asset_info.get("coingecko_id")

    if coingecko_id and interval == "1d":
        ticker = get_yfinance_ticker(asset)
        loop = asyncio.get_running_loop()
        df = await loop.run_in_executor(None, _yfinance_ohlcv, ticker, period, interval)
        if df.empty:
            logger.warning(f"{asset} daily history from yfinance was empty, falling back to CoinGecko")
            df = await fetch_coingecko_historical(asset, coingecko_id, period, interval)
    elif coingecko_id:
        df = await fetch_coingecko_historical(asset, coingecko_id, period, interval)
    elif asset in ("GOLD", "GC=F"):
        df = await fetch_gold_historical(period, interval)
    else:
        ticker = get_yfinance_ticker(asset)
        loop = asyncio.get_running_loop()
        df = await loop.run_in_executor(None, _yfinance_ohlcv, ticker, period, interval)

    _set_cached_hist(cache_key, df)
    return df


# ─────────────────────────────────────────────────────────────
#  DB cache helpers
# ─────────────────────────────────────────────────────────────

def upsert_live_quote(db: Session, quote: Dict, commit: bool = True) -> LiveQuote:
    """Insert or update the live quote for an asset in the DB."""
    record = db.query(LiveQuote).filter(LiveQuote.asset == quote["asset"]).first()
    if not record:
        record = LiveQuote(asset=quote["asset"])
        db.add(record)

    for key, value in quote.items():
        if hasattr(record, key):
            setattr(record, key, value)

    if commit:
        db.commit()
        db.refresh(record)
    else:
        db.flush()
    return record


def bulk_insert_ohlcv(db: Session, asset: str, df: pd.DataFrame, interval: str = "1d"):
    """
    Bulk-insert historical OHLCV rows into PriceCache.
    Skips rows that already exist (by asset + timestamp + interval).
    """
    if df.empty:
        return

    existing_ts = set(
        row[0]
        for row in db.query(PriceCache.timestamp)
        .filter(PriceCache.asset == asset, PriceCache.interval == interval)
        .all()
    )

    new_rows = []
    for _, row in df.iterrows():
        ts = row["timestamp"]
        if hasattr(ts, "to_pydatetime"):
            ts = ts.to_pydatetime()
        if ts in existing_ts:
            continue

        prev_close = df.loc[df["timestamp"] < row["timestamp"], "close"]
        change_pct = None
        if not prev_close.empty:
            pc = float(prev_close.iloc[-1])
            change_pct = ((float(row["close"]) - pc) / pc) * 100 if pc else None

        new_rows.append(
            PriceCache(
                asset=asset,
                interval=interval,
                timestamp=ts,
                open=float(row["open"]) if pd.notna(row.get("open")) else None,
                high=float(row["high"]) if pd.notna(row.get("high")) else None,
                low=float(row["low"]) if pd.notna(row.get("low")) else None,
                close=float(row["close"]),
                volume=float(row["volume"]) if pd.notna(row.get("volume")) else None,
                change_pct=change_pct,
            )
        )

    if new_rows:
        db.bulk_save_objects(new_rows)
        db.commit()
        logger.info(f"Cached {len(new_rows)} {asset} candles ({interval})")


def get_cached_ohlcv(
    db: Session,
    asset: str,
    interval: str = "1d",
    limit: int = 500,
) -> pd.DataFrame:
    """Load the most recent N candles from the local price cache."""
    rows = (
        db.query(PriceCache)
        .filter(PriceCache.asset == asset, PriceCache.interval == interval)
        .order_by(PriceCache.timestamp.desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return pd.DataFrame()

    data = [
        {
            "timestamp": r.timestamp,
            "open": r.open,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "volume": r.volume,
            "change_pct": r.change_pct,
        }
        for r in reversed(rows)
    ]
    return pd.DataFrame(data)
