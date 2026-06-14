"""Schedule generation, What-If simulation, and sample data seeding routes."""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.scheduler_agent.production_scheduler import create_production_schedule
from services.data_service import DataService
from services.what_if_simulation_service import WhatIfSimulationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["schedule"])


class ScheduleRequest(BaseModel):
    workday_start: str = "09:00"
    workday_end: str = "17:00"
    default_duration_minutes: int = 60
    setup_minutes: int = 0


class WhatIfRequest(BaseModel):
    schedule: list[dict[str, Any]]
    scenario: dict[str, Any]


def _enrich_times(schedule: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert bare HH:MM strings to ISO datetime so WhatIf service can parse them."""
    today = date.today().isoformat()
    for item in schedule:
        for field in ("start", "end"):
            val = item.get(field)
            if val and isinstance(val, str) and len(val) == 5 and "T" not in val:
                item[field] = f"{today}T{val}:00"
    return schedule


@router.post("/schedule")
async def generate_schedule(request: ScheduleRequest) -> dict[str, Any]:
    try:
        raw = create_production_schedule(
            workday_start=request.workday_start,
            workday_end=request.workday_end,
            default_duration_minutes=request.default_duration_minutes,
            setup_minutes=request.setup_minutes,
        )
        schedule = _enrich_times(raw)

        on_track = sum(1 for s in schedule if s.get("status") not in ("delayed", "blocked", "error") and not s.get("delay"))
        delayed = sum(1 for s in schedule if s.get("status") == "delayed" or s.get("delay"))
        blocked = sum(1 for s in schedule if s.get("status") == "blocked")

        return {
            "status": "success",
            "schedule": schedule,
            "count": len(schedule),
            "summary": {
                "on_track": on_track,
                "delayed": delayed,
                "blocked": blocked,
                "total": len(schedule),
            },
        }
    except Exception as exc:
        logger.exception("Schedule generation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/whatif")
async def run_whatif(request: WhatIfRequest) -> dict[str, Any]:
    try:
        machines = DataService.get_data_as_json("machines")
        inventory = DataService.get_data_as_json("inventory")
        result = WhatIfSimulationService.simulate(
            schedule=request.schedule,
            machines=machines,
            inventory=inventory,
            scenario=request.scenario,
        )
        return result
    except Exception as exc:
        logger.exception("What-if simulation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/seed")
async def seed_sample_data() -> dict[str, Any]:
    """Load bundled sample CSVs into DataService for demo without file upload."""
    import pandas as pd
    from pathlib import Path

    base = Path("data")
    loaded: list[str] = []
    errors: list[str] = []

    for name in ("orders", "machines", "inventory"):
        path = base / f"{name}.csv"
        if path.exists():
            DataService._data_store[name] = pd.read_csv(path)
            loaded.append(name)
        else:
            errors.append(f"{path} not found")

    return {"status": "seeded", "loaded": loaded, "errors": errors}
