"""Schemas for prediction and analytics endpoints."""

from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, List


class PredictionSchema(BaseModel):
    model_config = ConfigDict(protected_namespaces=())


class PredictionResponse(PredictionSchema):
    id: Optional[int] = None
    asset: str
    prediction_type: str               # "actual" | "estimated"
    model_key: Optional[str] = None
    run_id: Optional[str] = None
    trigger_source: Optional[str] = None
    input_window_end: Optional[datetime] = None

    predicted_close: float
    predicted_open: Optional[float] = None
    predicted_volume: Optional[float] = None
    predicted_change_pct: Optional[float] = None
    confidence: Optional[float] = None

    current_price: Optional[float] = None
    prediction_horizon: str = "1d"

    signal: Optional[str] = None       # "BUY" | "HOLD" | "SELL"
    signal_strength: Optional[float] = None

    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    risk_reward_ratio: Optional[float] = None

    model_version: Optional[str] = None
    mae_at_time: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MultiHorizonPrediction(PredictionSchema):
    asset: str
    current_price: float
    model_version: Optional[str] = None

    prediction_1d: PredictionResponse
    prediction_3d: PredictionResponse
    prediction_7d: PredictionResponse

    # MC Dropout uncertainty bands
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None

    generated_at: datetime


class AnalyticsPrediction(PredictionSchema):
    """Estimated prediction based on technical indicators + statistical methods."""
    asset: str
    current_price: float

    # Ensemble of statistical methods
    sma_forecast: Optional[float] = None
    ema_forecast: Optional[float] = None
    lobf_forecast: Optional[float] = None        # Line of Best Fit
    arima_like_forecast: Optional[float] = None  # Exponential smoothing approx.

    ensemble_forecast: float
    ensemble_change_pct: float
    ensemble_signal: str                          # "BUY" | "HOLD" | "SELL"
    ensemble_confidence: float

    # Monte Carlo simulation results
    mc_mean: Optional[float] = None
    mc_lower_5: Optional[float] = None
    mc_upper_95: Optional[float] = None
    mc_probability_up: Optional[float] = None

    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

    generated_at: datetime


class ModelPerformance(PredictionSchema):
    asset: str
    model_version: Optional[str] = None
    period: str

    mae: Optional[float] = None
    rmse: Optional[float] = None
    mape: Optional[float] = None
    r2_score: Optional[float] = None
    directional_accuracy: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    annualised_return: Optional[float] = None
    max_drawdown: Optional[float] = None

    total_predictions: int = 0
    correct_directions: int = 0

    computed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TrainModelRequest(PredictionSchema):
    asset: Optional[str] = None
    period: str = "2y"             # how much historical data to train on
    epochs: Optional[int] = None   # override default if desired
    model_key: str = "nhits"


class TrainModelResponse(PredictionSchema):
    asset: str
    status: str
    message: str
    job_id: Optional[str] = None
    model_key: Optional[str] = None
    training_samples: Optional[int] = None
    val_loss: Optional[float] = None
    model_version: Optional[str] = None


class GeneratePredictionsRequest(PredictionSchema):
    assets: List[str]
    model_keys: List[str] = Field(default_factory=lambda: ["ensemble", "nhits", "tft", "lightgbm"])
    include_analytics: bool = False
    persist: bool = True


class TrainingJobResponse(PredictionSchema):
    job_id: str
    asset: str
    model_key: str
    period: str
    epochs: Optional[int] = None
    status: str
    message: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    model_version: Optional[str] = None
