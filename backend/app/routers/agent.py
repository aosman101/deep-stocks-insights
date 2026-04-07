"""
Agent Router — /api/agent
  POST   /sessions              — create a new agent session
  GET    /sessions              — list user's sessions
  GET    /sessions/{id}         — get session detail
  PATCH  /sessions/{id}         — update session config / status
  DELETE /sessions/{id}         — stop and delete session
  POST   /sessions/{id}/run     — trigger one decision cycle
  GET    /sessions/{id}/trades  — list trades for session
  POST   /sessions/{id}/trades/{trade_id}/close — manually close a trade
  GET    /sessions/{id}/stats   — session performance stats
  GET    /sessions/{id}/equity  — portfolio equity curve
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.agent import AgentSession, AgentTrade, AgentPortfolioSnapshot, AgentStatus, TradeStatus
from app.core.dependencies import get_current_active_user
from app.schemas.agent import (
    CreateSessionRequest, UpdateSessionRequest, SessionResponse,
    TradeResponse, CloseTradeRequest, SnapshotResponse,
    SessionStatsResponse, CycleResultResponse,
)
from app.services.agent_service import run_agent_cycle, get_session_stats, _close_trade

router = APIRouter(prefix="/api/agent", tags=["AI Agent"])


def _get_user_session(session_id: int, user: User, db: Session) -> AgentSession:
    session = db.query(AgentSession).filter(AgentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your session")
    return session


# ── Sessions ───────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionResponse, status_code=201)
def create_session(
    payload: CreateSessionRequest,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    session = AgentSession(
        name=payload.name,
        user_id=user.id,
        strategy=payload.strategy,
        assets=payload.assets.upper(),
        risk_per_trade=payload.risk_per_trade,
        max_open_trades=payload.max_open_trades,
        initial_capital=payload.initial_capital,
        current_capital=payload.initial_capital,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=List[SessionResponse])
def list_sessions(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(AgentSession)
        .filter(AgentSession.user_id == user.id)
        .order_by(AgentSession.created_at.desc())
        .all()
    )


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return _get_user_session(session_id, user, db)


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: int,
    payload: UpdateSessionRequest,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    update = payload.model_dump(exclude_unset=True)
    for field, value in update.items():
        if field == "status" and value == AgentStatus.STOPPED.value:
            session.stopped_at = datetime.utcnow()
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    # Close all open trades first
    open_trades = (
        db.query(AgentTrade)
        .filter(AgentTrade.session_id == session.id, AgentTrade.status == TradeStatus.OPEN.value)
        .all()
    )
    for trade in open_trades:
        trade.status = TradeStatus.CLOSED.value
        trade.exit_reason = "session_deleted"
        trade.closed_at = datetime.utcnow()
    db.delete(session)
    db.commit()


# ── Run cycle ─────────────────────────────────────────────────

@router.post("/sessions/{session_id}/run", response_model=CycleResultResponse)
async def run_cycle(
    session_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    if session.status != AgentStatus.RUNNING.value:
        raise HTTPException(400, detail=f"Session is {session.status}, not running")
    result = await run_agent_cycle(session, db)
    return result


# ── Trades ────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/trades", response_model=List[TradeResponse])
def list_trades(
    session_id: int,
    status: str = None,
    limit: int = 50,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    q = db.query(AgentTrade).filter(AgentTrade.session_id == session.id)
    if status:
        q = q.filter(AgentTrade.status == status)
    return q.order_by(AgentTrade.opened_at.desc()).limit(limit).all()


@router.post("/sessions/{session_id}/trades/{trade_id}/close", response_model=TradeResponse)
def close_trade(
    session_id: int,
    trade_id: int,
    payload: CloseTradeRequest,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    trade = db.query(AgentTrade).filter(
        AgentTrade.id == trade_id, AgentTrade.session_id == session.id
    ).first()
    if not trade:
        raise HTTPException(404, detail="Trade not found")
    if trade.status != TradeStatus.OPEN.value:
        raise HTTPException(400, detail="Trade already closed")

    _close_trade(trade, payload.exit_price, "manual", session, db)
    db.commit()
    db.refresh(trade)
    return trade


# ── Stats & Equity ────────────────────────────────────────────

@router.get("/sessions/{session_id}/stats", response_model=SessionStatsResponse)
def session_stats(
    session_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    return get_session_stats(session, db)


@router.get("/sessions/{session_id}/equity", response_model=List[SnapshotResponse])
def equity_curve(
    session_id: int,
    limit: int = 200,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    return (
        db.query(AgentPortfolioSnapshot)
        .filter(AgentPortfolioSnapshot.session_id == session.id)
        .order_by(AgentPortfolioSnapshot.timestamp.asc())
        .limit(limit)
        .all()
    )
