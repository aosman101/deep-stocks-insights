"""
Deep Stock Insights - Database Initialiser
Run once on first startup (also called automatically by main.py on startup).
Creates all tables and optionally seeds the initial admin user.
"""

import logging
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from app.database import SessionLocal, create_all_tables, engine
from app.models.user import User
from app.core.security import hash_password
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


ADDITIVE_SCHEMA_UPDATES = {
    "predictions": [
        ("model_key", "ALTER TABLE predictions ADD COLUMN model_key VARCHAR(32) DEFAULT 'nhits'"),
        ("run_id", "ALTER TABLE predictions ADD COLUMN run_id VARCHAR(64)"),
        ("trigger_source", "ALTER TABLE predictions ADD COLUMN trigger_source VARCHAR(32) DEFAULT 'manual'"),
        ("input_window_end", "ALTER TABLE predictions ADD COLUMN input_window_end DATETIME"),
    ],
    "model_metrics": [
        ("model_key", "ALTER TABLE model_metrics ADD COLUMN model_key VARCHAR(32) DEFAULT 'nhits'"),
        ("source", "ALTER TABLE model_metrics ADD COLUMN source VARCHAR(32) DEFAULT 'prediction_history'"),
        ("notes", "ALTER TABLE model_metrics ADD COLUMN notes TEXT"),
    ],
    "agent_trades": [
        ("prediction_id", "ALTER TABLE agent_trades ADD COLUMN prediction_id INTEGER"),
        ("prediction_run_id", "ALTER TABLE agent_trades ADD COLUMN prediction_run_id VARCHAR(64)"),
        ("model_key_used", "ALTER TABLE agent_trades ADD COLUMN model_key_used VARCHAR(32)"),
        ("model_version_used", "ALTER TABLE agent_trades ADD COLUMN model_version_used VARCHAR(64)"),
        ("decision_source", "ALTER TABLE agent_trades ADD COLUMN decision_source VARCHAR(32) DEFAULT 'prediction_record'"),
        ("decision_notes", "ALTER TABLE agent_trades ADD COLUMN decision_notes TEXT"),
    ],
}

INDEX_UPDATES = [
    "CREATE INDEX IF NOT EXISTS ix_predictions_model_key ON predictions (model_key)",
    "CREATE INDEX IF NOT EXISTS ix_predictions_run_id ON predictions (run_id)",
    "CREATE INDEX IF NOT EXISTS ix_model_metrics_model_key ON model_metrics (model_key)",
    "CREATE INDEX IF NOT EXISTS ix_agent_trades_prediction_id ON agent_trades (prediction_id)",
    "CREATE INDEX IF NOT EXISTS ix_agent_trades_prediction_run_id ON agent_trades (prediction_run_id)",
]


def apply_additive_schema_updates():
    """
    Keep the local dev database compatible with additive model changes.
    This is intentionally conservative: it only adds missing nullable/defaulted columns and indexes.
    """
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table_name, updates in ADDITIVE_SCHEMA_UPDATES.items():
            if not inspector.has_table(table_name):
                continue
            existing = {col["name"] for col in inspector.get_columns(table_name)}
            for column_name, statement in updates:
                if column_name in existing:
                    continue
                logger.info(f"Applying additive schema update: {table_name}.{column_name}")
                conn.execute(text(statement))

        for statement in INDEX_UPDATES:
            conn.execute(text(statement))


def seed_admin(db: Session):
    if not settings.ADMIN_PASSWORD:
        logger.warning(
            "Skipping admin bootstrap because ADMIN_PASSWORD is not set. "
            "Set ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD to create the initial admin account."
        )
        return

    existing = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
    if existing:
        logger.info(f"Admin already exists: {settings.ADMIN_EMAIL}")
        return

    admin = User(
        username=settings.ADMIN_USERNAME,
        email=settings.ADMIN_EMAIL,
        hashed_password=hash_password(settings.ADMIN_PASSWORD),
        full_name="Deep Stock Insights Admin",
        institution="Deep Stock Insights",
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    logger.info(f"✓ Default admin created: {settings.ADMIN_EMAIL}")
    logger.info("  Change the seeded admin password immediately after first login.")


def init():
    logger.info("Creating database tables...")
    create_all_tables()
    logger.info("✓ Tables created")
    apply_additive_schema_updates()
    logger.info("✓ Additive schema updates applied")

    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()

    logger.info("✓ Database initialisation complete")


if __name__ == "__main__":
    init()
