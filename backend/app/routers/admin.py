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
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.prediction import Prediction
from app.models.price_cache import PriceCache, LiveQuote
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.schemas.prediction import TrainModelRequest, TrainModelResponse
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
    background_tasks: BackgroundTasks = BackgroundTasks(),
    _: User = Depends(get_current_admin),
):
    """
    Trigger N-HiTS model training for the given asset.
    Training runs asynchronously; check /admin/model-status for progress.
    """
    from app.services.asset_registry import NHITS_FEATURED
    asset = asset.upper()
    if asset not in NHITS_FEATURED:
        raise HTTPException(status_code=400, detail=f"Supported assets: {sorted(NHITS_FEATURED)}")

    period = payload.period if payload else "2y"
    epochs = payload.epochs if payload and payload.epochs else None

    logger.info(f"Admin triggered training for {asset}")
    from app.services.prediction_service import train_model

    result = await train_model(asset, period=period, epochs=epochs)

    return TrainModelResponse(
        asset=asset,
        status=result.get("status", "unknown"),
        message=result.get("message", ""),
        training_samples=result.get("training_samples"),
        val_loss=result.get("val_loss"),
        model_version=result.get("model_version"),
    )


@router.get("/model-status")
def model_status(_: User = Depends(get_current_admin)):
    """Report training status for each asset model."""
    from app.ml.nhits_model import get_model
    from app.services.asset_registry import NHITS_FEATURED

    status_report = {}
    for asset in sorted(NHITS_FEATURED):
        model = get_model(asset)
        status_report[asset] = {
            "is_trained": model.is_trained,
            "version": model.version,
            "lookback": model.lookback,
            "pooling_levels": list(model.pooling_levels),
            "hidden_dim": model.hidden_dim,
            "mlp_layers": model.mlp_layers,
            "dropout": model.dropout,
        }
    return status_report


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
