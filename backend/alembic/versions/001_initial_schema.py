"""Initial schema — users, predictions, model_metrics, price_cache, live_quotes

Revision ID: 001
Revises:
Create Date: 2026-04-07
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("full_name", sa.String(128), nullable=True),
        sa.Column("institution", sa.String(256), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset", sa.String(16), nullable=False, index=True),
        sa.Column("prediction_type", sa.String(16), nullable=False),
        sa.Column("predicted_close", sa.Float(), nullable=False),
        sa.Column("predicted_open", sa.Float(), nullable=True),
        sa.Column("predicted_volume", sa.Float(), nullable=True),
        sa.Column("predicted_change_pct", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("current_price", sa.Float(), nullable=True),
        sa.Column("prediction_horizon", sa.String(16), server_default="1d"),
        sa.Column("signal", sa.String(8), nullable=True),
        sa.Column("signal_strength", sa.Float(), nullable=True),
        sa.Column("stop_loss", sa.Float(), nullable=True),
        sa.Column("take_profit", sa.Float(), nullable=True),
        sa.Column("risk_reward_ratio", sa.Float(), nullable=True),
        sa.Column("model_version", sa.String(32), nullable=True),
        sa.Column("mae_at_time", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("actual_close", sa.Float(), nullable=True),
        sa.Column("actual_open", sa.Float(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("was_correct_direction", sa.Boolean(), nullable=True),
        sa.Column("abs_error", sa.Float(), nullable=True),
    )

    op.create_table(
        "model_metrics",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset", sa.String(16), nullable=False, index=True),
        sa.Column("model_version", sa.String(32), nullable=True),
        sa.Column("period", sa.String(16), server_default="30d"),
        sa.Column("mae", sa.Float(), nullable=True),
        sa.Column("rmse", sa.Float(), nullable=True),
        sa.Column("mape", sa.Float(), nullable=True),
        sa.Column("r2_score", sa.Float(), nullable=True),
        sa.Column("directional_accuracy", sa.Float(), nullable=True),
        sa.Column("sharpe_ratio", sa.Float(), nullable=True),
        sa.Column("annualised_return", sa.Float(), nullable=True),
        sa.Column("max_drawdown", sa.Float(), nullable=True),
        sa.Column("total_predictions", sa.Integer(), server_default="0"),
        sa.Column("correct_directions", sa.Integer(), server_default="0"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "price_cache",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset", sa.String(16), nullable=False, index=True),
        sa.Column("interval", sa.String(8), nullable=False, server_default="1d"),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("open", sa.Float(), nullable=True),
        sa.Column("high", sa.Float(), nullable=True),
        sa.Column("low", sa.Float(), nullable=True),
        sa.Column("close", sa.Float(), nullable=False),
        sa.Column("volume", sa.Float(), nullable=True),
        sa.Column("vwap", sa.Float(), nullable=True),
        sa.Column("change_pct", sa.Float(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "live_quotes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset", sa.String(16), unique=True, nullable=False, index=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("price_usd", sa.Float(), nullable=True),
        sa.Column("change_24h", sa.Float(), nullable=True),
        sa.Column("change_24h_pct", sa.Float(), nullable=True),
        sa.Column("high_24h", sa.Float(), nullable=True),
        sa.Column("low_24h", sa.Float(), nullable=True),
        sa.Column("volume_24h", sa.Float(), nullable=True),
        sa.Column("market_cap", sa.Float(), nullable=True),
        sa.Column("source", sa.String(32), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("live_quotes")
    op.drop_table("price_cache")
    op.drop_table("model_metrics")
    op.drop_table("predictions")
    op.drop_table("users")
