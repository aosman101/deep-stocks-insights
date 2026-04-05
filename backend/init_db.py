"""
Deep Stock Insights - Database Initialiser
Run once on first startup (also called automatically by main.py on startup).
Creates all tables and optionally seeds the initial admin user.
"""

import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal, create_all_tables
from app.models.user import User
from app.core.security import hash_password
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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

    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()

    logger.info("✓ Database initialisation complete")


if __name__ == "__main__":
    init()
