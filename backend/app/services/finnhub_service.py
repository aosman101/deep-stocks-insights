"""
Deep Stock Insights - Finnhub Integration Service
Provides company news, company profiles, stock quotes, earnings, and market sentiment
via the Finnhub.io API.

Requires FINNHUB_API_KEY in .env.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

FINNHUB_BASE = "https://finnhub.io/api/v1"


def _api_key() -> str:
    key = settings.FINNHUB_API_KEY
    if not key:
        raise ValueError("FINNHUB_API_KEY is not configured. Add it to your .env file.")
    return key


async def _get(endpoint: str, params: dict | None = None) -> dict | list:
    """Make an authenticated GET request to Finnhub."""
    params = params or {}
    params["token"] = _api_key()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{FINNHUB_BASE}{endpoint}", params=params)
        if resp.status_code == 401:
            raise ValueError("FINNHUB_API_KEY is invalid or not authorized.")
        if resp.status_code == 403:
            raise PermissionError("This Finnhub endpoint requires a premium subscription.")
        resp.raise_for_status()
        return resp.json()


# ─────────────────────────────────────────────────────────────
#  Company Profile
# ─────────────────────────────────────────────────────────────

async def get_company_profile(symbol: str) -> Dict:
    """
    Fetch company profile (name, industry, market cap, logo, etc.).
    Works for US-listed stocks.
    """
    data = await _get("/stock/profile2", {"symbol": symbol.upper()})
    if not data:
        return {"symbol": symbol.upper(), "error": "No profile found"}
    return {
        "symbol": data.get("ticker", symbol.upper()),
        "name": data.get("name"),
        "country": data.get("country"),
        "currency": data.get("currency"),
        "exchange": data.get("exchange"),
        "industry": data.get("finnhubIndustry"),
        "ipo_date": data.get("ipo"),
        "logo": data.get("logo"),
        "market_cap": data.get("marketCapitalization"),
        "shares_outstanding": data.get("shareOutstanding"),
        "url": data.get("weburl"),
        "phone": data.get("phone"),
    }


# ─────────────────────────────────────────────────────────────
#  Real-time Quote
# ─────────────────────────────────────────────────────────────

async def get_finnhub_quote(symbol: str) -> Dict:
    """
    Fetch real-time stock quote from Finnhub.
    Returns current price, change, high/low of day, open, previous close.
    """
    data = await _get("/quote", {"symbol": symbol.upper()})
    return {
        "asset": symbol.upper(),
        "price": data.get("c", 0),
        "change": data.get("d", 0),
        "change_pct": data.get("dp", 0),
        "high": data.get("h"),
        "low": data.get("l"),
        "open": data.get("o"),
        "previous_close": data.get("pc"),
        "timestamp": datetime.utcfromtimestamp(data["t"]).isoformat() if data.get("t") else None,
        "source": "finnhub",
    }


# ─────────────────────────────────────────────────────────────
#  Company News
# ─────────────────────────────────────────────────────────────

async def get_company_news(
    symbol: str,
    days_back: int = 7,
) -> List[Dict]:
    """
    Fetch recent news articles for a given stock symbol.
    Returns up to 50 articles from the past `days_back` days.
    """
    to_date = datetime.utcnow().strftime("%Y-%m-%d")
    from_date = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    articles = await _get("/company-news", {
        "symbol": symbol.upper(),
        "from": from_date,
        "to": to_date,
    })

    return [
        {
            "headline": a.get("headline"),
            "summary": a.get("summary"),
            "source": a.get("source"),
            "url": a.get("url"),
            "image": a.get("image"),
            "category": a.get("category"),
            "published_at": datetime.utcfromtimestamp(a["datetime"]).isoformat() if a.get("datetime") else None,
        }
        for a in (articles or [])[:50]
    ]


# ─────────────────────────────────────────────────────────────
#  Market News (general)
# ─────────────────────────────────────────────────────────────

async def get_market_news(category: str = "general") -> List[Dict]:
    """
    Fetch general market news.
    Categories: general, forex, crypto, merger.
    """
    articles = await _get("/news", {"category": category})
    return [
        {
            "headline": a.get("headline"),
            "summary": a.get("summary"),
            "source": a.get("source"),
            "url": a.get("url"),
            "image": a.get("image"),
            "category": a.get("category"),
            "published_at": datetime.utcfromtimestamp(a["datetime"]).isoformat() if a.get("datetime") else None,
        }
        for a in (articles or [])[:30]
    ]


# ─────────────────────────────────────────────────────────────
#  Earnings Calendar
# ─────────────────────────────────────────────────────────────

async def get_earnings_calendar(
    symbol: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> List[Dict]:
    """
    Fetch upcoming/past earnings for a symbol or date range.
    If no dates provided, defaults to upcoming 30 days.
    """
    params: dict = {}
    if symbol:
        params["symbol"] = symbol.upper()
    if not from_date:
        from_date = datetime.utcnow().strftime("%Y-%m-%d")
    if not to_date:
        to_date = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
    params["from"] = from_date
    params["to"] = to_date

    data = await _get("/calendar/earnings", params)
    earnings = data.get("earningsCalendar", [])

    return [
        {
            "symbol": e.get("symbol"),
            "date": e.get("date"),
            "hour": e.get("hour"),
            "eps_estimate": e.get("epsEstimate"),
            "eps_actual": e.get("epsActual"),
            "revenue_estimate": e.get("revenueEstimate"),
            "revenue_actual": e.get("revenueActual"),
            "quarter": e.get("quarter"),
            "year": e.get("year"),
        }
        for e in earnings
    ]


# ─────────────────────────────────────────────────────────────
#  Sentiment (Social / News)
# ─────────────────────────────────────────────────────────────

async def get_news_sentiment(symbol: str) -> Dict:
    """
    Fetch aggregated news sentiment for a stock.
    Returns buzz, sentiment scores, and sector comparisons.
    """
    data = await _get("/news-sentiment", {"symbol": symbol.upper()})
    if not data:
        return {"symbol": symbol.upper(), "error": "No sentiment data"}

    buzz = data.get("buzz", {})
    sentiment = data.get("sentiment", {})
    return {
        "symbol": data.get("symbol", symbol.upper()),
        "company_name": data.get("companyNewsScore"),
        "buzz": {
            "articles_in_last_week": buzz.get("articlesInLastWeek"),
            "buzz_score": buzz.get("buzz"),
            "weekly_average": buzz.get("weeklyAverage"),
        },
        "sentiment": {
            "bearish_pct": sentiment.get("bearishPercent"),
            "bullish_pct": sentiment.get("bullishPercent"),
            "score": data.get("companyNewsScore"),
        },
        "sector_avg_bullish": data.get("sectorAverageBullishPercent"),
        "sector_avg_sentiment": data.get("sectorAverageNewsScore"),
    }


# ─────────────────────────────────────────────────────────────
#  Peer Companies
# ─────────────────────────────────────────────────────────────

async def get_peers(symbol: str) -> List[str]:
    """Return a list of peer/competitor ticker symbols."""
    return await _get("/stock/peers", {"symbol": symbol.upper()})
