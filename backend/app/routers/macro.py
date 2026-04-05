"""
Macro Router — /api/macro
  GET /snapshot        — full macro dashboard (FRED + Fear & Greed)
  GET /fear-greed      — Fear & Greed index + 30-day history
  GET /history/{series} — historical data for a named FRED series
  GET /series          — list all available FRED series
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.macro_service import (
    get_macro_snapshot, get_macro_history, fetch_fear_greed, FRED_SERIES
)
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.config import settings

router = APIRouter(prefix="/api/macro", tags=["Macroeconomic Data"])

# Read optional FRED key from settings (add FRED_API_KEY to .env)
def _fred_key() -> str:
    return getattr(settings, "FRED_API_KEY", "")


@router.get("/snapshot")
async def macro_snapshot(_: User = Depends(get_current_active_user)):
    """
    Full macro snapshot: Fed Funds Rate, CPI, 10Y Treasury, USD Index,
    GDP, Unemployment, VIX, Crypto Fear & Greed Index, and contextual insights
    for BTC and Gold.
    """
    return await get_macro_snapshot(fred_api_key=_fred_key())


@router.get("/fear-greed")
async def fear_greed_index(
    limit: int = Query(default=30, ge=1, le=365),
    _: User = Depends(get_current_active_user),
):
    """Crypto Fear & Greed Index — current value + history (free, no key needed)."""
    return await fetch_fear_greed(limit=limit)


@router.get("/history/{series_name}")
async def macro_series_history(
    series_name: str,
    limit: int = Query(default=24, ge=1, le=120),
    _: User = Depends(get_current_active_user),
):
    """Historical observations for a named FRED series (requires FRED_API_KEY in .env)."""
    if series_name not in FRED_SERIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown series. Available: {list(FRED_SERIES.keys())}"
        )
    return await get_macro_history(series_name, limit=limit, fred_api_key=_fred_key())


@router.get("/series")
def list_series(_: User = Depends(get_current_active_user)):
    """List all available FRED series names and metadata."""
    return {
        name: {"label": info["label"], "unit": info["unit"], "fred_id": info["id"]}
        for name, info in FRED_SERIES.items()
    }
