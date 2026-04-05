"""Schemas for market data endpoints."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class LiveQuoteResponse(BaseModel):
    asset: str
    price: float
    price_usd: Optional[float] = None
    change_24h: Optional[float] = None
    change_24h_pct: Optional[float] = None
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    volume_24h: Optional[float] = None
    market_cap: Optional[float] = None
    source: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OHLCVPoint(BaseModel):
    timestamp: datetime
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: Optional[float] = None
    change_pct: Optional[float] = None


class HistoricalDataResponse(BaseModel):
    asset: str
    interval: str
    period: str
    count: int
    data: List[OHLCVPoint]


class IndicatorValue(BaseModel):
    timestamp: datetime
    value: Optional[float] = None


class TechnicalIndicators(BaseModel):
    asset: str
    current_price: float
    timestamp: datetime

    # Moving Averages
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    ema_12: Optional[float] = None
    ema_26: Optional[float] = None
    ema_50: Optional[float] = None
    wma_20: Optional[float] = None

    # Momentum
    rsi_14: Optional[float] = None
    stoch_k: Optional[float] = None
    stoch_d: Optional[float] = None
    williams_r: Optional[float] = None
    cci_20: Optional[float] = None
    momentum_10: Optional[float] = None
    roc_10: Optional[float] = None

    # Trend
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    adx_14: Optional[float] = None
    aroon_up: Optional[float] = None
    aroon_down: Optional[float] = None

    # Volatility
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    bb_width: Optional[float] = None
    bb_percent: Optional[float] = None
    atr_14: Optional[float] = None
    keltner_upper: Optional[float] = None
    keltner_lower: Optional[float] = None

    # Volume
    obv: Optional[float] = None
    vwap: Optional[float] = None
    mfi_14: Optional[float] = None

    # Line of Best Fit (linear regression)
    lobf_slope: Optional[float] = None
    lobf_r2: Optional[float] = None
    lobf_predicted_next: Optional[float] = None

    # Overall market bias from indicators
    overall_signal: Optional[str] = None        # "BULLISH" | "BEARISH" | "NEUTRAL"
    bullish_count: Optional[int] = None
    bearish_count: Optional[int] = None


class StopLossTakeProfit(BaseModel):
    asset: str
    current_price: float
    signal: str
    atr: Optional[float] = None

    # Conservative
    stop_loss_conservative: float
    take_profit_conservative: float
    rr_conservative: float

    # Standard
    stop_loss_standard: float
    take_profit_standard: float
    rr_standard: float

    # Aggressive
    stop_loss_aggressive: float
    take_profit_aggressive: float
    rr_aggressive: float

    # Risk metadata
    risk_pct_conservative: float
    risk_pct_standard: float
    risk_pct_aggressive: float
