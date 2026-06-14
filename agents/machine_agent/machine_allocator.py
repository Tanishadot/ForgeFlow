"""Machine allocation logic for the NVIDIA AgentIQ Machine Agent."""

from __future__ import annotations

import logging
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from services.data_service import DataService

logger = logging.getLogger(__name__)

DEFAULT_MACHINES_FILE = "machines.csv"

MACHINE_ID_COLUMNS = ("machine_id", "machine", "id")
MACHINE_NAME_COLUMNS = ("machine_name", "name", "label")
MACHINE_TYPE_COLUMNS = ("machine_type", "type", "capability", "work_center")
STATUS_COLUMNS = ("status", "machine_status", "state")
CAPACITY_COLUMNS = ("capacity", "max_capacity", "rated_capacity")
CURRENT_LOAD_COLUMNS = ("current_load", "load", "assigned_load", "workload")
AVAILABLE_CAPACITY_COLUMNS = ("available_capacity", "remaining_capacity")
UTILIZATION_COLUMNS = ("utilization", "utilization_percent", "load_percent")
EFFICIENCY_COLUMNS = ("efficiency", "efficiency_percent")
LOCATION_COLUMNS = ("location", "plant", "site", "cell")
DOWNTIME_REASON_COLUMNS = ("downtime_reason", "reason", "maintenance_reason")

DOWNTIME_STATUSES = {
    "down",
    "downtime",
    "offline",
    "maintenance",
    "repair",
    "failed",
    "failure",
    "unavailable",
    "stopped",
}
AVAILABLE_STATUSES = {
    "active",
    "available",
    "idle",
    "in production",
    "online",
    "operational",
    "production",
    "ready",
    "running",
}


@dataclass(frozen=True)
class MachineAllocationConfig:
    """Thresholds and defaults used by the machine allocator."""

    overload_threshold: float = 0.85
    minimum_efficiency: float = 0.0


DEFAULT_CONFIG = MachineAllocationConfig()


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return str(value).strip().lower() in {"", "nan", "none", "null"}


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if _is_missing(value):
            return default
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(parsed) or math.isinf(parsed):
        return default
    return parsed


def _first_present(row: dict[str, Any], candidates: tuple[str, ...]) -> Any:
    for column in candidates:
        if column in row and not _is_missing(row[column]):
            return row[column]
    return None


def _normalize(value: Any) -> str:
    return str(value).strip().lower()


def _load_machines(machines_file: str | None = DEFAULT_MACHINES_FILE) -> list[dict[str, Any]]:
    machines_df = DataService.get_data("machines")
    if not machines_df.empty:
        logger.info("Loaded %d machine records from DataService", len(machines_df))
        return machines_df.to_dict(orient="records")

    if machines_file:
        path = Path(machines_file)
        if path.exists():
            logger.info("Reading machine availability from %s", path)
            return pd.read_csv(path).to_dict(orient="records")
        logger.warning("%s was not found", machines_file)

    return []


def _capacity(row: dict[str, Any]) -> float:
    return _safe_float(_first_present(row, CAPACITY_COLUMNS))


def _current_load(row: dict[str, Any]) -> float:
    return _safe_float(_first_present(row, CURRENT_LOAD_COLUMNS))


def _efficiency(row: dict[str, Any]) -> float:
    efficiency = _safe_float(_first_present(row, EFFICIENCY_COLUMNS), default=100.0)
    if efficiency > 1:
        efficiency = efficiency / 100.0
    return max(0.0, min(1.0, efficiency))


def _utilization(row: dict[str, Any]) -> float:
    explicit_utilization = _first_present(row, UTILIZATION_COLUMNS)
    if not _is_missing(explicit_utilization):
        value = _safe_float(explicit_utilization)
        if value > 1:
            value = value / 100.0
        return max(0.0, value)

    capacity = _capacity(row)
    if capacity <= 0:
        return 1.0
    return max(0.0, _current_load(row) / capacity)


def _available_capacity(row: dict[str, Any]) -> float:
    explicit_available = _first_present(row, AVAILABLE_CAPACITY_COLUMNS)
    if not _is_missing(explicit_available):
        return max(0.0, _safe_float(explicit_available))
    return max(0.0, _capacity(row) - _current_load(row))


def _machine_identity(row: dict[str, Any], index: int) -> dict[str, Any]:
    machine_id = _first_present(row, MACHINE_ID_COLUMNS) or f"machine-{index}"
    machine_name = _first_present(row, MACHINE_NAME_COLUMNS) or machine_id
    return {
        "machine_id": str(machine_id),
        "machine_name": str(machine_name),
        "machine_type": _first_present(row, MACHINE_TYPE_COLUMNS),
        "location": _first_present(row, LOCATION_COLUMNS),
    }


def _is_downtime(row: dict[str, Any]) -> bool:
    status = _normalize(_first_present(row, STATUS_COLUMNS) or "available")
    return status in DOWNTIME_STATUSES


def _downtime_reason(row: dict[str, Any]) -> str:
    explicit_reason = _first_present(row, DOWNTIME_REASON_COLUMNS)
    if explicit_reason:
        return str(explicit_reason)
    status = _first_present(row, STATUS_COLUMNS)
    if status:
        return f"machine status is {status}"
    return "machine is unavailable"


def _is_available(row: dict[str, Any], config: MachineAllocationConfig) -> bool:
    status = _normalize(_first_present(row, STATUS_COLUMNS) or "available")
    if status in DOWNTIME_STATUSES:
        return False
    if status and status not in AVAILABLE_STATUSES and status not in {"busy", "loaded"}:
        return False
    if _capacity(row) <= 0:
        return False
    if _utilization(row) >= config.overload_threshold:
        return False
    if _efficiency(row) < config.minimum_efficiency:
        return False
    return True


def _is_overloaded(row: dict[str, Any], config: MachineAllocationConfig) -> bool:
    capacity = _capacity(row)
    if capacity <= 0:
        return False
    return _utilization(row) >= config.overload_threshold or _current_load(row) > capacity


def _machine_type_matches(row: dict[str, Any], requested_type: str | None) -> bool:
    if not requested_type:
        return True
    machine_type = _first_present(row, MACHINE_TYPE_COLUMNS)
    return bool(machine_type) and _normalize(machine_type) == _normalize(requested_type)


def _location_matches(row: dict[str, Any], requested_location: str | None) -> bool:
    if not requested_location:
        return True
    location = _first_present(row, LOCATION_COLUMNS)
    return bool(location) and _normalize(location) == _normalize(requested_location)


def _allocation_score(row: dict[str, Any], required_capacity: float) -> float:
    available_capacity = _available_capacity(row)
    capacity_fit = min(1.0, available_capacity / required_capacity) if required_capacity > 0 else 1.0
    load_headroom = max(0.0, 1.0 - min(1.0, _utilization(row)))
    efficiency = _efficiency(row)
    return round((0.45 * capacity_fit) + (0.35 * load_headroom) + (0.20 * efficiency), 4)


def _machine_snapshot(
    row: dict[str, Any],
    index: int,
    config: MachineAllocationConfig,
    required_capacity: float,
) -> dict[str, Any]:
    snapshot = _machine_identity(row, index)
    utilization = _utilization(row)
    snapshot.update(
        {
            "status": _first_present(row, STATUS_COLUMNS) or "available",
            "capacity": _capacity(row),
            "current_load": _current_load(row),
            "available_capacity": _available_capacity(row),
            "utilization": round(utilization, 4),
            "efficiency": round(_efficiency(row), 4),
            "is_available": _is_available(row, config),
            "is_down": _is_downtime(row),
            "is_overloaded": _is_overloaded(row, config),
            "allocation_score": _allocation_score(row, required_capacity),
        }
    )
    if snapshot["is_down"]:
        snapshot["downtime_reason"] = _downtime_reason(row)
    return snapshot


def allocate_machine(
    order_id: str | None = None,
    required_capacity: float = 0.0,
    machine_type: str | None = None,
    location: str | None = None,
    machines_file: str | None = DEFAULT_MACHINES_FILE,
    config: MachineAllocationConfig | None = None,
) -> dict[str, Any]:
    """Read machines, detect issues, and return machine allocation JSON."""
    allocation_config = config or DEFAULT_CONFIG
    required = _safe_float(required_capacity)
    response: dict[str, Any] = {
        "status": "success",
        "agent": "machine_agent",
        "order": order_id,
        "allocation": None,
        "recommendations": [],
        "machine_alerts": [],
        "summary": {
            "total_machines": 0,
            "available_machines": 0,
            "down_machines": 0,
            "overloaded_machines": 0,
        },
        "allocation_model": {
            "rank_order": "highest allocation_score first",
            "overload_threshold": allocation_config.overload_threshold,
            "minimum_efficiency": allocation_config.minimum_efficiency,
        },
        "errors": [],
    }

    try:
        machine_records = _load_machines(machines_file)
        if not machine_records:
            response["status"] = "error"
            response["errors"].append("No machine availability data found")
            return response

        response["summary"]["total_machines"] = len(machine_records)
        snapshots = [
            _machine_snapshot(row, index, allocation_config, required)
            for index, row in enumerate(machine_records)
        ]

        for snapshot in snapshots:
            if snapshot["is_down"]:
                response["machine_alerts"].append(
                    {
                        "machine_id": snapshot["machine_id"],
                        "status": "down",
                        "reason": snapshot.get("downtime_reason", "machine is unavailable"),
                    }
                )
            if snapshot["is_overloaded"]:
                response["machine_alerts"].append(
                    {
                        "machine_id": snapshot["machine_id"],
                        "status": "overloaded",
                        "reason": "machine utilization exceeds threshold",
                        "utilization": snapshot["utilization"],
                        "capacity": snapshot["capacity"],
                        "current_load": snapshot["current_load"],
                    }
                )

        eligible = []
        for index, row in enumerate(machine_records):
            snapshot = snapshots[index]
            if not snapshot["is_available"]:
                continue
            if not _machine_type_matches(row, machine_type):
                continue
            if not _location_matches(row, location):
                continue
            if required > 0 and snapshot["available_capacity"] < required:
                continue
            eligible.append(snapshot)

        eligible.sort(
            key=lambda machine: (
                machine["allocation_score"],
                machine["available_capacity"],
                machine["efficiency"],
            ),
            reverse=True,
        )

        response["summary"]["available_machines"] = sum(1 for item in snapshots if item["is_available"])
        response["summary"]["down_machines"] = sum(1 for item in snapshots if item["is_down"])
        response["summary"]["overloaded_machines"] = sum(1 for item in snapshots if item["is_overloaded"])
        response["recommendations"] = eligible

        if eligible:
            selected = eligible[0]
            response["allocation"] = {
                "order": order_id,
                "status": "assigned",
                "machine_id": selected["machine_id"],
                "machine_name": selected["machine_name"],
                "machine_type": selected["machine_type"],
                "location": selected["location"],
                "required_capacity": required,
                "available_capacity": selected["available_capacity"],
                "allocation_score": selected["allocation_score"],
                "reason": "best available machine by capacity, load, and efficiency",
            }
        else:
            response["status"] = "blocked"
            response["allocation"] = {
                "order": order_id,
                "status": "blocked",
                "machine_id": None,
                "required_capacity": required,
                "reason": "no available machine satisfies the request",
            }

        if response["machine_alerts"] and response["status"] == "success":
            response["status"] = "alert"

        logger.info(
            "Machine allocation completed: %d machines, %d eligible, status=%s",
            len(machine_records),
            len(eligible),
            response["status"],
        )
        return response
    except Exception as exc:
        logger.exception("Failed to allocate machine")
        response["status"] = "error"
        response["errors"].append(f"Failed to allocate machine: {exc}")
        return response


class MachineAgent:
    """Small async wrapper used by AgentIQ or application code."""

    def __init__(self, config: MachineAllocationConfig | None = None):
        self._config = config or DEFAULT_CONFIG

    async def run(self, **kwargs: Any) -> dict[str, Any]:
        return allocate_machine(config=self._config, **kwargs)
