"""
Admin Router — /api/admin  (requires admin role)
  GET    /users          — list all users
  POST   /users          — create user with custom role
  GET    /users/{id}     — get user by ID
  PATCH  /users/{id}     — update user (role, active status, etc.)
  DELETE /users/{id}     — deactivate user
  POST   /train/{asset}  — trigger N-HiTS model training
  GET    /model-status   — show model trained status for each asset
  GET    /system-stats   — DB counts, cache stats
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.prediction import Prediction
from app.models.price_cache import PriceCache, LiveQuote
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.schemas.prediction import TrainModelRequest, TrainModelResponse, TrainingJobResponse
from app.core.security import hash_password
from app.core.dependencies import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ─────────────────────────────────────────────────────────────
#  User Management
# ─────────────────────────────────────────────────────────────

@router.get("/users", response_model=UserListResponse)
def list_users(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """List all registered users (paginated)."""
    total = db.query(User).count()
    users = db.query(User).offset(skip).limit(limit).all()
    return {"total": total, "users": users}


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Admin can create a user with any role (including 'admin')."""
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered.")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already taken.")

    if payload.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'.")

    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        institution=payload.institution,
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update any user field. Admins cannot demote themselves."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.role and user_id == current_admin.id and payload.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot demote your own admin account.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=200)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Deactivate (soft-delete) a user account."""
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = False
    db.commit()
    return {"message": f"User {user.email} deactivated."}


# ─────────────────────────────────────────────────────────────
#  Model Management
# ─────────────────────────────────────────────────────────────

@router.post("/train/{asset}", response_model=TrainModelResponse)
async def trigger_training(
    asset: str,
    payload: TrainModelRequest = None,
    _: User = Depends(get_current_admin),
):
    """
    Queue model training for the given asset.
    Training runs asynchronously; check /admin/training-jobs or /admin/model-status for progress.
    """
    from app.services.asset_registry import NHITS_FEATURED, TFT_FEATURED
    from app.services.training_job_service import create_training_job
    asset = asset.upper()
    model_key = (payload.model_key if payload else "nhits").lower()
    if model_key not in ("nhits", "tft", "lightgbm"):
        raise HTTPException(status_code=400, detail="model_key must be nhits, tft, or lightgbm")

    if model_key in ("nhits", "tft"):
        supported_assets = NHITS_FEATURED if model_key == "nhits" else TFT_FEATURED
        if asset not in supported_assets:
            raise HTTPException(status_code=400, detail=f"Supported assets: {sorted(supported_assets)}")

    period = payload.period if payload else "2y"
    epochs = payload.epochs if payload and payload.epochs else None

    logger.info(f"Admin queued {model_key} training for {asset}")
    job = create_training_job(asset=asset, model_key=model_key, period=period, epochs=epochs)
    return TrainModelResponse(
        asset=asset,
        model_key=model_key,
        job_id=job["job_id"],
        status=job["status"],
        message=job["message"],
    )


@router.get("/training-jobs", response_model=list[TrainingJobResponse])
def list_training_job_status(
    asset: str | None = None,
    model_key: str | None = None,
    _: User = Depends(get_current_admin),
):
    from app.services.training_job_service import list_training_jobs

    return list_training_jobs(asset=asset, model_key=model_key)


@router.get("/training-jobs/{job_id}", response_model=TrainingJobResponse)
def get_training_job_status(
    job_id: str,
    _: User = Depends(get_current_admin),
):
    from app.services.training_job_service import get_training_job

    job = get_training_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found.")
    return job


@router.get("/model-status")
def model_status(_: User = Depends(get_current_admin)):
    """Report training status for each asset model."""
    from app.ml.nhits_model import get_model as get_nhits_model
    from app.ml.tft_model import get_model as get_tft_model
    from app.services.asset_registry import ALL_ASSETS, NHITS_FEATURED, TFT_FEATURED
    from app.services.model_output_service import get_model_disk_status
    from app.services.training_job_service import list_training_jobs

    status_report = {asset: {} for asset in sorted(ALL_ASSETS)}

    for asset in sorted(NHITS_FEATURED):
        model = get_nhits_model(asset)
        status_report[asset]["nhits"] = {
            "is_trained": model.is_trained,
            "version": model.version,
            "lookback": model.lookback,
            "pooling_levels": list(model.pooling_levels),
            "hidden_dim": model.hidden_dim,
            "mlp_layers": model.mlp_layers,
            "dropout": model.dropout,
        }

    for asset in sorted(TFT_FEATURED):
        model = get_tft_model(asset)
        status_report[asset] = {
            **status_report.get(asset, {}),
            "tft": {
                "is_trained": model.is_trained,
                "version": model.version,
                "lookback": model.lookback,
                "hidden_dim": model.hidden_dim,
                "num_heads": model.num_heads,
                "ff_dim": model.ff_dim,
                "blocks": model.blocks,
                "dropout": model.dropout,
            },
        }
    for asset in sorted(ALL_ASSETS):
        lgbm_status = get_model_disk_status(asset, "lightgbm")
        status_report[asset] = {
            **status_report.get(asset, {}),
            "lightgbm": {
                "is_trained": lgbm_status["trained"],
                "version": lgbm_status["version"],
            },
        }
    return {
        "models": status_report,
        "training_jobs": list_training_jobs()[:25],
    }


@router.get("/model-health")
def model_health(
    asset: str | None = None,
    source: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    from app.services.model_health_service import latest_model_health

    rows = latest_model_health(db, asset=asset, source=source)
    return [
        {
            "asset": row.asset,
            "model_key": row.model_key,
            "model_version": row.model_version,
            "period": row.period,
            "source": row.source,
            "mae": row.mae,
            "rmse": row.rmse,
            "mape": row.mape,
            "directional_accuracy": row.directional_accuracy,
            "sharpe_ratio": row.sharpe_ratio,
            "annualised_return": row.annualised_return,
            "max_drawdown": row.max_drawdown,
            "total_predictions": row.total_predictions,
            "correct_directions": row.correct_directions,
            "notes": row.notes,
            "computed_at": row.computed_at,
        }
        for row in rows
    ]


# ─────────────────────────────────────────────────────────────
#  System Stats
# ─────────────────────────────────────────────────────────────

@router.get("/system-stats")
def system_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Return aggregate counts and cache statistics."""
    return {
        "users": {
            "total": db.query(User).count(),
            "active": db.query(User).filter(User.is_active == True).count(),
            "admins": db.query(User).filter(User.role == "admin").count(),
        },
        "predictions": {
            "total": db.query(Prediction).count(),
            "actual": db.query(Prediction).filter(Prediction.prediction_type == "actual").count(),
            "estimated": db.query(Prediction).filter(Prediction.prediction_type == "estimated").count(),
        },
        "price_cache": {
            "btc_candles": db.query(PriceCache).filter(PriceCache.asset == "BTC").count(),
            "gold_candles": db.query(PriceCache).filter(PriceCache.asset == "GOLD").count(),
        },
        "live_quotes": {
            q.asset: q.price
            for q in db.query(LiveQuote).all()
        },
        "generated_at": datetime.utcnow().isoformat(),
    }
