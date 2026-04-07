"""Add agent tables — sessions, trades, portfolio snapshots

Revision ID: 002
Revises: 001
Create Date: 2026-04-07
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("strategy", sa.String(32), nullable=False, server_default="signal_follower"),
        sa.Column("assets", sa.String(512), nullable=False),
        sa.Column("risk_per_trade", sa.Float(), server_default="0.02"),
        sa.Column("max_open_trades", sa.Integer(), server_default="5"),
        sa.Column("initial_capital", sa.Float(), nullable=False, server_default="10000"),
        sa.Column("current_capital", sa.Float(), nullable=False, server_default="10000"),
        sa.Column("status", sa.String(16), nullable=False, server_default="running"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "agent_trades",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("agent_sessions.id"), nullable=False, index=True),
        sa.Column("asset", sa.String(16), nullable=False, index=True),
        sa.Column("side", sa.String(8), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("entry_price", sa.Float(), nullable=False),
        sa.Column("exit_price", sa.Float(), nullable=True),
        sa.Column("stop_loss", sa.Float(), nullable=True),
        sa.Column("take_profit", sa.Float(), nullable=True),
        sa.Column("signal", sa.String(8), nullable=True),
        sa.Column("signal_strength", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("prediction_horizon", sa.String(16), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("pnl", sa.Float(), nullable=True),
        sa.Column("pnl_pct", sa.Float(), nullable=True),
        sa.Column("exit_reason", sa.String(32), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "agent_portfolio_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("agent_sessions.id"), nullable=False, index=True),
        sa.Column("total_value", sa.Float(), nullable=False),
        sa.Column("cash", sa.Float(), nullable=False),
        sa.Column("unrealised_pnl", sa.Float(), server_default="0"),
        sa.Column("open_positions", sa.Integer(), server_default="0"),
        sa.Column("total_trades", sa.Integer(), server_default="0"),
        sa.Column("win_rate", sa.Float(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("agent_portfolio_snapshots")
    op.drop_table("agent_trades")
    op.drop_table("agent_sessions")
