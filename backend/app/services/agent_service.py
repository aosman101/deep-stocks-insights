"""
Deep Stock Insights - AI Agent Service
Paper-trading agent that executes trades based on N-HiTS/LightGBM signals.

Strategies:
  signal_follower — opens positions when signal strength exceeds threshold,
                    respects stop-loss/take-profit from risk_service.
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.agent import (
    AgentSession, AgentTrade, AgentPortfolioSnapshot,
    AgentStatus, TradeSide, TradeStatus,
)
from app.services.market_service import get_live_quote
from app.services.prediction_service import get_prediction
from app.services.risk_service import compute_risk_levels

logger = logging.getLogger(__name__)

SIGNAL_THRESHOLD = 0.4  # minimum signal strength to act


async def run_agent_cycle(session: AgentSession, db: Session) -> Dict:
    """
    Run one decision cycle for an agent session.
    1. Check open trades for stop-loss / take-profit hits
    2. Evaluate new signals for session assets
    3. Open new trades if criteria met
    Returns a summary of actions taken.
    """
    if session.status != AgentStatus.RUNNING.value:
        return {"skipped": True, "reason": f"session status is {session.status}"}

    actions = {"closed": [], "opened": [], "held": []}
    assets = [a.strip() for a in session.assets.split(",") if a.strip()]

    # Step 1: Check open trades
    open_trades = (
        db.query(AgentTrade)
        .filter(AgentTrade.session_id == session.id, AgentTrade.status == TradeStatus.OPEN.value)
        .all()
    )

    for trade in open_trades:
        try:
            quote = await get_live_quote(trade.asset)
            current_price = quote.get("price", 0)
            if not current_price:
                continue

            closed = _check_exit_conditions(trade, current_price, session, db)
            if closed:
                actions["closed"].append({
                    "asset": trade.asset, "pnl": trade.pnl,
                    "reason": trade.exit_reason,
                })
            else:
                actions["held"].append({"asset": trade.asset, "price": current_price})
        except Exception as e:
            logger.warning(f"Agent cycle: error checking trade {trade.id}: {e}")

    # Step 2: Evaluate new signals
    open_count = (
        db.query(AgentTrade)
        .filter(AgentTrade.session_id == session.id, AgentTrade.status == TradeStatus.OPEN.value)
        .count()
    )

    for asset in assets:
        if open_count >= session.max_open_trades:
            break

        # Skip if we already have an open position in this asset
        existing = (
            db.query(AgentTrade)
            .filter(
                AgentTrade.session_id == session.id,
                AgentTrade.asset == asset,
                AgentTrade.status == TradeStatus.OPEN.value,
            )
            .first()
        )
        if existing:
            continue

        try:
            trade = await _evaluate_and_open(session, asset, db)
            if trade:
                actions["opened"].append({
                    "asset": trade.asset, "side": trade.side,
                    "entry_price": trade.entry_price, "quantity": trade.quantity,
                })
                open_count += 1
        except Exception as e:
            logger.warning(f"Agent cycle: error evaluating {asset}: {e}")

    # Step 3: Take portfolio snapshot
    _take_snapshot(session, db)

    db.commit()
    return actions


def _check_exit_conditions(
    trade: AgentTrade, current_price: float, session: AgentSession, db: Session
) -> bool:
    """Check if a trade should be closed (stop-loss, take-profit)."""
    if trade.side == TradeSide.BUY.value:
        if trade.stop_loss and current_price <= trade.stop_loss:
            return _close_trade(trade, current_price, "stop_loss", session, db)
        if trade.take_profit and current_price >= trade.take_profit:
            return _close_trade(trade, current_price, "take_profit", session, db)
    elif trade.side == TradeSide.SELL.value:
        if trade.stop_loss and current_price >= trade.stop_loss:
            return _close_trade(trade, current_price, "stop_loss", session, db)
        if trade.take_profit and current_price <= trade.take_profit:
            return _close_trade(trade, current_price, "take_profit", session, db)
    return False


def _close_trade(
    trade: AgentTrade, exit_price: float, reason: str,
    session: AgentSession, db: Session,
) -> bool:
    """Close a trade and update session capital."""
    trade.exit_price = exit_price
    trade.status = TradeStatus.CLOSED.value
    trade.exit_reason = reason
    trade.closed_at = datetime.utcnow()

    if trade.side == TradeSide.BUY.value:
        trade.pnl = (exit_price - trade.entry_price) * trade.quantity
    else:
        trade.pnl = (trade.entry_price - exit_price) * trade.quantity

    trade.pnl_pct = (trade.pnl / (trade.entry_price * trade.quantity)) * 100 if trade.entry_price else 0
    session.current_capital += trade.pnl

    logger.info(
        f"Agent closed {trade.side} {trade.asset}: "
        f"entry={trade.entry_price:.2f} exit={exit_price:.2f} "
        f"pnl={trade.pnl:.2f} reason={reason}"
    )
    return True


async def _evaluate_and_open(
    session: AgentSession, asset: str, db: Session
) -> Optional[AgentTrade]:
    """Evaluate signals and open a new trade if criteria met."""
    quote = await get_live_quote(asset)
    current_price = quote.get("price", 0)
    if not current_price:
        return None

    # Get prediction signal
    try:
        prediction = await get_prediction(asset, horizon="1d")
    except Exception:
        return None

    signal = prediction.get("signal")
    strength = prediction.get("signal_strength", 0)
    confidence = prediction.get("confidence", 0)

    if not signal or signal == "HOLD" or strength < SIGNAL_THRESHOLD:
        return None

    # Position sizing: risk-based
    risk_amount = session.current_capital * session.risk_per_trade
    risk_levels = prediction.get("risk", {})
    stop_loss = risk_levels.get("stop_loss_standard")
    take_profit = risk_levels.get("take_profit_standard")

    # Fallback stop-loss: 2% from entry
    if not stop_loss:
        if signal == "BUY":
            stop_loss = current_price * 0.98
            take_profit = current_price * 1.03
        else:
            stop_loss = current_price * 1.02
            take_profit = current_price * 0.97

    price_risk = abs(current_price - stop_loss)
    if price_risk <= 0:
        return None

    quantity = risk_amount / price_risk
    position_value = quantity * current_price

    # Don't exceed 20% of capital in one trade
    max_position = session.current_capital * 0.20
    if position_value > max_position:
        quantity = max_position / current_price

    side = TradeSide.BUY.value if signal == "BUY" else TradeSide.SELL.value

    trade = AgentTrade(
        session_id=session.id,
        asset=asset,
        side=side,
        quantity=round(quantity, 6),
        entry_price=current_price,
        stop_loss=round(stop_loss, 2),
        take_profit=round(take_profit, 2),
        signal=signal,
        signal_strength=strength,
        confidence=confidence,
        prediction_horizon="1d",
    )
    db.add(trade)

    logger.info(
        f"Agent opened {side} {asset}: price={current_price:.2f} "
        f"qty={quantity:.6f} sl={stop_loss:.2f} tp={take_profit:.2f}"
    )
    return trade


def _take_snapshot(session: AgentSession, db: Session):
    """Record current portfolio state."""
    open_trades = (
        db.query(AgentTrade)
        .filter(AgentTrade.session_id == session.id, AgentTrade.status == TradeStatus.OPEN.value)
        .all()
    )
    closed_trades = (
        db.query(AgentTrade)
        .filter(AgentTrade.session_id == session.id, AgentTrade.status == TradeStatus.CLOSED.value)
        .all()
    )

    total_trades = len(closed_trades)
    winners = sum(1 for t in closed_trades if t.pnl and t.pnl > 0)
    win_rate = (winners / total_trades * 100) if total_trades > 0 else None

    snapshot = AgentPortfolioSnapshot(
        session_id=session.id,
        total_value=session.current_capital,
        cash=session.current_capital,
        unrealised_pnl=0.0,
        open_positions=len(open_trades),
        total_trades=total_trades,
        win_rate=win_rate,
    )
    db.add(snapshot)


async def get_prediction(asset: str, horizon: str = "1d") -> Dict:
    """Wrapper to get prediction from the prediction service."""
    from app.services.prediction_service import predict as svc_predict
    try:
        return await svc_predict(asset, horizon)
    except Exception as e:
        logger.warning(f"Agent prediction failed for {asset}: {e}")
        return {}


def close_trade_manual(trade_id: int, db: Session) -> Optional[AgentTrade]:
    """Manually close a trade at current market price."""
    trade = db.query(AgentTrade).get(trade_id)
    if not trade or trade.status != TradeStatus.OPEN.value:
        return None
    session = db.query(AgentSession).get(trade.session_id)
    if not session:
        return None
    # Caller must provide current price via endpoint
    return trade


def get_session_stats(session: AgentSession, db: Session) -> Dict:
    """Compute aggregate stats for a session."""
    closed = (
        db.query(AgentTrade)
        .filter(AgentTrade.session_id == session.id, AgentTrade.status == TradeStatus.CLOSED.value)
        .all()
    )
    total = len(closed)
    winners = sum(1 for t in closed if t.pnl and t.pnl > 0)
    total_pnl = sum(t.pnl for t in closed if t.pnl)
    open_count = (
        db.query(AgentTrade)
        .filter(AgentTrade.session_id == session.id, AgentTrade.status == TradeStatus.OPEN.value)
        .count()
    )

    return {
        "total_trades": total,
        "open_trades": open_count,
        "winners": winners,
        "losers": total - winners,
        "win_rate": round(winners / total * 100, 1) if total > 0 else 0,
        "total_pnl": round(total_pnl, 2),
        "return_pct": round((session.current_capital - session.initial_capital) / session.initial_capital * 100, 2),
        "current_capital": round(session.current_capital, 2),
    }
