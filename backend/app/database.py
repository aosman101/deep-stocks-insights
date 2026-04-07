"""
Deep Stock Insights - Database Setup
SQLAlchemy engine, session factory, and base model class.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# SQLite engine — swap DATABASE_URL in .env for PostgreSQL in production
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables():
    """Create all tables defined in models. Called at app startup."""
    # Import models so SQLAlchemy registers them before creating tables
    from app.models import user, prediction, price_cache, agent  # noqa: F401
    Base.metadata.create_all(bind=engine)
