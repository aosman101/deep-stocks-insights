"""
Deep Stock Insights - Prediction & Signal Models
Stores N-HiTS predictions (actual) and analytics estimates for audit/tracking.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Prediction(Base):
    """
    Stores every N-HiTS inference result.
    prediction_type: 'actual'    — direct N-HiTS model output
                     'estimated' — analytics/statistical estimate
    """
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    asset = Column(String(16), nullable=False, index=True)        # "BTC" | "GOLD"
    prediction_type = Column(String(16), nullable=False)           # "actual" | "estimated"

    # Prediction values
    predicted_close = Column(Float, nullable=False)
    predicted_open = Column(Float, nullable=True)
    predicted_volume = Column(Float, nullable=True)
    predicted_change_pct = Column(Float, nullable=True)           # % change vs current
    confidence = Column(Float, nullable=True)                     # 0-100

    # Context at prediction time
    current_price = Column(Float, nullable=True)
    prediction_horizon = Column(String(16), default="1d")         # "1d", "3d", "7d"

    # Signal output
    signal = Column(String(8), nullable=True)                     # "BUY" | "HOLD" | "SELL"
    signal_strength = Column(Float, nullable=True)                # 0–1

    # Risk parameters (populated by risk_service)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    risk_reward_ratio = Column(Float, nullable=True)

    # Model metadata
    model_version = Column(String(32), nullable=True)
    mae_at_time = Column(Float, nullable=True)                    # MAE used for threshold
    notes = Column(Text, nullable=True)

    # Who triggered it and when
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Verification (filled in later once the real price is known)
    actual_close = Column(Float, nullable=True)
    actual_open = Column(Float, nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    was_correct_direction = Column(Boolean, nullable=True)
    abs_error = Column(Float, nullable=True)

    def __repr__(self):
        return (
            f"<Prediction id={self.id} asset={self.asset} "
            f"signal={self.signal} predicted={self.predicted_close:.2f}>"
        )


class ModelMetrics(Base):
    """Running accuracy metrics for each asset / model type."""
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    asset = Column(String(16), nullable=False, index=True)
    model_version = Column(String(32), nullable=True)
    period = Column(String(16), default="30d")                    # evaluation window

    mae = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    mape = Column(Float, nullable=True)
    r2_score = Column(Float, nullable=True)
    directional_accuracy = Column(Float, nullable=True)
    sharpe_ratio = Column(Float, nullable=True)
    annualised_return = Column(Float, nullable=True)
    max_drawdown = Column(Float, nullable=True)

    total_predictions = Column(Integer, default=0)
    correct_directions = Column(Integer, default=0)

    computed_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<ModelMetrics asset={self.asset} r2={self.r2_score}>"
