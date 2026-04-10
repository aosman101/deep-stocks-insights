"""
In-process training job tracking.

This keeps heavy model training off the request path while remaining simple
enough for the current deployment model.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

_jobs: Dict[str, Dict] = {}


def _job_key() -> str:
    return f"train_{uuid4().hex[:20]}"


async def _run_job(job_id: str, *, asset: str, model_key: str, period: str, epochs: Optional[int]):
    from app.services.prediction_service import train_any_model

    job = _jobs[job_id]
    job["status"] = "running"
    job["started_at"] = datetime.utcnow().isoformat()
    try:
        result = await train_any_model(asset, period=period, epochs=epochs, model_key=model_key)
        job["status"] = result.get("status", "unknown")
        job["result"] = result
        job["message"] = result.get("message")
        job["model_version"] = result.get("model_version") or result.get("version")
    except Exception as exc:
        logger.error(f"Training job {job_id} failed: {exc}", exc_info=True)
        job["status"] = "error"
        job["result"] = {"asset": asset, "model_key": model_key, "message": str(exc)}
        job["message"] = str(exc)
    finally:
        job["completed_at"] = datetime.utcnow().isoformat()


def create_training_job(*, asset: str, model_key: str, period: str = "2y", epochs: Optional[int] = None) -> Dict:
    job_id = _job_key()
    payload = {
        "job_id": job_id,
        "asset": asset.upper(),
        "model_key": model_key.lower(),
        "period": period,
        "epochs": epochs,
        "status": "queued",
        "message": "Training job queued.",
        "created_at": datetime.utcnow().isoformat(),
        "started_at": None,
        "completed_at": None,
        "model_version": None,
        "result": None,
    }
    _jobs[job_id] = payload
    asyncio.create_task(_run_job(job_id, asset=asset.upper(), model_key=model_key.lower(), period=period, epochs=epochs))
    return payload


def get_training_job(job_id: str) -> Optional[Dict]:
    return _jobs.get(job_id)


def list_training_jobs(*, asset: Optional[str] = None, model_key: Optional[str] = None) -> list[Dict]:
    jobs = list(_jobs.values())
    if asset:
        jobs = [job for job in jobs if job["asset"] == asset.upper()]
    if model_key:
        jobs = [job for job in jobs if job["model_key"] == model_key.lower()]
    jobs.sort(key=lambda job: job["created_at"], reverse=True)
    return jobs
