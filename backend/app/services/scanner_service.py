"""
Deep Stock Insights - AI Scanner Service
Runs LightGBM + indicator signals across all configured assets simultaneously,
scores and ranks them, then generates plain-English insights.

Used by the AI Insights page.
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional

from app.services.asset_registry import ALL_ASSETS, list_crypto, list_stocks
from app.services.market_service import get_historical_data
from app.services.indicators_service import compute_indicators
from app.services.lightgbm_service import predict_lightgbm
from app.config import settings

logger = logging.getLogger(__name__)


# ─── Scoring weights ─────────────────────────────────────────

WEIGHTS = {
    "lgbm_signal":     0.35,   # LightGBM direction
    "rsi_signal":      0.12,   # RSI momentum
    "macd_signal":     0.12,   # MACD crossover
    "bb_signal":       0.08,   # Bollinger position
    "trend_signal":    0.15,   # Price vs SMA50
    "volume_signal":   0.08,   # Volume confirmation
    "adx_signal":      0.10,   # Trend strength (ADX)
}


def _score_asset(model_result: Dict, indicators: Dict) -> Dict:
    """
    Produce a composite score (-1 to +1) from LightGBM + indicator signals.
    Returns score, component breakdown, and derived signal.
    """
    components = {}

    # LightGBM signal
    model_sig = model_result.get("signal", "HOLD")
    model_conf = model_result.get("confidence", 50) / 100
    if model_sig == "BUY":
        components["lgbm_signal"] = model_conf
    elif model_sig == "SELL":
        components["lgbm_signal"] = -model_conf
    else:
        components["lgbm_signal"] = 0.0

    # RSI (oversold < 35 = bullish, overbought > 65 = bearish)
    rsi = indicators.get("rsi_14")
    if rsi is not None:
        if rsi < 35:
            components["rsi_signal"] = (35 - rsi) / 35
        elif rsi > 65:
            components["rsi_signal"] = -(rsi - 65) / 35
        else:
            components["rsi_signal"] = 0.0

    # MACD histogram direction
    macd_hist = indicators.get("macd_histogram")
    macd_val  = indicators.get("macd")
    if macd_hist is not None and macd_val is not None:
        components["macd_signal"] = np.tanh(macd_hist / (abs(macd_val) + 1e-8))

    # Bollinger % B (< 0.2 oversold = bullish, > 0.8 overbought = bearish)
    bb_pct = indicators.get("bb_percent")
    if bb_pct is not None:
        if bb_pct < 0.2:
            components["bb_signal"] = (0.2 - bb_pct) / 0.2
        elif bb_pct > 0.8:
            components["bb_signal"] = -(bb_pct - 0.8) / 0.2
        else:
            components["bb_signal"] = 0.0

    # Trend: price vs SMA50
    price = indicators.get("current_price", 0)
    sma50 = indicators.get("sma_50")
    if sma50 and sma50 > 0:
        dev = (price - sma50) / sma50
        components["trend_signal"] = np.tanh(dev * 10)

    # Volume: above-average volume confirms trend direction
    obv_val = indicators.get("obv")
    vwap_val = indicators.get("vwap")
    if obv_val is not None and price and vwap_val and vwap_val > 0:
        # Price above VWAP with rising OBV = bullish volume confirmation
        vwap_dev = (price - vwap_val) / vwap_val
        components["volume_signal"] = np.tanh(vwap_dev * 5)
    else:
        components["volume_signal"] = 0.0

    # ADX trend strength (> 25 = trending = amplify existing signal)
    adx = indicators.get("adx_14")
    if adx is not None:
        trend_amp = min(adx / 50, 1.0)
        existing = components.get("trend_signal", 0)
        components["adx_signal"] = existing * trend_amp

    # Weighted composite
    score = sum(WEIGHTS.get(k, 0) * v for k, v in components.items())
    score = max(-1.0, min(1.0, score))

    if score > 0.25:
        signal = "BUY"
        strength = score
    elif score < -0.25:
        signal = "SELL"
        strength = abs(score)
    else:
        signal = "HOLD"
        strength = 1 - abs(score) / 0.25

    return {
        "score": round(score, 4),
        "signal": signal,
        "strength": round(strength, 4),
        "components": {k: round(v, 4) for k, v in components.items()},
    }


def _generate_insight(symbol: str, name: str, score_data: Dict,
                      indicators: Dict, model_result: Dict, asset_type: str) -> str:
    """Generate a 2-3 sentence plain-English insight for an asset."""
    signal  = score_data["signal"]
    score   = score_data["score"]
    rsi     = indicators.get("rsi_14")
    macd    = indicators.get("macd_histogram")
    price   = indicators.get("current_price", 0)
    sma50   = indicators.get("sma_50")
    adx     = indicators.get("adx_14")
    pred = model_result.get("predicted_price", price)
    chg_pct = model_result.get("predicted_change_pct", 0)

    lines = []

    # Opening line: price + model forecast
    direction = "rise" if chg_pct > 0 else "fall"
    lines.append(
        f"{name} is currently priced at ${price:,.2f}. "
        f"The LightGBM model forecasts a {direction} of {abs(chg_pct):.2f}% "
        f"to approximately ${pred:,.2f} in the next session."
    )

    # Indicator context
    indicator_notes = []
    if rsi is not None:
        if rsi < 35:
            indicator_notes.append(f"RSI at {rsi:.0f} signals oversold conditions")
        elif rsi > 65:
            indicator_notes.append(f"RSI at {rsi:.0f} signals overbought territory")
        else:
            indicator_notes.append(f"RSI at {rsi:.0f} is neutral")

    if sma50 and price:
        rel = ((price - sma50) / sma50) * 100
        above_below = "above" if rel > 0 else "below"
        indicator_notes.append(f"price is {abs(rel):.1f}% {above_below} the 50-day SMA")

    if adx is not None:
        if adx > 25:
            indicator_notes.append(f"ADX at {adx:.0f} confirms a strong trend")
        else:
            indicator_notes.append(f"ADX at {adx:.0f} suggests a weak/ranging market")

    if indicator_notes:
        lines.append(". ".join(s.capitalize() for s in indicator_notes) + ".")

    # Risk note
    if signal == "BUY":
        lines.append("Consider confirming with volume and broader market sentiment before acting.")
    elif signal == "SELL":
        lines.append("Watch for support levels and consider tightening stop-losses.")
    else:
        lines.append("No clear directional edge — wait for a stronger signal before entering.")

    lines.append("⚠️ Educational only. Not financial advice.")
    return " ".join(lines)


# ─── Main scanner ─────────────────────────────────────────────

async def _scan_single(symbol: str, asset_info: dict) -> Optional[Dict]:
    """Scan one asset: fetch data → indicators → LightGBM → score."""
    try:
        # Map symbol to yfinance ticker
        ticker = asset_info.get("ticker", symbol)
        asset_type = asset_info.get("type", "stock")
        name = asset_info.get("name", symbol)

        df = await get_historical_data(symbol, period="1y")
        if df.empty or len(df) < 60:
            return None

        indicators = compute_indicators(df)
        if "error" in indicators:
            return None

        # Run LightGBM (use cached model if available, else skip deep prediction)
        model_result = predict_lightgbm(symbol, df, settings.MODEL_SAVE_PATH)
        if model_result.get("status") == "untrained":
            # Fall back to indicator-only signal
            model_result = {
                "signal": indicators.get("overall_signal", "HOLD"),
                "confidence": 50.0,
                "predicted_price": indicators.get("lobf_predicted_next", indicators["current_price"]),
                "current_price": indicators["current_price"],
                "predicted_change_pct": 0.0,
                "status": "indicator_only",
            }

        score_data = _score_asset(model_result, indicators)
        insight = _generate_insight(symbol, name, score_data, indicators, model_result, asset_type)

        return {
            "symbol": symbol,
            "name": name,
            "type": asset_type,
            "sector": asset_info.get("sector", ""),
            "current_price": indicators.get("current_price"),
            "predicted_price": model_result.get("predicted_price"),
            "predicted_change_pct": model_result.get("predicted_change_pct"),
            "signal": score_data["signal"],
            "score": score_data["score"],
            "strength": score_data["strength"],
            "confidence": model_result.get("confidence"),
            "rsi_14": indicators.get("rsi_14"),
            "macd_histogram": indicators.get("macd_histogram"),
            "adx_14": indicators.get("adx_14"),
            "bb_percent": indicators.get("bb_percent"),
            "sma_50": indicators.get("sma_50"),
            "overall_indicator_signal": indicators.get("overall_signal"),
            "bullish_count": indicators.get("bullish_count"),
            "bearish_count": indicators.get("bearish_count"),
            "model_used": "lightgbm" if model_result.get("status") == "ok" else "indicators",
            "insight": insight,
            "score_components": score_data["components"],
            "scanned_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.warning(f"Scanner failed for {symbol}: {e}")
        return None


async def run_scanner(
    asset_type: str = "all",   # "all" | "crypto" | "stocks"
    top_n: int = 40,
) -> Dict:
    """
    Run the full market scanner across configured assets.
    Returns ranked results split into BUY / HOLD / SELL buckets.
    """
    if asset_type == "crypto":
        assets = {k: v for k, v in ALL_ASSETS.items() if v.get("type") in ("crypto", "commodity")}
    elif asset_type == "stocks":
        assets = {k: v for k, v in ALL_ASSETS.items() if v.get("type") == "stock"}
    else:
        assets = ALL_ASSETS

    # Limit to top_n to avoid hammering APIs
    asset_items = list(assets.items())[:top_n]

    logger.info(f"Scanner running on {len(asset_items)} assets...")

    # Run all scans concurrently (with a semaphore to avoid rate limits)
    sem = asyncio.Semaphore(5)

    async def bounded_scan(sym, info):
        async with sem:
            return await _scan_single(sym, info)

    tasks = [bounded_scan(sym, info) for sym, info in asset_items]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    results = [r for r in results if r and not isinstance(r, Exception)]

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    buys  = [r for r in results if r["signal"] == "BUY"]
    sells = [r for r in results if r["signal"] == "SELL"]
    holds = [r for r in results if r["signal"] == "HOLD"]

    # Top 5 insights
    top_opportunities = results[:5]
    top_insights = [r["insight"] for r in top_opportunities]

    # Sector breakdown
    sector_signals: Dict[str, list] = {}
    for r in results:
        s = r.get("sector") or r.get("type", "Other")
        sector_signals.setdefault(s, []).append(r["score"])
    sector_summary = {
        s: {"avg_score": round(float(np.mean(scores)), 4), "count": len(scores)}
        for s, scores in sector_signals.items()
    }

    return {
        "scanned_at": datetime.utcnow().isoformat(),
        "total_scanned": len(results),
        "summary": {
            "buy_count": len(buys),
            "hold_count": len(holds),
            "sell_count": len(sells),
            "market_bias": "BULLISH" if len(buys) > len(sells) + 5
                           else ("BEARISH" if len(sells) > len(buys) + 5 else "NEUTRAL"),
        },
        "top_opportunities": top_opportunities,
        "top_insights": top_insights,
        "sector_breakdown": sector_summary,
        "all_results": results,
        "buy_signals":  buys,
        "sell_signals": sells,
        "hold_signals": holds,
    }
