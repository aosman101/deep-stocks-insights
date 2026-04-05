"""
Finnhub Router — /api/finnhub
  GET /news/{symbol}          — company-specific news
  GET /news                   — general market news
  GET /profile/{symbol}       — company profile (industry, market cap, logo)
  GET /quote/{symbol}         — real-time stock quote
  GET /earnings               — earnings calendar
  GET /earnings/{symbol}      — earnings for a specific symbol
  GET /sentiment/{symbol}     — news sentiment scores
  GET /peers/{symbol}         — peer/competitor symbols
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/finnhub", tags=["Finnhub"])


def _require_key():
    if not settings.FINNHUB_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Finnhub API key not configured. Add FINNHUB_API_KEY to .env",
        )


# ─── Company News ────────────────────────────────────────────

@router.get("/news/{symbol}")
async def company_news(
    symbol: str,
    days: int = Query(default=7, ge=1, le=30, description="Days of news to fetch"),
    _: User = Depends(get_current_active_user),
):
    """Fetch recent news articles for a stock symbol."""
    _require_key()
    try:
        from app.services.finnhub_service import get_company_news
        return await get_company_news(symbol, days_back=days)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Finnhub company news failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news")
async def market_news(
    category: str = Query(default="general", description="general | forex | crypto | merger"),
    _: User = Depends(get_current_active_user),
):
    """Fetch general market news."""
    _require_key()
    if category not in ("general", "forex", "crypto", "merger"):
        raise HTTPException(status_code=400, detail="Category must be: general, forex, crypto, merger")
    try:
        from app.services.finnhub_service import get_market_news
        return await get_market_news(category)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Finnhub market news failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Company Profile ─────────────────────────────────────────

@router.get("/profile/{symbol}")
async def company_profile(
    symbol: str,
    _: User = Depends(get_current_active_user),
):
    """Fetch company profile (name, industry, market cap, logo, etc.)."""
    _require_key()
    try:
        from app.services.finnhub_service import get_company_profile
        return await get_company_profile(symbol)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Finnhub profile failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Real-time Quote ─────────────────────────────────────────

@router.get("/quote/{symbol}")
async def finnhub_quote(
    symbol: str,
    _: User = Depends(get_current_active_user),
):
    """Fetch real-time stock quote from Finnhub."""
    _require_key()
    try:
        from app.services.finnhub_service import get_finnhub_quote
        return await get_finnhub_quote(symbol)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Finnhub quote failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Earnings Calendar ───────────────────────────────────────

@router.get("/earnings/{symbol}")
async def symbol_earnings(
    symbol: str,
    _: User = Depends(get_current_active_user),
):
    """Fetch earnings calendar for a specific symbol."""
    _require_key()
    try:
        from app.services.finnhub_service import get_earnings_calendar
        return await get_earnings_calendar(symbol=symbol)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Finnhub earnings failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/earnings")
async def earnings_calendar(
    from_date: str = Query(default=None, description="YYYY-MM-DD"),
    to_date: str = Query(default=None, description="YYYY-MM-DD"),
    _: User = Depends(get_current_active_user),
):
    """Fetch upcoming earnings calendar (next 30 days by default)."""
    _require_key()
    try:
        from app.services.finnhub_service import get_earnings_calendar
        return await get_earnings_calendar(from_date=from_date, to_date=to_date)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Finnhub earnings calendar failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Sentiment ────────────────────────────────────────────────

@router.get("/sentiment/{symbol}")
async def news_sentiment(
    symbol: str,
    _: User = Depends(get_current_active_user),
):
    """Fetch aggregated news sentiment for a stock."""
    _require_key()
    try:
        from app.services.finnhub_service import get_news_sentiment
        return await get_news_sentiment(symbol)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Finnhub sentiment failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Peers ────────────────────────────────────────────────────

@router.get("/peers/{symbol}")
async def peer_companies(
    symbol: str,
    _: User = Depends(get_current_active_user),
):
    """Return a list of peer/competitor ticker symbols."""
    _require_key()
    try:
        from app.services.finnhub_service import get_peers
        return await get_peers(symbol)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Finnhub peers failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
