"""
WebSocket Router — /ws
Streams live price updates to connected clients.

Clients connect via:  ws://localhost:8000/ws/prices/{asset}

Message format:
  { "asset": "BTC", "price": 67234.12, "change_24h_pct": 1.45, "updated_at": "..." }

The server pushes an update every PUSH_INTERVAL_SECONDS seconds.
"""

import asyncio
import json
import logging
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])

PUSH_INTERVAL_SECONDS = 30    # push every 30 s (CoinGecko rate limit friendly)


class ConnectionManager:
    """Tracks all active WebSocket connections per asset."""

    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, asset: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(asset, []).append(ws)
        logger.info(f"WS connected: {asset}. Total: {len(self.active[asset])}")

    def disconnect(self, asset: str, ws: WebSocket):
        if asset in self.active:
            self.active[asset] = [c for c in self.active[asset] if c != ws]
        logger.info(f"WS disconnected: {asset}. Remaining: {len(self.active.get(asset, []))}")

    async def broadcast(self, asset: str, message: dict):
        dead = []
        for ws in self.active.get(asset, []):
            try:
                await ws.send_text(json.dumps(message, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(asset, ws)


manager = ConnectionManager()


@router.websocket("/ws/prices/{asset}")
async def ws_prices(websocket: WebSocket, asset: str):
    """
    WebSocket endpoint for live price streaming.
    Sends one update immediately on connect, then every PUSH_INTERVAL_SECONDS.
    """
    asset = asset.upper()
    if asset not in ("BTC", "GOLD"):
        await websocket.close(code=4000, reason="Unsupported asset")
        return

    from app.services.market_service import get_live_quote

    await manager.connect(asset, websocket)
    try:
        while True:
            try:
                quote = await get_live_quote(asset)
                message = {
                    "type": "price_update",
                    "asset": asset,
                    "price": quote.get("price"),
                    "price_usd": quote.get("price_usd"),
                    "change_24h_pct": quote.get("change_24h_pct"),
                    "change_24h": quote.get("change_24h"),
                    "high_24h": quote.get("high_24h"),
                    "low_24h": quote.get("low_24h"),
                    "volume_24h": quote.get("volume_24h"),
                    "source": quote.get("source"),
                    "updated_at": datetime.utcnow().isoformat(),
                }
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"WS price fetch error ({asset}): {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "asset": asset,
                    "message": f"Price fetch failed: {e}",
                    "updated_at": datetime.utcnow().isoformat(),
                }))

            await asyncio.sleep(PUSH_INTERVAL_SECONDS)

    except WebSocketDisconnect:
        manager.disconnect(asset, websocket)
