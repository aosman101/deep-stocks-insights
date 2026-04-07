"""
Deep Stock Insights - AI Agent Models
Paper-trading agent sessions, trades, and portfolio snapshots.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class AgentStatus(str, enum.Enum):
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"


class TradeSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class TradeStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class AgentSession(Base):
    """A paper-trading agent session with configurable strategy parameters."""
    __tablename__ = "agent_sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Strategy config
    strategy = Column(String(32), nullable=False, default="signal_follower")
    assets = Column(String(512), nullable=False)  # comma-separated: "BTC,GOLD,TSLA"
    risk_per_trade = Column(Float, default=0.02)   # 2% of capital per trade
    max_open_trades = Column(Integer, default=5)

    # Capital
    initial_capital = Column(Float, nullable=False, default=10000.0)
    current_capital = Column(Float, nullable=False, default=10000.0)

    # Status
    status = Column(String(16), nullable=False, default=AgentStatus.RUNNING.value)
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    stopped_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    trades = relationship("AgentTrade", back_populates="session", lazy="dynamic")
    snapshots = relationship("AgentPortfolioSnapshot", back_populates="session", lazy="dynamic")

    def __repr__(self):
        return f"<AgentSession id={self.id} name={self.name} status={self.status}>"


class AgentTrade(Base):
    """Individual trade executed by the agent."""
    __tablename__ = "agent_trades"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("agent_sessions.id"), nullable=False, index=True)

    asset = Column(String(16), nullable=False, index=True)
    side = Column(String(8), nullable=False)  # "buy" or "sell"
    quantity = Column(Float, nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)

    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)

    # Signal context at entry
    signal = Column(String(8), nullable=True)          # BUY/SELL/HOLD
    signal_strength = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    prediction_horizon = Column(String(16), nullable=True)

    # Result
    status = Column(String(16), nullable=False, default=TradeStatus.OPEN.value)
    pnl = Column(Float, nullable=True)               # profit/loss in USD
    pnl_pct = Column(Float, nullable=True)            # % return
    exit_reason = Column(String(32), nullable=True)   # "stop_loss", "take_profit", "signal", "manual"

    # Timestamps
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    session = relationship("AgentSession", back_populates="trades")

    def __repr__(self):
        return f"<AgentTrade id={self.id} {self.side} {self.asset} pnl={self.pnl}>"


class AgentPortfolioSnapshot(Base):
    """Periodic snapshot of agent portfolio value for equity curve charting."""
    __tablename__ = "agent_portfolio_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("agent_sessions.id"), nullable=False, index=True)

    total_value = Column(Float, nullable=False)       # cash + open position value
    cash = Column(Float, nullable=False)
    unrealised_pnl = Column(Float, default=0.0)
    open_positions = Column(Integer, default=0)
    total_trades = Column(Integer, default=0)
    win_rate = Column(Float, nullable=True)

    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("AgentSession", back_populates="snapshots")
