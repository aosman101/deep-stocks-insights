"""
Deep Stock Insights - Application Configuration
Reads settings from environment variables / .env file.
"""

import logging
import re
from secrets import token_urlsafe
from typing import List

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)
_INLINE_COMMENT_RE = re.compile(r"\s+#.*$")


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Deep Stock Insights"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # Security
    SECRET_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database — default writes to /tmp to avoid network-mount I/O issues on dev
    DATABASE_URL: str = "sqlite:////tmp/deep_stock_insights.db"

    # Default admin (created on first startup)
    ADMIN_EMAIL: str = "admin@deepstockinsights.com"
    ADMIN_PASSWORD: str | None = None
    ADMIN_USERNAME: str = "admin"

    # Market Data
    GOLD_API_KEY: str = ""          # Optional — goldapi.io
    FRED_API_KEY: str = ""          # Optional — register free at fred.stlouisfed.org
    FINNHUB_API_KEY: str = ""       # Optional — finnhub.io (news, company profiles, earnings)
    TWELVE_DATA_API_KEY: str = ""   # Optional — twelvedata.com (time series, indicators, forex)

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"
    # Production domain — set via DOMAIN env var in docker-compose
    DOMAIN: str = ""

    @property
    def cors_origins(self) -> List[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        if self.DOMAIN:
            origins.append(f"https://{self.DOMAIN}")
            origins.append(f"http://{self.DOMAIN}")
        return origins

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        """Tolerate common environment strings such as DEBUG=release."""
        if isinstance(value, bool) or value is None:
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return value

    @field_validator("SECRET_KEY", "ADMIN_PASSWORD", mode="before")
    @classmethod
    def blank_strings_to_none(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("GOLD_API_KEY", "FRED_API_KEY", "FINNHUB_API_KEY", "TWELVE_DATA_API_KEY", mode="before")
    @classmethod
    def normalize_optional_api_keys(cls, value):
        """
        Treat blank values, comment-only values, and placeholder strings as unset.
        This makes `.env` lines such as `API_KEY=  # optional` behave as intended.
        """
        if value is None:
            return ""
        if not isinstance(value, str):
            return value

        cleaned = _INLINE_COMMENT_RE.sub("", value).strip()
        if not cleaned or cleaned.startswith("#"):
            return ""

        lowered = cleaned.lower()
        if lowered in {
            "your-api-key-here",
            "your-fred-api-key-here",
            "your-finnhub-api-key-here",
            "your-twelve-data-api-key-here",
            "your-gold-api-key-here",
            "replace-with-a-real-api-key",
            "replace-me",
            "changeme",
        }:
            return ""

        return cleaned

    @model_validator(mode="after")
    def apply_security_defaults(self):
        environment = (self.ENVIRONMENT or "").strip().lower()
        is_development = self.DEBUG or environment in {"development", "dev", "local", "test"}

        if not self.SECRET_KEY:
            if not is_development:
                raise ValueError("SECRET_KEY must be set when DEBUG is disabled.")
            self.SECRET_KEY = token_urlsafe(48)
            logger.warning(
                "SECRET_KEY is not set; generated an ephemeral development secret. "
                "Set SECRET_KEY explicitly to keep sessions valid across restarts."
            )

        return self

    # ML Model
    MODEL_LOOKBACK_WINDOW: int = 50
    MODEL_NHITS_HIDDEN_DIM: int = 256
    MODEL_NHITS_MLP_LAYERS: int = 3
    MODEL_NHITS_POOLING: str = "1,2,5"
    MODEL_TFT_HIDDEN_DIM: int = 128
    MODEL_TFT_HEADS: int = 4
    MODEL_TFT_FF_DIM: int = 256
    MODEL_TFT_BLOCKS: int = 2
    MODEL_DROPOUT: float = 0.2
    MODEL_BATCH_SIZE: int = 32
    MODEL_LEARNING_RATE: float = 0.0012
    MODEL_EPOCHS: int = 100
    MODEL_EVAL_EPOCHS: int = 12
    MODEL_EVAL_TEST_WINDOW: int = 30
    MODEL_EVAL_RETRAIN_EVERY: int = 5
    MODEL_RETRAIN_ON_STARTUP: bool = False
    MODEL_SAVE_PATH: str = "./models"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Singleton settings object used across the app
settings = Settings()
