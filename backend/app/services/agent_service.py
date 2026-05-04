"""
Deep Stock Insights - AI Agent Service
Paper-trading agent that executes trades based on N-HiTS/LightGBM signals.

Strategies:
  signal_follower — opens positions when signal strength exceeds threshold,
                    respects stop-loss/take-profit from risk_service.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.agent import (
    AgentDecisionLog, AgentSession, AgentTrade, AgentPortfolioSnapshot,
    AgentStatus, TradeSide, TradeStatus,
)
from app.services.market_service import get_live_quote
from app.services.prediction_record_service import latest_prediction_snapshot

logger = logging.getLogger(__name__)

SIGNAL_THRESHOLD = 0.4  # minimum signal strength to act
AGENT_MAX_PREDICTION_AGE_HOURS = 48
MEMORY_MIN_SAMPLES = 3
MEMORY_RETURN_THRESHOLD = 0.01


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def _signal_to_rating(signal: Optional[str], strength: Optional[float]) -> str:
    """Map BUY/HOLD/SELL to the 5-tier TradingAgents rating vocabulary."""
    signal = (signal or "HOLD").upper()
    strength = float(strength or 0.0)
    if signal == "BUY":
        return "Buy" if strength >= 0.75 else "Overweight"
    if signal == "SELL":
        return "Sell" if strength >= 0.75 else "Underweight"
    return "Hold"


def _market_regime(prediction: Dict[str, Any]) -> str:
    change_pct = float(prediction.get("predicted_change_pct") or 0.0)
    strength = float(prediction.get("signal_strength") or 0.0)

    if change_pct >= 2.5:
        trend = "bull_trend"
    elif change_pct <= -2.5:
        trend = "bear_trend"
    else:
        trend = "range"

    conviction = "high_conviction" if strength >= 0.7 else "low_conviction"
    return f"{trend}_{conviction}"


def _confidence_to_unit(confidence: Optional[float], fallback: float) -> float:
    if confidence is None:
        return _clamp(fallback)
    confidence = float(confidence)
    if confidence > 1.0:
        confidence = confidence / 100.0
    return _clamp(confidence)


def _encode_flags(flags: Optional[List[str]]) -> str:
    if not flags:
        return "[]"
    return json.dumps(list(dict.fromkeys(flag for flag in flags if flag)))


def _memory_assessment(
    db: Session,
    *,
    asset: str,
    signal: Optional[str],
    market_regime: Optional[str],
) -> Dict[str, Any]:
    signal = (signal or "HOLD").upper()
    if signal not in {"BUY", "SELL"}:
        return {"samples": 0, "confidence_multiplier": 1.0, "notes": []}

    rows = (
        db.query(AgentDecisionLog)
        .filter(
            AgentDecisionLog.asset == asset.upper(),
            AgentDecisionLog.signal == signal,
            AgentDecisionLog.status == "resolved",
            AgentDecisionLog.outcome_return.isnot(None),
        )
        .order_by(AgentDecisionLog.resolved_at.desc(), AgentDecisionLog.created_at.desc())
        .limit(50)
        .all()
    )

    same_regime = [row for row in rows if row.market_regime == market_regime]
    candidates = same_regime if len(same_regime) >= MEMORY_MIN_SAMPLES else rows
    values = [float(row.outcome_return) for row in candidates if row.outcome_return is not None]

    if len(values) < MEMORY_MIN_SAMPLES:
        return {
            "samples": len(values),
            "same_regime_samples": len(same_regime),
            "confidence_multiplier": 1.0,
            "notes": ["Insufficient resolved decision memory for this setup"],
        }

    avg_return = sum(values) / len(values)
    win_rate = sum(1 for value in values if value > 0) / len(values)
    multiplier = 1.0
    notes: List[str] = []

    if avg_return <= -MEMORY_RETURN_THRESHOLD or win_rate < 0.40:
        multiplier = 0.85
        notes.append(
            f"Decision memory: similar {signal} setups underperformed "
            f"(avg return {avg_return:+.1%}, win rate {win_rate:.0%})"
        )
    elif avg_return >= MEMORY_RETURN_THRESHOLD and win_rate >= 0.60:
        multiplier = 1.05
        notes.append(
            f"Decision memory: similar {signal} setups outperformed "
            f"(avg return {avg_return:+.1%}, win rate {win_rate:.0%})"
        )

    return {
        "samples": len(values),
        "same_regime_samples": len(same_regime),
        "avg_return": avg_return,
        "win_rate": win_rate,
        "confidence_multiplier": multiplier,
        "notes": notes,
    }


def _log_decision(
    db: Session,
    session: AgentSession,
    *,
    asset: str,
    action: str,
    status: str = "observed",
    trade_id: Optional[int] = None,
    prediction_id: Optional[int] = None,
    signal: Optional[str] = None,
    rating: Optional[str] = None,
    signal_strength: Optional[float] = None,
    confidence: Optional[float] = None,
    adjusted_confidence: Optional[float] = None,
    memory_multiplier: Optional[float] = 1.0,
    entry_price: Optional[float] = None,
    stop_loss: Optional[float] = None,
    take_profit: Optional[float] = None,
    risk_reward_ratio: Optional[float] = None,
    decision_source: str = "prediction_record",
    rationale: Optional[str] = None,
    risk_flags: Optional[List[str]] = None,
    market_regime: Optional[str] = None,
) -> AgentDecisionLog:
    row = AgentDecisionLog(
        session_id=session.id,
        trade_id=trade_id,
        prediction_id=prediction_id,
        asset=asset.upper(),
        action=action,
        status=status,
        signal=signal,
        rating=rating or _signal_to_rating(signal, signal_strength),
        signal_strength=signal_strength,
        confidence=confidence,
        adjusted_confidence=adjusted_confidence,
        memory_multiplier=memory_multiplier,
        entry_price=entry_price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        risk_reward_ratio=risk_reward_ratio,
        decision_source=decision_source,
        rationale=rationale,
        risk_flags=_encode_flags(risk_flags),
        market_regime=market_regime,
    )
    db.add(row)
    db.flush()
    return row


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

    actions = {"closed": [], "opened": [], "held": [], "skipped": []}
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
            _log_decision(
                db,
                session,
                asset=asset,
                action="hold",
                status="observed",
                trade_id=existing.id,
                signal=existing.signal,
                rating=_signal_to_rating(existing.signal, existing.signal_strength),
                signal_strength=existing.signal_strength,
                confidence=existing.confidence,
                entry_price=existing.entry_price,
                stop_loss=existing.stop_loss,
                take_profit=existing.take_profit,
                decision_source=existing.decision_source or "open_position",
                rationale="Existing open position is already active; duplicate exposure was avoided.",
            )
            actions["held"].append({"asset": asset, "reason": "existing_open_position"})
            continue

        if open_count >= session.max_open_trades:
            _log_decision(
                db,
                session,
                asset=asset,
                action="skip",
                rationale=(
                    f"Max open trade limit reached "
                    f"({open_count}/{session.max_open_trades}); no new position evaluated."
                ),
            )
            actions["skipped"].append({"asset": asset, "reason": "max_open_trades"})
            continue

        try:
            trade = await _evaluate_and_open(session, asset, db)
            if trade:
                actions["opened"].append({
                    "asset": trade.asset, "side": trade.side,
                    "entry_price": trade.entry_price, "quantity": trade.quantity,
                })
                open_count += 1
            else:
                actions["held"].append({"asset": asset})
        except Exception as e:
            logger.warning(f"Agent cycle: error evaluating {asset}: {e}")
            _log_decision(
                db,
                session,
                asset=asset,
                action="skip",
                rationale=f"Evaluation failed: {e}",
                risk_flags=["evaluation_error"],
            )
            actions["skipped"].append({"asset": asset, "reason": "evaluation_error"})

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
    _resolve_trade_decision(trade, session, db)

    logger.info(
        f"Agent closed {trade.side} {trade.asset}: "
        f"entry={trade.entry_price:.2f} exit={exit_price:.2f} "
        f"pnl={trade.pnl:.2f} reason={reason}"
    )
    return True


def _resolve_trade_decision(trade: AgentTrade, session: AgentSession, db: Session) -> None:
    decision = (
        db.query(AgentDecisionLog)
        .filter(
            AgentDecisionLog.session_id == session.id,
            AgentDecisionLog.trade_id == trade.id,
            AgentDecisionLog.action == "open",
            AgentDecisionLog.status == "pending",
        )
        .order_by(AgentDecisionLog.created_at.desc())
        .first()
    )
    if decision is None:
        return

    outcome_return = (trade.pnl_pct or 0.0) / 100.0
    decision.status = "resolved"
    decision.outcome_pnl = trade.pnl
    decision.outcome_return = outcome_return
    decision.resolved_at = datetime.utcnow()
    if outcome_return > 0:
        lesson = "The directional call worked; similar setups can keep their current confidence weight."
    elif outcome_return < 0:
        lesson = "The directional call failed; require stronger confirmation before repeating similar exposure."
    else:
        lesson = "The trade closed flat; keep the setup neutral until more samples resolve."
    decision.reflection = (
        f"{decision.rating or trade.signal or 'Hold'} {trade.asset} closed via {trade.exit_reason}. "
        f"Return was {outcome_return:+.1%}. {lesson}"
    )


async def _evaluate_and_open(
    session: AgentSession, asset: str, db: Session
) -> Optional[AgentTrade]:
    """Evaluate stored predictions and open a new trade if criteria met."""
    quote = await get_live_quote(asset)
    current_price = quote.get("price", 0)
    if not current_price:
        _log_decision(
            db,
            session,
            asset=asset,
            action="skip",
            rationale="Live quote was unavailable, so the agent could not price the setup.",
            risk_flags=["quote_unavailable"],
        )
        return None

    prediction = latest_prediction_snapshot(
        db,
        asset,
        horizon="1d",
        max_age_hours=AGENT_MAX_PREDICTION_AGE_HOURS,
    )
    if prediction is None:
        logger.info(f"Agent skipped {asset}: no recent stored prediction was available")
        _log_decision(
            db,
            session,
            asset=asset,
            action="skip",
            entry_price=current_price,
            rationale=(
                f"No stored {AGENT_MAX_PREDICTION_AGE_HOURS}h prediction was available "
                "for the 1d horizon."
            ),
            risk_flags=["missing_prediction"],
        )
        return None

    signal = prediction.get("signal")
    strength = float(prediction.get("signal_strength") or 0)
    confidence = prediction.get("confidence", 0)
    rating = _signal_to_rating(signal, strength)
    market_regime = _market_regime(prediction)
    memory = _memory_assessment(
        db,
        asset=asset,
        signal=signal,
        market_regime=market_regime,
    )
    memory_multiplier = float(memory.get("confidence_multiplier", 1.0) or 1.0)
    adjusted_strength = _clamp(strength * memory_multiplier)
    adjusted_confidence = _clamp(_confidence_to_unit(confidence, strength) * memory_multiplier)
    memory_notes = [str(note) for note in memory.get("notes", []) if note]

    if not signal or signal == "HOLD" or adjusted_strength < SIGNAL_THRESHOLD:
        flags = []
        if not signal:
            flags.append("missing_signal")
        if signal == "HOLD":
            flags.append("model_hold")
        if strength < SIGNAL_THRESHOLD:
            flags.append("weak_signal")
        if adjusted_strength < SIGNAL_THRESHOLD <= strength:
            flags.append("decision_memory_dampened_signal")
        flags.extend(memory_notes)
        _log_decision(
            db,
            session,
            asset=asset,
            action="hold",
            prediction_id=prediction.get("id"),
            signal=signal,
            rating=rating,
            signal_strength=strength,
            confidence=confidence,
            adjusted_confidence=adjusted_confidence,
            memory_multiplier=memory_multiplier,
            entry_price=current_price,
            decision_source="prediction_record",
            rationale=(
                f"Rating {rating}; adjusted signal strength {adjusted_strength:.2f} "
                f"did not clear the {SIGNAL_THRESHOLD:.2f} trade threshold."
            ),
            risk_flags=flags,
            market_regime=market_regime,
        )
        return None

    # Position sizing: risk-based
    risk_amount = session.current_capital * session.risk_per_trade
    risk_levels = prediction.get("risk", {})
    stop_loss = risk_levels.get("stop_loss_standard") or prediction.get("stop_loss")
    take_profit = risk_levels.get("take_profit_standard") or prediction.get("take_profit")

    # Fallback stop-loss: 2% from entry
    if not stop_loss or not take_profit:
        if signal == "BUY":
            stop_loss = current_price * 0.98
            take_profit = current_price * 1.03
        else:
            stop_loss = current_price * 1.02
            take_profit = current_price * 0.97

    price_risk = abs(current_price - stop_loss)
    if price_risk <= 0:
        _log_decision(
            db,
            session,
            asset=asset,
            action="skip",
            prediction_id=prediction.get("id"),
            signal=signal,
            rating=rating,
            signal_strength=strength,
            confidence=confidence,
            adjusted_confidence=adjusted_confidence,
            memory_multiplier=memory_multiplier,
            entry_price=current_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            decision_source="prediction_record",
            rationale="Stop-loss distance was zero or invalid, so the trade could not be sized.",
            risk_flags=["invalid_stop_distance", *memory_notes],
            market_regime=market_regime,
        )
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
        prediction_id=prediction.get("id"),
        asset=asset,
        side=side,
        quantity=round(quantity, 6),
        entry_price=current_price,
        stop_loss=round(stop_loss, 2),
        take_profit=round(take_profit, 2),
        signal=signal,
        signal_strength=strength,
        confidence=confidence,
        prediction_horizon=prediction.get("prediction_horizon") or "1d",
        prediction_run_id=prediction.get("run_id"),
        model_key_used=prediction.get("model_key"),
        model_version_used=prediction.get("model_version"),
        decision_source="prediction_record",
        decision_notes=(
            f"{rating} from stored {prediction.get('model_key')} prediction "
            f"run={prediction.get('run_id')} trigger={prediction.get('trigger_source')} "
            f"memory_multiplier={memory_multiplier:.2f}"
        ),
    )
    db.add(trade)
    db.flush()
    _log_decision(
        db,
        session,
        asset=asset,
        action="open",
        status="pending",
        trade_id=trade.id,
        prediction_id=prediction.get("id"),
        signal=signal,
        rating=rating,
        signal_strength=strength,
        confidence=confidence,
        adjusted_confidence=adjusted_confidence,
        memory_multiplier=memory_multiplier,
        entry_price=current_price,
        stop_loss=round(stop_loss, 2),
        take_profit=round(take_profit, 2),
        risk_reward_ratio=prediction.get("risk_reward_ratio"),
        decision_source="prediction_record",
        rationale=(
            f"Opened {side.upper()} because {rating} signal strength {strength:.2f} "
            f"remained {adjusted_strength:.2f} after decision-memory adjustment."
        ),
        risk_flags=memory_notes,
        market_regime=market_regime,
    )

    logger.info(
        f"Agent opened {side} {asset}: price={current_price:.2f} "
        f"qty={quantity:.6f} sl={stop_loss:.2f} tp={take_profit:.2f} "
        f"prediction_id={prediction.get('id')} model={prediction.get('model_key')}"
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
