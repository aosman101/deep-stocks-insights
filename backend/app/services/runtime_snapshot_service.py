"""
In-memory snapshot cache for expensive analytics and evaluation payloads.
"""

from __future__ import annotations

import time
from typing import Dict, Optional

from app.config import settings

_analytics_snapshots: Dict[str, tuple[float, Dict]] = {}
_evaluation_snapshots: Dict[str, tuple[float, Dict]] = {}


def _get_snapshot(store: Dict[str, tuple[float, Dict]], key: str) -> Optional[Dict]:
    entry = store.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def _set_snapshot(store: Dict[str, tuple[float, Dict]], key: str, payload: Dict, ttl_seconds: int):
    store[key] = (time.monotonic() + ttl_seconds, payload)


def get_analytics_snapshot(asset: str) -> Optional[Dict]:
    return _get_snapshot(_analytics_snapshots, asset.upper())


def store_analytics_snapshot(asset: str, payload: Dict, ttl_seconds: Optional[int] = None):
    ttl = ttl_seconds or (settings.ANALYTICS_MAX_AGE_MINUTES * 60)
    _set_snapshot(_analytics_snapshots, asset.upper(), payload, ttl)


def get_evaluation_snapshot(asset: str, period: str) -> Optional[Dict]:
    return _get_snapshot(_evaluation_snapshots, f"{asset.upper()}:{period}")


def store_evaluation_snapshot(asset: str, period: str, payload: Dict, ttl_seconds: Optional[int] = None):
    ttl = ttl_seconds or settings.WALK_FORWARD_CACHE_TTL_SECONDS
    _set_snapshot(_evaluation_snapshots, f"{asset.upper()}:{period}", payload, ttl)
