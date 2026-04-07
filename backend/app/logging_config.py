"""
Deep Stock Insights - Structured Logging Configuration
JSON-formatted logs with request ID tracking for production.
"""

import logging
import sys
import uuid
from contextvars import ContextVar

from pythonjsonlogger import jsonlogger

from app.config import settings

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_var.get("-")
        return True


def setup_logging():
    """Configure structured logging for the application."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # Remove existing handlers
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if settings.ENVIRONMENT in ("production", "staging"):
        # JSON format for production
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        )
    else:
        # Human-readable for development
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s (%(request_id)s) %(message)s"
        )

    handler.setFormatter(formatter)
    handler.addFilter(RequestIdFilter())
    root.addHandler(handler)

    # Quiet noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("tensorflow").setLevel(logging.WARNING)
    logging.getLogger("absl").setLevel(logging.WARNING)

    if not settings.DEBUG:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def generate_request_id() -> str:
    return uuid.uuid4().hex[:12]
