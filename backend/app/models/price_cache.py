"""
Deep Stock Insights - Price Cache Model
Caches fetched OHLCV data to reduce API calls and enable offline analysis.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, BigInteger
from sqlalchemy.sql import func
from app.database import Base


class PriceCache(Base):
    """
    One row per OHLCV candle. Used as the local price history store
    for technical indicator calculation and model training.
    """
    __tablename__ = "price_cache"

    id = Column(Integer, primary_key=True, index=True)
    asset = Column(String(16), nullable=False, index=True)          # "BTC" | "GOLD"
    interval = Column(String(8), nullable=False, default="1d")      # "1d", "1h", "15m"
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    open = Column(Float, nullable=True)
    high = Column(Float, nullable=True)
    low = Column(Float, nullable=True)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=True)

    # Computed fields stored alongside raw OHLCV
    vwap = Column(Float, nullable=True)
    change_pct = Column(Float, nullable=True)                       # daily % change

    fetched_at = Column(DateTime(timezone=True), server_default=func.now())

    class Config:
        # Composite unique constraint prevents duplicate candles
        __table_args__ = ()

    def __repr__(self):
        return (
            f"<PriceCache asset={self.asset} ts={self.timestamp} close={self.close}>"
        )


class LiveQuote(Base):
    """
    Latest live price snapshot per asset.
    Updated by the background scheduler every minute.
    """
    __tablename__ = "live_quotes"

    id = Column(Integer, primary_key=True, index=True)
    asset = Column(String(16), unique=True, nullable=False, index=True)
    price = Column(Float, nullable=False)
    price_usd = Column(Float, nullable=True)
    change_24h = Column(Float, nullable=True)          # absolute USD
    change_24h_pct = Column(Float, nullable=True)      # percentage
    high_24h = Column(Float, nullable=True)
    low_24h = Column(Float, nullable=True)
    volume_24h = Column(Float, nullable=True)
    market_cap = Column(Float, nullable=True)
    source = Column(String(32), nullable=True)         # "coingecko" | "yfinance"
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<LiveQuote asset={self.asset} price={self.price}>"
