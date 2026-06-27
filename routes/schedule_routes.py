"""Schedule generation, What-If simulation, and sample data seeding routes."""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from fastapi import Depends
from agents.scheduler_agent.production_scheduler import create_production_schedule
from dependencies.auth import verify_token
from services.bom_service import load_bom
from services.data_service import DataService
from services.what_if_simulation_service import WhatIfSimulationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["schedule"], dependencies=[Depends(verify_token)])


class ScheduleRequest(BaseModel):
    workday_start: str = "09:00"
    workday_end: str = "17:00"
    default_duration_minutes: int = 60
    setup_minutes: int = 0
    # Supabase-sourced data passed from the frontend
    orders: list[dict[str, Any]] | None = None
    machines: list[dict[str, Any]] | None = None
    inventory: list[dict[str, Any]] | None = None
    # Optional BOM override; built-in defaults used when omitted
    bom: dict[str, list[dict[str, Any]]] | None = None
    # When supplied the schedule is persisted to Supabase for the company
    company_id: str | None = None


class WhatIfRequest(BaseModel):
    schedule: list[dict[str, Any]]
    scenario: dict[str, Any]
    machines: list[dict[str, Any]] | None = None
    inventory: list[dict[str, Any]] | None = None
    # Required for inventory_reduction so the pipeline can be re-run
    orders: list[dict[str, Any]] | None = None
    bom: dict[str, list[dict[str, Any]]] | None = None


def _enrich_times(schedule: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert bare HH:MM strings to ISO datetime so WhatIf can parse them."""
    today = date.today().isoformat()
    for item in schedule:
        for field in ("start", "end"):
            val = item.get(field)
            if val and isinstance(val, str) and len(val) == 5 and "T" not in val:
                item[field] = f"{today}T{val}:00"
    return schedule


def _compute_machine_utilization(
    schedule: list[dict[str, Any]],
    machines: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Compute per-machine utilisation from schedule durations."""
    WORKDAY_MIN = 8 * 60  # 09:00–17:00

    def _parse_min(val: str | None) -> int:
        if not val:
            return 0
        time_part = val.split("T")[1] if "T" in val else val
        parts = time_part.split(":")
        try:
            return int(parts[0]) * 60 + int(parts[1])
        except (IndexError, ValueError):
            return 0

    minutes_by_machine: dict[str, int] = {}
    for item in schedule:
        mid = item.get("machine")
        if not mid or item.get("status") == "blocked":
            continue
        dur = max(0, _parse_min(item.get("end")) - _parse_min(item.get("start")))
        minutes_by_machine[mid] = minutes_by_machine.get(mid, 0) + dur

    enriched: list[dict[str, Any]] = []
    for m in machines:
        mid = m.get("machine_id") or m.get("machine_code") or m.get("machine")
        mins = minutes_by_machine.get(mid, 0) if mid else 0
        util_pct = min(100, round((mins / WORKDAY_MIN) * 100)) if WORKDAY_MIN > 0 else 0
        cap = m.get("capacity") or m.get("capacity_per_hour") or 100
        enriched.append({
            **m,
            "utilization_pct":    util_pct,
            "scheduled_minutes":  mins,
            "current_load":       round((mins / WORKDAY_MIN) * cap),
        })
    return enriched


async def _persist_schedule(
    company_id: str,
    schedule: list[dict[str, Any]],
    summary: dict[str, Any],
    machines: list[dict[str, Any]],
) -> None:
    """Save the latest schedule to Supabase (replace existing for the company)."""
    from settings import settings
    if not settings.supabase_is_configured:
        logger.debug("Supabase not configured — skipping schedule persistence")
        return
    try:
        url = settings.supabase_url.rstrip("/") + "/rest/v1/schedules"
        headers = {
            "apikey":        settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type":  "application/json",
            "Prefer":        "return=minimal",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            # Keep only the latest schedule per company
            await client.delete(
                url,
                headers=headers,
                params={"company_id": f"eq.{company_id}"},
            )
            await client.post(
                url,
                headers=headers,
                json={
                    "company_id":     company_id,
                    "summary":        summary,
                    "schedule_items": schedule,
                    "machines":       machines,
                },
            )
        logger.info("Persisted schedule for company %s (%d items)", company_id, len(schedule))
    except Exception:
        logger.exception("Failed to persist schedule — continuing without saving")


@router.post("/schedule")
async def generate_schedule(request: ScheduleRequest) -> dict[str, Any]:
    try:
        effective_bom = request.bom if request.bom is not None else load_bom()

        raw = create_production_schedule(
            orders=request.orders or None,
            machines_data=request.machines or None,
            inventory_data=request.inventory or None,
            workday_start=request.workday_start,
            workday_end=request.workday_end,
            default_duration_minutes=request.default_duration_minutes,
            setup_minutes=request.setup_minutes,
            bom=effective_bom,
        )
        schedule = _enrich_times(raw)

        on_track = sum(
            1 for s in schedule
            if s.get("status") not in ("delayed", "blocked", "error") and not s.get("delay")
        )
        delayed = sum(1 for s in schedule if s.get("status") == "delayed" or s.get("delay"))
        blocked = sum(1 for s in schedule if s.get("status") == "blocked")

        source_machines = request.machines or DataService.get_data_as_json("machines")
        machines_enriched = _compute_machine_utilization(schedule, source_machines)

        summary = {
            "on_track": on_track,
            "delayed":  delayed,
            "blocked":  blocked,
            "total":    len(schedule),
        }

        # Persist to Supabase if company_id is provided
        if request.company_id:
            await _persist_schedule(request.company_id, schedule, summary, machines_enriched)

        return {
            "status":   "success",
            "schedule": schedule,
            "count":    len(schedule),
            "summary":  summary,
            "machines": machines_enriched,
        }
    except Exception as exc:
        logger.exception("Schedule generation failed")
        raise HTTPException(status_code=500, detail="Schedule generation failed") from exc


@router.post("/whatif")
async def run_whatif(request: WhatIfRequest) -> dict[str, Any]:
    try:
        machines  = request.machines  or DataService.get_data_as_json("machines")
        inventory = request.inventory or DataService.get_data_as_json("inventory")
        result = WhatIfSimulationService.simulate(
            schedule=request.schedule,
            machines=machines,
            inventory=inventory,
            scenario=request.scenario,
            orders=request.orders,
            bom=request.bom,
        )
        return result
    except Exception as exc:
        logger.exception("What-if simulation failed")
        raise HTTPException(status_code=500, detail="What-if simulation failed") from exc


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
