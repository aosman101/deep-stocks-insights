"""
Market Router — /api/market
  GET /quote/{asset}            — live price quote
  GET /history/{asset}          — OHLCV historical data
  GET /indicators/{asset}       — all technical indicators
  GET /risk/{asset}             — stop-loss / take-profit levels
  GET /position-size            — position sizing calculator
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.price_cache import LiveQuote
from app.schemas.market import (
    LiveQuoteResponse, HistoricalDataResponse, OHLCVPoint,
)
from app.services.asset_registry import get_asset
from app.services.risk_service import position_size_advice
from app.core.dependencies import get_current_active_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/market", tags=["Market Data"])

VALID_INTERVALS = {"1d", "1h", "15m", "5m"}
VALID_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y", "25y"}


def _validate_asset(asset: str) -> str:
    asset = asset.upper()
    if not asset:
        raise HTTPException(status_code=400, detail="Asset symbol is required")
    get_asset(asset)
    return asset


# ─────────────────────────────────────────────────────────────
#  Live Quote
# ─────────────────────────────────────────────────────────────

@router.get("/quote/{asset}", response_model=LiveQuoteResponse)
async def live_quote(
    asset: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Fetch the latest live price quote for a supported asset."""
    from app.services.market_service import get_live_quote, upsert_live_quote

    asset = _validate_asset(asset)
    try:
        quote = await get_live_quote(asset)
        upsert_live_quote(db, quote)
        return quote
    except Exception as e:
        logger.error(f"Live quote failed for {asset}: {e}")
        # Return cached value from DB if available
        cached = db.query(LiveQuote).filter(LiveQuote.asset == asset).first()
        if cached:
            return cached
        raise HTTPException(status_code=503, detail=f"Could not fetch quote for {asset}: {e}")


@router.get("/quotes", response_model=list[LiveQuoteResponse])
async def all_quotes(
    assets: str | None = Query(default=None, description="Comma-separated asset symbols"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Fetch live quotes for one or more assets simultaneously."""
    import asyncio
    from app.services.market_service import get_live_quote, upsert_live_quote

    requested_assets = [
        asset.strip().upper()
        for asset in (assets.split(",") if assets else ["BTC", "GOLD"])
        if asset.strip()
    ]
    requested_assets = list(dict.fromkeys(requested_assets))

    results = await asyncio.gather(
        *(get_live_quote(asset) for asset in requested_assets),
        return_exceptions=True,
    )
    quotes = []
    for asset, result in zip(requested_assets, results):
        if isinstance(result, Exception):
            logger.error(f"Quote failed for {asset}: {result}")
            cached = db.query(LiveQuote).filter(LiveQuote.asset == asset).first()
            if cached:
                quotes.append(cached)
        else:
            upsert_live_quote(db, result, commit=False)
            quotes.append(result)

    if quotes:
        db.commit()
    return quotes


# ─────────────────────────────────────────────────────────────
#  Historical Data
# ─────────────────────────────────────────────────────────────

@router.get("/history/{asset}", response_model=HistoricalDataResponse)
async def historical_data(
    asset: str,
    period: str = Query(default="1y", description="1mo | 3mo | 6mo | 1y | 2y | 5y | 25y"),
    interval: str = Query(default="1d", description="1d | 1h | 15m | 5m"),
    limit: int = Query(default=10000, ge=10, le=10000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Return OHLCV historical price data."""
    from app.services.market_service import get_historical_data

    asset = _validate_asset(asset)
    if period not in VALID_PERIODS:
        raise HTTPException(status_code=400, detail=f"Period must be one of: {VALID_PERIODS}")
    if interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail=f"Interval must be one of: {VALID_INTERVALS}")

    try:
        df = await get_historical_data(asset, period=period, interval=interval)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No historical data found for {asset}")

        df = df.tail(limit)
        points = [
            OHLCVPoint(
                timestamp=row["timestamp"],
                open=row.get("open"),
                high=row.get("high"),
                low=row.get("low"),
                close=float(row["close"]),
                volume=row.get("volume"),
                change_pct=row.get("change_pct"),
            )
            for _, row in df.iterrows()
        ]
        return HistoricalDataResponse(
            asset=asset, interval=interval, period=period,
            count=len(points), data=points,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Historical data failed for {asset}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
#  Technical Indicators
# ─────────────────────────────────────────────────────────────

@router.get("/indicators/{asset}")
async def technical_indicators(
    asset: str,
    period: str = Query(default="1y"),
    _: User = Depends(get_current_active_user),
):
    """
    Compute and return all technical indicators for the given asset.
    Includes: SMA, EMA, WMA, RSI, Stochastic, Williams %R, CCI, MACD, ADX,
    Aroon, Bollinger Bands, ATR, Keltner Channels, OBV, VWAP, MFI,
    Line of Best Fit, Pivot Points, Fibonacci Levels.
    """
    asset = _validate_asset(asset)
    try:
        from app.services.market_service import get_historical_data
        from app.services.indicators_service import (
            compute_correlation_matrix,
            compute_indicator_series,
            compute_indicators,
        )

        df = await get_historical_data(asset, period=period)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {asset}")

        summary = compute_indicators(df)
        summary["asset"] = asset

        return {
            **summary,
            "summary": summary,
            "series": compute_indicator_series(df),
            "pivot_points": summary.get("pivot_points"),
            "fibonacci": summary.get("fibonacci"),
            "correlation_matrix": compute_correlation_matrix(df),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Indicators failed for {asset}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
#  Risk Management
# ─────────────────────────────────────────────────────────────

@router.get("/risk/{asset}")
async def risk_levels(
    asset: str,
    signal: str = Query(default="BUY", description="BUY | SELL | HOLD"),
    period: str = Query(default="1y"),
    _: User = Depends(get_current_active_user),
):
    """
    Return stop-loss and take-profit levels at three risk tiers
    (conservative, standard, aggressive) for the given signal.
    ATR is computed from the latest data.
    """
    asset = _validate_asset(asset)
    signal = signal.upper()
    if signal not in ("BUY", "SELL", "HOLD"):
        raise HTTPException(status_code=400, detail="Signal must be BUY, SELL, or HOLD")

    try:
        from app.services.market_service import get_historical_data
        from app.services.indicators_service import compute_indicators
        from app.services.risk_service import compute_risk_levels

        df = await get_historical_data(asset, period=period)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {asset}")

        indicators = compute_indicators(df)
        current_price = indicators["current_price"]
        atr = indicators.get("atr_14")

        return compute_risk_levels(asset, current_price, signal, atr)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/position-size")
def calc_position_size(
    account_balance: float = Query(..., description="Total account balance in USD"),
    risk_pct: float = Query(default=1.0, description="Percentage of account to risk (e.g. 1.0 = 1%)"),
    stop_loss_dist: float = Query(..., description="Stop-loss distance from entry in USD"),
    current_price: float = Query(..., description="Current asset price in USD"),
    _: User = Depends(get_current_active_user),
):
    """Educational position sizing calculator using the fixed fractional method."""
    return position_size_advice(
        account_balance=account_balance,
        risk_pct_of_account=risk_pct / 100,
        stop_loss_dist=stop_loss_dist,
        current_price=current_price,
    )
