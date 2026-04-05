"""
Scanner Router — /api/scanner
  GET  /run             — full market scan (all assets)
  GET  /crypto          — crypto-only scan
  GET  /stocks          — stocks-only scan
  POST /train-all       — admin: train LightGBM for all assets
  POST /train/{symbol}  — admin: train LightGBM for one asset
  GET  /assets          — list all available assets (crypto + stocks)
  GET  /assets/crypto   — crypto asset list
  GET  /assets/stocks   — stock asset list
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks

from app.services.asset_registry import ALL_ASSETS, list_crypto, list_stocks
from app.core.dependencies import get_current_active_user, get_current_admin
from app.models.user import User
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scanner", tags=["AI Scanner & Insights"])


@router.get("/run")
async def full_scan(
    asset_type: str = Query(default="all", description="all | crypto | stocks"),
    top_n: int = Query(default=40, ge=5, le=40),
    _: User = Depends(get_current_active_user),
):
    """Run the AI scanner across all configured assets and return ranked signals."""
    if asset_type not in ("all", "crypto", "stocks"):
        raise HTTPException(status_code=400, detail="asset_type must be all, crypto, or stocks")
    try:
        from app.services.scanner_service import run_scanner
        return await run_scanner(asset_type=asset_type, top_n=top_n)
    except Exception as e:
        logger.error(f"Scanner error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/crypto")
async def crypto_scan(_: User = Depends(get_current_active_user)):
    """Scan crypto assets only."""
    from app.services.scanner_service import run_scanner
    return await run_scanner(asset_type="crypto", top_n=20)


@router.get("/stocks")
async def stocks_scan(_: User = Depends(get_current_active_user)):
    """Scan stock assets only."""
    from app.services.scanner_service import run_scanner
    return await run_scanner(asset_type="stocks", top_n=20)


@router.post("/train/{symbol}")
async def train_symbol(
    symbol: str,
    _: User = Depends(get_current_admin),
):
    """Admin: train LightGBM model for a specific asset."""
    symbol = symbol.upper()
    try:
        from app.services.market_service import get_historical_data
        df = await get_historical_data(symbol, period="2y")
        if df.empty or len(df) < 60:
            raise HTTPException(status_code=400, detail=f"Insufficient data for {symbol}")
        from app.services.lightgbm_service import train_lightgbm
        result = train_lightgbm(symbol, df, settings.MODEL_SAVE_PATH)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train-all")
async def train_all_assets(
    background_tasks: BackgroundTasks,
    asset_type: str = Query(default="all"),
    _: User = Depends(get_current_admin),
):
    """Admin: queue LightGBM training for all assets in the background."""
    if asset_type == "crypto":
        symbols = [a["symbol"] for a in list_crypto()]
    elif asset_type == "stocks":
        symbols = [a["symbol"] for a in list_stocks()]
    else:
        symbols = list(ALL_ASSETS.keys())

    async def train_batch():
        from app.services.market_service import get_historical_data

        for sym in symbols:
            try:
                df = await get_historical_data(sym, period="2y")
                if not df.empty and len(df) >= 60:
                    from app.services.lightgbm_service import train_lightgbm
                    train_lightgbm(sym, df, settings.MODEL_SAVE_PATH)
            except Exception as e:
                logger.warning(f"Training failed for {sym}: {e}")

    background_tasks.add_task(train_batch)
    return {
        "message": f"Training queued for {len(symbols)} assets in background.",
        "symbols": symbols,
    }


@router.get("/predict/{symbol}")
async def predict_symbol(
    symbol: str,
    _: User = Depends(get_current_active_user),
):
    """LightGBM prediction for any single asset (trains on demand if needed)."""
    symbol = symbol.upper()
    try:
        from app.services.market_service import get_historical_data
        df = await get_historical_data(symbol, period="1y")
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")

        from app.services.lightgbm_service import predict_lightgbm, train_lightgbm

        result = predict_lightgbm(symbol, df, settings.MODEL_SAVE_PATH)

        # If untrained, auto-train and predict
        if result.get("status") == "untrained":
            train_result = train_lightgbm(symbol, df, settings.MODEL_SAVE_PATH)
            if train_result.get("status") == "success":
                result = predict_lightgbm(symbol, df, settings.MODEL_SAVE_PATH)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assets")
def all_assets(_: User = Depends(get_current_active_user)):
    """Return all available assets (crypto + stocks) with metadata."""
    return {
        "crypto": list_crypto(),
        "stocks": list_stocks(),
        "total": len(ALL_ASSETS),
    }


@router.get("/assets/crypto")
def crypto_assets(_: User = Depends(get_current_active_user)):
    return list_crypto()


@router.get("/assets/stocks")
def stock_assets(_: User = Depends(get_current_active_user)):
    return list_stocks()
