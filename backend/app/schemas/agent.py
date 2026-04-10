"""Pydantic schemas for the Agent API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CreateSessionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    assets: str = Field(..., description="Comma-separated asset symbols, e.g. BTC,GOLD,TSLA")
    strategy: str = Field(default="signal_follower")
    initial_capital: float = Field(default=10000.0, gt=0)
    risk_per_trade: float = Field(default=0.02, gt=0, le=0.1)
    max_open_trades: int = Field(default=5, ge=1, le=20)
    notes: Optional[str] = None


class UpdateSessionRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(running|paused|stopped)$")
    risk_per_trade: Optional[float] = Field(None, gt=0, le=0.1)
    max_open_trades: Optional[int] = Field(None, ge=1, le=20)
    notes: Optional[str] = None


class SessionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    id: int
    name: str
    user_id: int
    strategy: str
    assets: str
    risk_per_trade: float
    max_open_trades: int
    initial_capital: float
    current_capital: float
    status: str
    notes: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    stopped_at: Optional[datetime]

class TradeResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    id: int
    session_id: int
    prediction_id: Optional[int]
    asset: str
    side: str
    quantity: float
    entry_price: float
    exit_price: Optional[float]
    stop_loss: Optional[float]
    take_profit: Optional[float]
    signal: Optional[str]
    signal_strength: Optional[float]
    confidence: Optional[float]
    prediction_horizon: Optional[str]
    prediction_run_id: Optional[str]
    model_key_used: Optional[str]
    model_version_used: Optional[str]
    decision_source: Optional[str]
    decision_notes: Optional[str]
    status: str
    pnl: Optional[float]
    pnl_pct: Optional[float]
    exit_reason: Optional[str]
    opened_at: Optional[datetime]
    closed_at: Optional[datetime]

class CloseTradeRequest(BaseModel):
    exit_price: float = Field(..., gt=0)


class SnapshotResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    id: int
    session_id: int
    total_value: float
    cash: float
    unrealised_pnl: float
    open_positions: int
    total_trades: int
    win_rate: Optional[float]
    timestamp: Optional[datetime]

class SessionStatsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    total_trades: int
    open_trades: int
    winners: int
    losers: int
    win_rate: float
    total_pnl: float
    return_pct: float
    current_capital: float


class CycleResultResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    closed: list
    opened: list
    held: list
