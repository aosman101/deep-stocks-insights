"""Add agent decision logs.

Revision ID: 004
Revises: 003
Create Date: 2026-05-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_decision_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("agent_sessions.id"), nullable=False),
        sa.Column("trade_id", sa.Integer(), sa.ForeignKey("agent_trades.id"), nullable=True),
        sa.Column("prediction_id", sa.Integer(), sa.ForeignKey("predictions.id"), nullable=True),
        sa.Column("asset", sa.String(16), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="observed"),
        sa.Column("signal", sa.String(8), nullable=True),
        sa.Column("rating", sa.String(16), nullable=True),
        sa.Column("signal_strength", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("adjusted_confidence", sa.Float(), nullable=True),
        sa.Column("memory_multiplier", sa.Float(), nullable=True, server_default="1"),
        sa.Column("entry_price", sa.Float(), nullable=True),
        sa.Column("stop_loss", sa.Float(), nullable=True),
        sa.Column("take_profit", sa.Float(), nullable=True),
        sa.Column("risk_reward_ratio", sa.Float(), nullable=True),
        sa.Column("decision_source", sa.String(32), nullable=True, server_default="prediction_record"),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("risk_flags", sa.Text(), nullable=True),
        sa.Column("market_regime", sa.String(64), nullable=True),
        sa.Column("outcome_pnl", sa.Float(), nullable=True),
        sa.Column("outcome_return", sa.Float(), nullable=True),
        sa.Column("reflection", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_agent_decision_logs_session_id", "agent_decision_logs", ["session_id"])
    op.create_index("ix_agent_decision_logs_trade_id", "agent_decision_logs", ["trade_id"])
    op.create_index("ix_agent_decision_logs_prediction_id", "agent_decision_logs", ["prediction_id"])
    op.create_index("ix_agent_decision_logs_asset", "agent_decision_logs", ["asset"])
    op.create_index("ix_agent_decision_logs_action", "agent_decision_logs", ["action"])
    op.create_index("ix_agent_decision_logs_status", "agent_decision_logs", ["status"])
    op.create_index("ix_agent_decision_logs_created_at", "agent_decision_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_agent_decision_logs_created_at", table_name="agent_decision_logs")
    op.drop_index("ix_agent_decision_logs_status", table_name="agent_decision_logs")
    op.drop_index("ix_agent_decision_logs_action", table_name="agent_decision_logs")
    op.drop_index("ix_agent_decision_logs_asset", table_name="agent_decision_logs")
    op.drop_index("ix_agent_decision_logs_prediction_id", table_name="agent_decision_logs")
    op.drop_index("ix_agent_decision_logs_trade_id", table_name="agent_decision_logs")
    op.drop_index("ix_agent_decision_logs_session_id", table_name="agent_decision_logs")
    op.drop_table("agent_decision_logs")
