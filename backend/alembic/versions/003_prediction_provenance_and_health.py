"""Add prediction provenance, agent provenance, and model health columns.

Revision ID: 003
Revises: 002
Create Date: 2026-04-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("predictions") as batch_op:
        batch_op.add_column(sa.Column("model_key", sa.String(32), nullable=True, server_default="nhits"))
        batch_op.add_column(sa.Column("run_id", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("trigger_source", sa.String(32), nullable=True, server_default="manual"))
        batch_op.add_column(sa.Column("input_window_end", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index("ix_predictions_model_key", ["model_key"], unique=False)
        batch_op.create_index("ix_predictions_run_id", ["run_id"], unique=False)

    with op.batch_alter_table("model_metrics") as batch_op:
        batch_op.add_column(sa.Column("model_key", sa.String(32), nullable=True, server_default="nhits"))
        batch_op.add_column(sa.Column("source", sa.String(32), nullable=True, server_default="prediction_history"))
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))
        batch_op.create_index("ix_model_metrics_model_key", ["model_key"], unique=False)

    with op.batch_alter_table("agent_trades") as batch_op:
        batch_op.add_column(sa.Column("prediction_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("prediction_run_id", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("model_key_used", sa.String(32), nullable=True))
        batch_op.add_column(sa.Column("model_version_used", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("decision_source", sa.String(32), nullable=True, server_default="prediction_record"))
        batch_op.add_column(sa.Column("decision_notes", sa.Text(), nullable=True))
        batch_op.create_index("ix_agent_trades_prediction_id", ["prediction_id"], unique=False)
        batch_op.create_index("ix_agent_trades_prediction_run_id", ["prediction_run_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("agent_trades") as batch_op:
        batch_op.drop_index("ix_agent_trades_prediction_run_id")
        batch_op.drop_index("ix_agent_trades_prediction_id")
        batch_op.drop_column("decision_notes")
        batch_op.drop_column("decision_source")
        batch_op.drop_column("model_version_used")
        batch_op.drop_column("model_key_used")
        batch_op.drop_column("prediction_run_id")
        batch_op.drop_column("prediction_id")

    with op.batch_alter_table("model_metrics") as batch_op:
        batch_op.drop_index("ix_model_metrics_model_key")
        batch_op.drop_column("notes")
        batch_op.drop_column("source")
        batch_op.drop_column("model_key")

    with op.batch_alter_table("predictions") as batch_op:
        batch_op.drop_index("ix_predictions_run_id")
        batch_op.drop_index("ix_predictions_model_key")
        batch_op.drop_column("input_window_end")
        batch_op.drop_column("trigger_source")
        batch_op.drop_column("run_id")
        batch_op.drop_column("model_key")
