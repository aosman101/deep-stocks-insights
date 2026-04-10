"""
Background inference worker lane for refreshing persisted prediction snapshots.

This keeps heavy model work off the immediate request path whenever possible.
"""

from __future__ import annotations

import asyncio
import itertools
import logging
from datetime import datetime
from typing import Dict, Iterable, Optional
from uuid import uuid4

from app.database import SessionLocal

logger = logging.getLogger(__name__)

_job_queue: Optional[asyncio.PriorityQueue] = None
_worker_tasks: list[asyncio.Task] = []
_jobs: Dict[str, Dict] = {}
_job_sequence = itertools.count()


def _job_payload(job_id: str) -> Dict:
    job = _jobs[job_id]
    public = {k: v for k, v in job.items() if k not in {"future"}}
    return public


def _normalize_model_keys(asset: str, model_keys: Optional[Iterable[str]]) -> list[str]:
    from app.services.asset_registry import has_nhits, has_tft

    asset = asset.upper()
    requested = [model.lower() for model in (model_keys or ("ensemble", "lightgbm"))]
    normalized: list[str] = []
    for model_key in requested:
        if model_key == "nhits" and not has_nhits(asset):
            continue
        if model_key == "tft" and not has_tft(asset):
            continue
        if model_key not in normalized:
            normalized.append(model_key)
    return normalized


async def _run_async_callable(func, *args, **kwargs):
    """
    Execute an async callable in a worker thread with its own event loop so
    model loading/inference does not monopolise the main FastAPI event loop.
    """
    return await asyncio.to_thread(lambda: asyncio.run(func(*args, **kwargs)))


def _priority_for_source(trigger_source: str) -> int:
    source = (trigger_source or "").lower()
    if source == "manual":
        return 0
    if source == "workspace_refresh":
        return 1
    if source == "refresh":
        return 2
    if source == "scheduled_refresh":
        return 3
    if source == "startup_warm":
        return 4
    return 5


async def start_inference_workers(count: int = 1):
    global _job_queue
    if _worker_tasks:
        return

    _job_queue = asyncio.PriorityQueue()
    for idx in range(max(1, count)):
        _worker_tasks.append(asyncio.create_task(_worker_loop(idx + 1)))
    logger.info("Started %s inference worker(s)", len(_worker_tasks))


async def stop_inference_workers():
    global _job_queue
    if not _worker_tasks or _job_queue is None:
        return

    for _ in _worker_tasks:
        await _job_queue.put((9999, next(_job_sequence), None))
    await asyncio.gather(*_worker_tasks, return_exceptions=True)
    _worker_tasks.clear()
    _job_queue = None
    logger.info("Stopped inference workers")


async def submit_prediction_refresh(
    *,
    asset: str,
    model_keys: Optional[Iterable[str]] = None,
    include_analytics: bool = False,
    user_id: Optional[int] = None,
    trigger_source: str = "refresh",
    persist: bool = True,
) -> str:
    if _job_queue is None:
        raise RuntimeError("Inference workers are not running.")

    asset = asset.upper()
    normalized_models = _normalize_model_keys(asset, model_keys)
    loop = asyncio.get_running_loop()
    job_id = f"infer_{uuid4().hex[:20]}"
    priority = _priority_for_source(trigger_source)
    _jobs[job_id] = {
        "job_id": job_id,
        "asset": asset,
        "model_keys": normalized_models,
        "include_analytics": include_analytics,
        "persist": persist,
        "user_id": user_id,
        "trigger_source": trigger_source,
        "status": "queued",
        "created_at": datetime.utcnow().isoformat(),
        "started_at": None,
        "completed_at": None,
        "worker": None,
        "result": None,
        "error": None,
        "future": loop.create_future(),
    }
    await _job_queue.put((priority, next(_job_sequence), job_id))
    return job_id


async def wait_for_inference_job(job_id: str, timeout_seconds: Optional[float] = None) -> Dict:
    job = _jobs.get(job_id)
    if job is None:
        raise KeyError(job_id)
    return await asyncio.wait_for(job["future"], timeout=timeout_seconds)


async def request_prediction_refresh(
    *,
    asset: str,
    model_keys: Optional[Iterable[str]] = None,
    include_analytics: bool = False,
    user_id: Optional[int] = None,
    trigger_source: str = "refresh",
    persist: bool = True,
    timeout_seconds: Optional[float] = None,
) -> Dict:
    job_id = await submit_prediction_refresh(
        asset=asset,
        model_keys=model_keys,
        include_analytics=include_analytics,
        user_id=user_id,
        trigger_source=trigger_source,
        persist=persist,
    )
    result = await wait_for_inference_job(job_id, timeout_seconds=timeout_seconds)
    result["job_id"] = job_id
    return result


def get_inference_job(job_id: str) -> Optional[Dict]:
    if job_id not in _jobs:
        return None
    return _job_payload(job_id)


def list_inference_jobs(limit: int = 50) -> list[Dict]:
    rows = sorted(_jobs.values(), key=lambda item: item["created_at"], reverse=True)
    return [{k: v for k, v in row.items() if k != "future"} for row in rows[:limit]]


async def queue_priority_asset_refreshes(
    assets: Iterable[str],
    *,
    include_analytics: bool = True,
    trigger_source: str = "scheduled_refresh",
) -> list[str]:
    job_ids = []
    for asset in assets:
        asset = asset.upper()
        model_keys = ["ensemble", "lightgbm", "nhits", "tft"]
        job_ids.append(
            await submit_prediction_refresh(
                asset=asset,
                model_keys=model_keys,
                include_analytics=include_analytics,
                trigger_source=trigger_source,
                persist=True,
            )
        )
    return job_ids


async def _worker_loop(worker_id: int):
    assert _job_queue is not None
    while True:
        item = await _job_queue.get()
        if item[2] is None:
            _job_queue.task_done()
            return
        _, _, job_id = item

        job = _jobs[job_id]
        future = job["future"]
        job["status"] = "running"
        job["started_at"] = datetime.utcnow().isoformat()
        job["worker"] = f"worker-{worker_id}"

        try:
            result = await _run_job(job)
            job["status"] = "success"
            job["result"] = result
            job["completed_at"] = datetime.utcnow().isoformat()
            if not future.done():
                future.set_result(result)
        except Exception as exc:
            logger.error("Inference job %s failed: %s", job_id, exc, exc_info=True)
            job["status"] = "error"
            job["error"] = str(exc)
            job["completed_at"] = datetime.utcnow().isoformat()
            if not future.done():
                future.set_exception(exc)
        finally:
            _job_queue.task_done()


async def _run_job(job: Dict) -> Dict:
    from app.services.market_service import warm_market_data
    from app.services.prediction_record_service import persist_analytics_response, persist_model_response
    from app.services.prediction_service import (
        run_analytics_prediction,
        run_ensemble_prediction,
        run_lightgbm_model_prediction,
        run_multi_horizon_prediction,
        warm_prediction_runtime,
    )
    from app.services.runtime_snapshot_service import store_analytics_snapshot

    asset = job["asset"]
    model_keys = job["model_keys"]
    include_analytics = job["include_analytics"]
    user_id = job["user_id"]
    trigger_source = job["trigger_source"]
    persist = job["persist"]

    await _run_async_callable(warm_market_data, asset)
    await _run_async_callable(
        warm_prediction_runtime,
        asset,
        model_keys=model_keys + (["analytics"] if include_analytics else []),
    )

    db = SessionLocal()
    try:
        runs = []
        for model_key in model_keys:
            if model_key == "ensemble":
                payload = await _run_async_callable(run_ensemble_prediction, asset)
            elif model_key == "lightgbm":
                payload = await _run_async_callable(run_lightgbm_model_prediction, asset)
            elif model_key in {"nhits", "tft"}:
                payload = await _run_async_callable(run_multi_horizon_prediction, asset, model_key=model_key)
            else:
                continue

            if persist and payload.get("status") == "ok":
                payload = persist_model_response(
                    db,
                    payload,
                    user_id=user_id,
                    trigger_source=trigger_source,
                )
            runs.append(payload)

        if include_analytics:
            analytics_payload = await _run_async_callable(run_analytics_prediction, asset)
            if "error" not in analytics_payload:
                store_analytics_snapshot(asset, analytics_payload)
            if persist and "error" not in analytics_payload:
                analytics_payload = persist_analytics_response(
                    db,
                    analytics_payload,
                    user_id=user_id,
                    trigger_source=trigger_source,
                )
            runs.append(analytics_payload)

        return {
            "asset": asset,
            "generated_at": datetime.utcnow().isoformat(),
            "persisted": persist,
            "runs": runs,
        }
    finally:
        db.close()
