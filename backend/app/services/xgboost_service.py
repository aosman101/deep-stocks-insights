"""
Compatibility shim for the legacy XGBoost import path.

The universal booster implementation now lives in `app.services.lightgbm_service`.
"""

from app.services.lightgbm_service import (
    get_lightgbm_model,
    load_lightgbm,
    predict_lightgbm,
    train_lightgbm,
)

train_xgboost = train_lightgbm
load_xgboost = load_lightgbm
get_xgboost_model = get_lightgbm_model
predict_xgboost = predict_lightgbm

__all__ = [
    "train_lightgbm",
    "load_lightgbm",
    "get_lightgbm_model",
    "predict_lightgbm",
    "train_xgboost",
    "load_xgboost",
    "get_xgboost_model",
    "predict_xgboost",
]
