"""
Deep Stock Insights - Macroeconomic Data Service
Fetches macro indicators relevant to Bitcoin and Gold pricing.

Sources:
  FRED (Federal Reserve Economic Data) — free, optional API key
    - Fed Funds Rate       (DFF)
    - CPI / Inflation      (CPIAUCSL)
    - 10-Year Treasury     (GS10)
    - US Dollar Index      (DTWEXBGS)
    - Real GDP             (GDP)      — quarterly, display only
    - Unemployment Rate    (UNRATE)

  Crypto Fear & Greed Index — alternative.me, completely free, no key
    - Composite sentiment score 0-100 for Bitcoin

All data is cached for 1 hour to respect rate limits.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# ── Simple in-memory cache to avoid hammering APIs ───────────
_cache: Dict[str, dict] = {}
CACHE_TTL_MINUTES = 60


def _is_fresh(key: str) -> bool:
    if key not in _cache:
        return False
    age = datetime.utcnow() - _cache[key]["fetched_at"]
    return age < timedelta(minutes=CACHE_TTL_MINUTES)


# ── FRED series we care about ─────────────────────────────────
FRED_SERIES = {
    "fed_funds_rate":   {"id": "DFF",       "label": "Fed Funds Rate",        "unit": "%"},
    "cpi":              {"id": "CPIAUCSL",  "label": "CPI (YoY Inflation)",    "unit": "index"},
    "treasury_10y":     {"id": "GS10",      "label": "10-Year Treasury Yield", "unit": "%"},
    "usd_index":        {"id": "DTWEXBGS",  "label": "US Dollar Index",        "unit": "index"},
    "gdp":              {"id": "GDP",       "label": "Real GDP",               "unit": "USD bn"},
    "unemployment":     {"id": "UNRATE",    "label": "Unemployment Rate",      "unit": "%"},
    "vix":              {"id": "VIXCLS",    "label": "VIX (Volatility Index)", "unit": "points"},
}

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


async def _fetch_fred_series(series_id: str, api_key: Optional[str] = None) -> Optional[float]:
    """
    Fetch the latest observation for a FRED series.
    Returns the most recent value, or None on failure.
    If no API key, uses FRED's guest access (limited but works for latest values).
    """
    params = {
        "series_id": series_id,
        "sort_order": "desc",
        "limit": 5,
        "file_type": "json",
    }
    if api_key:
        params["api_key"] = api_key
    else:
        # FRED requires an API key — register free at fred.stlouisfed.org
        logger.debug(f"No FRED API key — skipping fetch for {series_id}")
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(FRED_BASE, params=params)
            if resp.status_code == 200:
                data = resp.json()
                observations = data.get("observations", [])
                for obs in observations:
                    val = obs.get("value", ".")
                    if val != ".":
                        return float(val)
    except Exception as e:
        logger.warning(f"FRED fetch failed for {series_id}: {e}")
    return None


async def _fetch_fred_history(series_id: str, limit: int = 24, api_key: Optional[str] = None):
    """Fetch recent historical observations for a FRED series."""
    params = {
        "series_id": series_id,
        "sort_order": "desc",
        "limit": limit,
        "file_type": "json",
    }
    if api_key:
        params["api_key"] = api_key
    else:
        logger.debug(f"No FRED API key — skipping history fetch for {series_id}")
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(FRED_BASE, params=params)
            if resp.status_code == 200:
                data = resp.json()
                obs = data.get("observations", [])
                result = []
                for o in reversed(obs):
                    if o.get("value", ".") != ".":
                        result.append({
                            "date": o["date"],
                            "value": float(o["value"]),
                        })
                return result
    except Exception as e:
        logger.warning(f"FRED history failed for {series_id}: {e}")
    return []


async def _fallback_macro() -> Dict:
    """
    Fallback macro values when FRED is unavailable (no API key).
    Uses publicly available approximate current values.
    These are refreshed each startup — replace with FRED once you have a key.
    """
    logger.info("Using fallback macro data (add FRED_API_KEY to .env for live data)")
    return {
        "fed_funds_rate":  {"value": 5.33,   "label": "Fed Funds Rate",        "unit": "%",       "source": "fallback"},
        "cpi":             {"value": 313.5,  "label": "CPI Index",              "unit": "index",   "source": "fallback"},
        "cpi_yoy":         {"value": 2.4,    "label": "CPI YoY",                "unit": "%",       "source": "fallback"},
        "treasury_10y":    {"value": 4.45,   "label": "10-Year Treasury Yield", "unit": "%",       "source": "fallback"},
        "usd_index":       {"value": 104.2,  "label": "US Dollar Index",        "unit": "index",   "source": "fallback"},
        "gdp":             {"value": 28500,  "label": "Real GDP",               "unit": "USD bn",  "source": "fallback"},
        "unemployment":    {"value": 3.9,    "label": "Unemployment Rate",      "unit": "%",       "source": "fallback"},
        "vix":             {"value": 18.5,   "label": "VIX",                    "unit": "points",  "source": "fallback"},
    }


# ── Crypto Fear & Greed Index ─────────────────────────────────

FEAR_GREED_URL = "https://api.alternative.me/fng/"


async def fetch_fear_greed(limit: int = 30) -> Dict:
    """
    Fetch the Crypto Fear & Greed Index.
    Returns current value + 30-day history for charting.
    This API is free and requires no authentication.
    """
    cache_key = f"fear_greed_{limit}"
    if _is_fresh(cache_key):
        return _cache[cache_key]["data"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(FEAR_GREED_URL, params={"limit": limit, "format": "json"})
            resp.raise_for_status()
            raw = resp.json()

        data_points = raw.get("data", [])
        if not data_points:
            return _fear_greed_fallback()

        current = data_points[0]
        value = int(current["value"])
        classification = current["value_classification"]

        history = [
            {
                "date": datetime.utcfromtimestamp(int(p["timestamp"])).strftime("%Y-%m-%d"),
                "value": int(p["value"]),
                "classification": p["value_classification"],
            }
            for p in data_points
        ]

        result = {
            "value": value,
            "classification": classification,
            "label": _fng_label(value),
            "color": _fng_color(value),
            "description": _fng_description(value),
            "history": history,
            "source": "alternative.me",
            "updated_at": datetime.utcnow().isoformat(),
        }

        _cache[cache_key] = {"data": result, "fetched_at": datetime.utcnow()}
        return result

    except Exception as e:
        logger.warning(f"Fear & Greed fetch failed: {e}")
        return _fear_greed_fallback()


def _fng_label(value: int) -> str:
    if value >= 75: return "Extreme Greed"
    if value >= 55: return "Greed"
    if value >= 46: return "Neutral"
    if value >= 26: return "Fear"
    return "Extreme Fear"


def _fng_color(value: int) -> str:
    if value >= 75: return "#22c55e"   # green
    if value >= 55: return "#86efac"   # light green
    if value >= 46: return "#fbbf24"   # amber
    if value >= 26: return "#f97316"   # orange
    return "#ef4444"                   # red


def _fng_description(value: int) -> str:
    if value >= 75:
        return "Markets are extremely greedy. Historically a contrarian sell signal — consider reducing exposure."
    if value >= 55:
        return "Greed is driving the market. Momentum is positive but risk of correction is elevated."
    if value >= 46:
        return "Sentiment is neutral. No strong directional bias from crowd psychology."
    if value >= 26:
        return "Fear dominates. Historically a contrarian buy signal — potential accumulation opportunity."
    return "Extreme fear in the market. Historically strong contrarian buy signal. High conviction dip-buyers."


def _fear_greed_fallback() -> Dict:
    return {
        "value": 50,
        "classification": "Neutral",
        "label": "Neutral",
        "color": "#fbbf24",
        "description": "Fear & Greed data temporarily unavailable.",
        "history": [],
        "source": "fallback",
        "updated_at": datetime.utcnow().isoformat(),
    }


# ── Main public API ───────────────────────────────────────────

async def get_macro_snapshot(fred_api_key: Optional[str] = None) -> Dict:
    """
    Return a full macro snapshot: all FRED indicators + Fear & Greed.
    Cached for 1 hour.
    """
    cache_key = "macro_snapshot"
    if _is_fresh(cache_key):
        return _cache[cache_key]["data"]

    # Fear & Greed runs in parallel with FRED calls
    fear_greed_task = asyncio.create_task(fetch_fear_greed(30))

    # FRED data (requires API key — gracefully degrades to fallback)
    macro_data: Dict = {}
    if fred_api_key and fred_api_key not in ("", "your-fred-api-key-here"):
        tasks = {
            name: asyncio.create_task(_fetch_fred_series(info["id"], fred_api_key))
            for name, info in FRED_SERIES.items()
        }
        for name, task in tasks.items():
            try:
                value = await task
                macro_data[name] = {
                    "value": value,
                    "label": FRED_SERIES[name]["label"],
                    "unit": FRED_SERIES[name]["unit"],
                    "source": "FRED",
                }
            except Exception as e:
                logger.warning(f"FRED task failed for {name}: {e}")

        # Fill missing/unusable FRED results with fallback values instead of
        # returning `source: FRED` entries whose values are null.
        fallback_macro = await _fallback_macro()
        for name, fallback_value in fallback_macro.items():
            current = macro_data.get(name)
            if not current or current.get("value") is None:
                macro_data[name] = fallback_value
    else:
        macro_data = await _fallback_macro()

    fear_greed = await fear_greed_task

    # Derived insight for Gold and BTC
    macro_data["fear_greed"] = fear_greed
    macro_data["insights"] = _generate_macro_insights(macro_data, fear_greed)
    macro_data["updated_at"] = datetime.utcnow().isoformat()

    _cache[cache_key] = {"data": macro_data, "fetched_at": datetime.utcnow()}
    return macro_data


async def get_macro_history(series_name: str, limit: int = 24,
                            fred_api_key: Optional[str] = None) -> List[Dict]:
    """Return historical observations for a named FRED series."""
    if series_name not in FRED_SERIES:
        return []
    series_id = FRED_SERIES[series_name]["id"]
    return await _fetch_fred_history(series_id, limit, fred_api_key)


def _generate_macro_insights(macro: Dict, fear_greed: Dict) -> List[Dict]:
    """
    Generate plain-English macro insights relevant to BTC and Gold.
    These appear as context cards on the dashboard.
    """
    insights = []

    # Fed Funds Rate → Gold
    ffr = macro.get("fed_funds_rate", {}).get("value")
    if ffr is not None:
        if ffr > 5.0:
            insights.append({
                "title": "High Interest Rates",
                "body": f"Fed Funds Rate at {ffr:.2f}%. Elevated rates increase the opportunity cost "
                        "of holding Gold (a non-yielding asset) and typically exert downward pressure.",
                "sentiment": "BEARISH",
                "asset": "GOLD",
                "icon": "trending_down",
            })
        elif ffr < 2.0:
            insights.append({
                "title": "Low Interest Rates",
                "body": f"Fed Funds Rate at {ffr:.2f}%. Low rates reduce the opportunity cost of Gold "
                        "and historically support higher Gold prices.",
                "sentiment": "BULLISH",
                "asset": "GOLD",
                "icon": "trending_up",
            })

    # 10-Year Treasury → Gold
    t10 = macro.get("treasury_10y", {}).get("value")
    if t10 is not None:
        if t10 > 4.5:
            insights.append({
                "title": "High Treasury Yields",
                "body": f"10-Year yield at {t10:.2f}%. When real yields rise, Gold faces headwinds "
                        "as bonds become a competitive store of value.",
                "sentiment": "BEARISH",
                "asset": "GOLD",
                "icon": "warning",
            })

    # USD Index → Both
    usd = macro.get("usd_index", {}).get("value")
    if usd is not None:
        if usd > 105:
            insights.append({
                "title": "Strong US Dollar",
                "body": f"DXY at {usd:.1f}. A strong dollar typically pressures both Gold and Bitcoin "
                        "as dollar-denominated assets become more expensive globally.",
                "sentiment": "BEARISH",
                "asset": "BOTH",
                "icon": "attach_money",
            })
        elif usd < 98:
            insights.append({
                "title": "Weak US Dollar",
                "body": f"DXY at {usd:.1f}. Dollar weakness historically benefits Gold as a hedge "
                        "and supports Bitcoin as an alternative store of value.",
                "sentiment": "BULLISH",
                "asset": "BOTH",
                "icon": "trending_up",
            })

    # Fear & Greed → BTC
    fg = fear_greed.get("value")
    if fg is not None:
        insights.append({
            "title": f"BTC Sentiment: {fear_greed.get('label', '')}",
            "body": fear_greed.get("description", ""),
            "sentiment": "BULLISH" if fg < 30 else ("BEARISH" if fg > 70 else "NEUTRAL"),
            "asset": "BTC",
            "icon": "psychology",
        })

    return insights
