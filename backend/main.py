"""
Deep Stock Insights — FastAPI Application Entry Point
=====================================================
Title   : Deep Stock Insights
Purpose : N-HiTS + LightGBM stock market prediction platform

API Groups:
  /api/auth        — Authentication (login, register, profile)
  /api/admin       — Admin-only (user management, model training)
  /api/market      — Live quotes, historical data, indicators, risk levels
  /api/predictions — Actual N-HiTS model predictions
  /api/analytics   — Estimated / statistical predictions
  /ws/prices/{asset} — WebSocket live price feed
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.logging_config import setup_logging, generate_request_id, request_id_var

setup_logging()
logger = logging.getLogger(__name__)


def _model_status_from_disk(asset: str) -> dict:
    """Return lightweight N-HiTS model status without importing TensorFlow."""
    weights_path = os.path.join(settings.MODEL_SAVE_PATH, f"nhits_{asset.lower()}.weights.h5")
    meta_path = os.path.join(settings.MODEL_SAVE_PATH, f"nhits_{asset.lower()}_meta.txt")
    version = "untrained"
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            version = f.read().strip() or version
    return {
        "trained": os.path.exists(weights_path),
        "version": version,
    }


# ─────────────────────────────────────────────────────────────
#  Lifespan (startup + shutdown)
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    logger.info("=" * 60)
    logger.info("  Deep Stock Insights — starting up")
    logger.info("=" * 60)

    # 1. Create DB tables + seed admin
    from init_db import init
    init()

    # 2. Create model save directory
    os.makedirs(settings.MODEL_SAVE_PATH, exist_ok=True)

    # 3. Keep startup lightweight; N-HiTS models load lazily on first use
    from app.services.asset_registry import NHITS_FEATURED
    for asset in sorted(NHITS_FEATURED):
        status = _model_status_from_disk(asset)
        if status["trained"]:
            logger.info(f"  [{asset}] N-HiTS weights detected ✓ ({status['version']})")
        else:
            logger.info(f"  [{asset}] N-HiTS not trained yet — trigger /api/admin/train/{asset}")

    # 4. Optional: retrain on startup if configured
    if settings.MODEL_RETRAIN_ON_STARTUP:
        from app.services.prediction_service import train_model
        import asyncio
        for asset in sorted(NHITS_FEATURED):
            logger.info(f"  Retraining {asset} model...")
            asyncio.create_task(train_model(asset))

    # 5. Start background price refresh scheduler
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from app.services.market_service import get_live_quote, upsert_live_quote
    from app.database import SessionLocal

    scheduler = AsyncIOScheduler()

    async def refresh_quotes():
        """Background task: refresh live quotes every minute."""
        db = SessionLocal()
        try:
            for asset in ("BTC", "GOLD"):
                try:
                    quote = await get_live_quote(asset)
                    upsert_live_quote(db, quote)
                except Exception as e:
                    logger.warning(f"Quote refresh failed for {asset}: {e}")
        finally:
            db.close()

    async def verify_predictions():
        """Background task: fill in actual_close for past predictions using historical prices."""
        from app.models.prediction import Prediction
        from app.services.market_service import get_historical_data
        from datetime import timedelta
        db = SessionLocal()
        try:
            # Horizon durations for computing the target date
            horizon_hours = {"1d": 24, "3d": 72, "7d": 168}

            # Find unverified predictions whose target date has passed
            cutoff = datetime.utcnow() - timedelta(hours=24)
            unverified = (
                db.query(Prediction)
                .filter(
                    Prediction.actual_close.is_(None),
                    Prediction.created_at < cutoff,
                )
                .limit(50)
                .all()
            )
            if not unverified:
                return

            # Group by asset to fetch historical data once per asset
            assets = set(p.asset for p in unverified)
            hist_cache = {}
            for asset in assets:
                try:
                    df = await get_historical_data(asset, period="1mo", interval="1d")
                    if not df.empty:
                        df["timestamp"] = df["timestamp"].dt.tz_localize(None)
                        hist_cache[asset] = df
                except Exception as e:
                    logger.warning(f"Failed to fetch history for {asset} verification: {e}")

            for pred in unverified:
                try:
                    h = horizon_hours.get(pred.prediction_horizon, 24)
                    target_date = pred.created_at.replace(tzinfo=None) + timedelta(hours=h)

                    # Skip if target date hasn't passed yet
                    if target_date > datetime.utcnow():
                        continue

                    df = hist_cache.get(pred.asset)
                    if df is None or df.empty:
                        continue

                    # Find the closest candle to the target date
                    df["_dist"] = abs(df["timestamp"] - target_date)
                    closest = df.loc[df["_dist"].idxmin()]

                    # Only use if within 2 days of target
                    if closest["_dist"] > timedelta(days=2):
                        continue

                    actual = float(closest["close"])
                    if actual and actual > 0:
                        pred.actual_close = actual
                        pred.verified_at = datetime.utcnow()
                        pred.abs_error = abs(pred.predicted_close - actual)
                        if pred.current_price:
                            pred_dir = pred.predicted_close > pred.current_price
                            actual_dir = actual > pred.current_price
                            pred.was_correct_direction = (pred_dir == actual_dir)
                except Exception as e:
                    logger.warning(f"Verification failed for prediction {pred.id}: {e}")

            db.commit()
            verified_count = sum(1 for p in unverified if p.actual_close is not None)
            if verified_count:
                logger.info(f"Verified {verified_count} predictions")
        except Exception as e:
            logger.warning(f"Prediction verification job failed: {e}")
        finally:
            db.close()

    scheduler.add_job(refresh_quotes, "interval", minutes=1, id="quote_refresh")
    scheduler.add_job(verify_predictions, "interval", hours=6, id="verify_predictions")
    scheduler.start()
    logger.info("  Background scheduler started (quote refresh every 60s)")
    logger.info("=" * 60)

    yield   # ← app runs here

    scheduler.shutdown()
    from app.services.market_service import close_shared_client
    await close_shared_client()
    logger.info("Deep Stock Insights — shutdown complete")


# ─────────────────────────────────────────────────────────────
#  FastAPI app
# ─────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "N-HiTS + LightGBM market prediction platform for crypto, commodities, and equities. "
        "Predictions are generated by machine learning models and should not be used as sole investment advice."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─────────────────────────────────────────────────────────────
#  CORS
# ─────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
#  Request ID middleware
# ─────────────────────────────────────────────────────────────

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    rid = request.headers.get("X-Request-ID", generate_request_id())
    token = request_id_var.set(rid)
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    request_id_var.reset(token)
    return response

# ─────────────────────────────────────────────────────────────
#  Routers
# ─────────────────────────────────────────────────────────────

from app.routers import auth, admin, market, predictions, analytics, ws, macro, scanner, finnhub, twelvedata
from app.services.asset_registry import NHITS_FEATURED

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(market.router)
app.include_router(predictions.router)
app.include_router(analytics.router)
app.include_router(macro.router)
app.include_router(scanner.router)
app.include_router(finnhub.router)
app.include_router(twelvedata.router)
app.include_router(ws.router)

# ─────────────────────────────────────────────────────────────
#  Health check
# ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "assets_supported": sorted(NHITS_FEATURED),
    }


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "healthy",
        "models": {
            asset: _model_status_from_disk(asset)
            for asset in sorted(NHITS_FEATURED)
        },
    }


# ─────────────────────────────────────────────────────────────
#  Run directly
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
    )
