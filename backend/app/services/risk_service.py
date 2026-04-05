"""
Deep Stock Insights - Risk Management Service
Computes stop-loss, take-profit, and position sizing for BUY/SELL signals.

Three risk tiers:
  Conservative  — tight SL (1× ATR), modest TP (1.5× ATR), R:R ≈ 1.5
  Standard      — 2× ATR SL, 3× ATR TP, R:R ≈ 1.5
  Aggressive    — 3× ATR SL, 5× ATR TP, R:R ≈ 1.67

When ATR is unavailable (sparse data), percentage-based fallbacks are used.
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# ATR multipliers per risk tier
_TIERS = {
    "conservative": {"sl_mult": 1.0, "tp_mult": 1.5},
    "standard":     {"sl_mult": 2.0, "tp_mult": 3.0},
    "aggressive":   {"sl_mult": 3.0, "tp_mult": 5.0},
}

# Fallback % when ATR is None
_FALLBACK_SL_PCT = {"conservative": 0.02, "standard": 0.04, "aggressive": 0.06}
_FALLBACK_TP_PCT = {"conservative": 0.03, "standard": 0.06, "aggressive": 0.10}


def _sl_tp(price: float, signal: str, sl_dist: float, tp_dist: float):
    """Return (stop_loss, take_profit) based on signal direction."""
    if signal == "BUY":
        return round(price - sl_dist, 4), round(price + tp_dist, 4)
    elif signal == "SELL":
        return round(price + sl_dist, 4), round(price - tp_dist, 4)
    else:   # HOLD
        return None, None


def _rr(sl_dist: float, tp_dist: float) -> float:
    if sl_dist == 0:
        return 0.0
    return round(tp_dist / sl_dist, 2)


def compute_risk_levels(
    asset: str,
    current_price: float,
    signal: str,
    atr: Optional[float] = None,
) -> Dict:
    """
    Compute stop-loss and take-profit at three risk tiers for a BUY or SELL signal.
    Returns a dict matching the StopLossTakeProfit schema.
    """
    signal = signal.upper()
    result: Dict = {
        "asset": asset,
        "current_price": current_price,
        "signal": signal,
        "atr": round(atr, 4) if atr else None,
    }

    for tier_name, mults in _TIERS.items():
        if atr and atr > 0:
            sl_dist = atr * mults["sl_mult"]
            tp_dist = atr * mults["tp_mult"]
        else:
            sl_dist = current_price * _FALLBACK_SL_PCT[tier_name]
            tp_dist = current_price * _FALLBACK_TP_PCT[tier_name]

        sl, tp = _sl_tp(current_price, signal, sl_dist, tp_dist)
        rr = _rr(sl_dist, tp_dist)
        risk_pct = round((sl_dist / current_price) * 100, 4) if current_price else 0

        result[f"stop_loss_{tier_name}"] = sl
        result[f"take_profit_{tier_name}"] = tp
        result[f"rr_{tier_name}"] = rr
        result[f"risk_pct_{tier_name}"] = risk_pct

    return result


def attach_risk_to_prediction(prediction: Dict, atr: Optional[float] = None) -> Dict:
    """
    Attach stop-loss and take-profit to a prediction dict (standard tier only).
    Mutates and returns the prediction dict.
    """
    signal = prediction.get("signal", "HOLD")
    current_price = prediction.get("current_price", 0)
    asset = prediction.get("asset", "BTC")

    risk = compute_risk_levels(asset, current_price, signal, atr)

    prediction["stop_loss"] = risk.get("stop_loss_standard")
    prediction["take_profit"] = risk.get("take_profit_standard")
    prediction["risk_reward_ratio"] = risk.get("rr_standard")
    return prediction


def position_size_advice(
    account_balance: float,
    risk_pct_of_account: float,
    stop_loss_dist: float,
    current_price: float,
) -> Dict:
    """
    Calculate recommended position size using the fixed fractional method.
    risk_pct_of_account: e.g. 0.01 for 1% risk
    """
    if stop_loss_dist <= 0 or current_price <= 0:
        return {"error": "Invalid stop-loss distance or price"}

    risk_amount = account_balance * risk_pct_of_account
    units = risk_amount / stop_loss_dist
    position_value = units * current_price
    position_pct = (position_value / account_balance) * 100 if account_balance else 0

    return {
        "account_balance": round(account_balance, 2),
        "risk_pct": round(risk_pct_of_account * 100, 2),
        "risk_amount": round(risk_amount, 2),
        "recommended_units": round(units, 6),
        "position_value": round(position_value, 2),
        "position_pct_of_account": round(position_pct, 2),
        "note": "Educational estimate. Always verify with your broker or financial advisor.",
    }
