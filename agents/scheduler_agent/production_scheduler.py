"""Production scheduling logic for the NVIDIA AgentIQ Scheduler Agent."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

from agents.inventory_agent.inventory_checker import verify_inventory
from agents.machine_agent.machine_allocator import (
    MachineAllocationConfig,
    allocate_machine,
)
from agents.order_agent.order_prioritizer import prioritize_orders, prioritize_orders_from_list
from services.data_service import DataService

logger = logging.getLogger(__name__)

DEFAULT_ORDERS_FILE = "orders.csv"
DEFAULT_INVENTORY_FILE = "inventory.csv"
DEFAULT_MACHINES_FILE = "machines.csv"

ORDER_COLUMNS = ("order_id", "order", "id")
MATERIAL_COLUMNS = ("material", "material_name", "product_name", "sku", "product_id")
QUANTITY_COLUMNS = ("quantity", "required_quantity", "order_quantity")
MACHINE_TYPE_COLUMNS = ("machine_type", "required_machine_type", "work_center", "capability")
LOCATION_COLUMNS = ("location", "plant", "site", "cell")
DURATION_COLUMNS = ("duration_minutes", "processing_minutes", "runtime_minutes", "estimated_minutes")
DUE_DATE_COLUMNS = ("due_date", "required_date", "promise_date", "order_date")


@dataclass(frozen=True)
class SchedulerConfig:
    """Production scheduling defaults."""

    schedule_date: date
    workday_start: time = time(hour=9, minute=0)
    workday_end: time = time(hour=17, minute=0)
    default_duration_minutes: int = 60
    setup_minutes: int = 0
    overload_threshold: float = 0.85
    minimum_efficiency: float = 0.0


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


def _parse_date(value: Any) -> date | None:
    if _is_missing(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if hasattr(value, "to_pydatetime"):
        return value.to_pydatetime().date()
    for date_format in ("%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(value), date_format).date()
        except (TypeError, ValueError):
            continue
    return None


def _parse_time(value: str, default: time) -> time:
    if not value:
        return default
    for time_format in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(value, time_format).time()
        except ValueError:
            continue
    logger.warning("Unable to parse time value %s; using %s", value, default)
    return default


def _format_clock(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%H:%M")


def _load_csv_records(file_path: str | None) -> list[dict[str, Any]]:
    if not file_path:
        return []
    path = Path(file_path)
    if not path.exists():
        logger.warning("%s was not found", file_path)
        return []
    return pd.read_csv(path).to_dict(orient="records")


def _load_orders(orders_file: str | None) -> list[dict[str, Any]]:
    prioritized = prioritize_orders()
    if prioritized["orders"]:
        return prioritized["orders"]

    orders_df = DataService.get_data("orders")
    if not orders_df.empty:
        return orders_df.to_dict(orient="records")

    return _load_csv_records(orders_file)


def _normalize_order_id(value: Any, fallback: str) -> str:
    if _is_missing(value):
        return fallback
    return str(value)


def _duration_minutes(order: dict[str, Any], machine_allocation: dict[str, Any], config: SchedulerConfig) -> int:
    explicit_duration = _safe_float(_first_present(order, DURATION_COLUMNS))
    if explicit_duration > 0:
        return max(1, int(round(explicit_duration + config.setup_minutes)))

    quantity = _safe_float(_first_present(order, QUANTITY_COLUMNS))
    available_capacity = _safe_float(machine_allocation.get("available_capacity"))
    if quantity > 0 and available_capacity > 0:
        estimated = (quantity / available_capacity) * 60
        return max(1, int(round(estimated + config.setup_minutes)))

    return max(1, config.default_duration_minutes + config.setup_minutes)


def _delay_status(
    order: dict[str, Any],
    start: datetime,
    end: datetime,
    config: SchedulerConfig,
) -> tuple[bool, str | None]:
    due_date = _parse_date(_first_present(order, DUE_DATE_COLUMNS))
    if due_date and end.date() > due_date:
        return True, "scheduled after due date"

    workday_end = datetime.combine(config.schedule_date, config.workday_end)
    if end > workday_end:
        return True, "scheduled beyond workday end"

    return False, None


def _blocked_orders_from_inventory(inventory_status: dict[str, Any]) -> dict[str, str]:
    blocked: dict[str, str] = {}
    for alert in inventory_status.get("alerts", []):
        if alert.get("status") == "blocked" and alert.get("order"):
            blocked[str(alert["order"])] = str(alert.get("reason", "inventory blocked"))
    return blocked


def _schedule_entry(
    order_id: str,
    machine_id: str | None,
    start: datetime | None,
    end: datetime | None,
    status: str,
    reason: str | None = None,
    delay: bool = False,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "order": order_id,
        "machine": machine_id,
        "start": _format_clock(start),
        "end": _format_clock(end),
    }
    if status != "scheduled":
        entry["status"] = status
    if delay:
        entry["delay"] = True
    if reason:
        entry["reason"] = reason
    return entry


def create_production_schedule(
    orders: list[dict[str, Any]] | None = None,
    inventory_status: dict[str, Any] | None = None,
    machine_availability: dict[str, Any] | None = None,
    schedule_date: str | date | None = None,
    workday_start: str = "09:00",
    workday_end: str = "17:00",
    default_duration_minutes: int = 60,
    setup_minutes: int = 0,
    orders_file: str | None = DEFAULT_ORDERS_FILE,
    inventory_file: str | None = DEFAULT_INVENTORY_FILE,
    machines_file: str | None = DEFAULT_MACHINES_FILE,
    machines_data: list[dict[str, Any]] | None = None,
    inventory_data: list[dict[str, Any]] | None = None,
    bom: dict[str, list[dict[str, Any]]] | None = None,
) -> list[dict[str, Any]]:
    """Create a JSON-serializable production schedule."""
    config = SchedulerConfig(
        schedule_date=_parse_date(schedule_date) or date.today(),
        workday_start=_parse_time(workday_start, time(hour=9)),
        workday_end=_parse_time(workday_end, time(hour=17)),
        default_duration_minutes=max(1, int(default_duration_minutes)),
        setup_minutes=max(0, int(setup_minutes)),
    )
    machine_config = MachineAllocationConfig(
        overload_threshold=config.overload_threshold,
        minimum_efficiency=config.minimum_efficiency,
    )

    schedule_start = datetime.combine(config.schedule_date, config.workday_start)
    machine_next_available: dict[str, datetime] = {}
    schedule: list[dict[str, Any]] = []

    # Load the BOM once; use built-in defaults when caller does not supply one
    from services.bom_service import load_bom
    effective_bom = bom if bom is not None else load_bom()

    try:
        # Always run OrderPrioritizerAgent: either prioritize a pre-loaded list
        # (Supabase flow) or fall back to DataService / CSV (legacy flow).
        if orders:
            order_queue = prioritize_orders_from_list(orders)
        else:
            order_queue = _load_orders(orders_file)

        if not order_queue:
            logger.warning("No prioritized orders found for scheduling")
            return []

        inventory = inventory_status or verify_inventory(
            inventory_file=inventory_file,
            orders_file=orders_file,
            inventory_records=inventory_data,
            orders_records=order_queue if inventory_data else None,
            bom=effective_bom,
        )
        blocked_orders = _blocked_orders_from_inventory(inventory)

        if machine_availability and machine_availability.get("allocation"):
            logger.info("Machine availability input supplied; using it as advisory context")

        for index, order in enumerate(order_queue):
            order_id = _normalize_order_id(
                _first_present(order, ORDER_COLUMNS),
                fallback=f"order-{index}",
            )

            if order_id in blocked_orders:
                schedule.append(
                    _schedule_entry(
                        order_id=order_id,
                        machine_id=None,
                        start=None,
                        end=None,
                        status="blocked",
                        reason=blocked_orders[order_id],
                    )
                )
                continue

            required_capacity = _safe_float(_first_present(order, QUANTITY_COLUMNS))
            allocation = allocate_machine(
                order_id=order_id,
                required_capacity=required_capacity,
                machine_type=_first_present(order, MACHINE_TYPE_COLUMNS),
                location=_first_present(order, LOCATION_COLUMNS),
                machines_file=machines_file,
                config=machine_config,
                machines_data=machines_data,
            )
            allocation_result = allocation.get("allocation") or {}
            machine_id = allocation_result.get("machine_id")

            if allocation_result.get("status") != "assigned" or not machine_id:
                schedule.append(
                    _schedule_entry(
                        order_id=order_id,
                        machine_id=None,
                        start=None,
                        end=None,
                        status="blocked",
                        reason=allocation_result.get("reason", "no machine available"),
                    )
                )
                continue

            machine_start = machine_next_available.get(machine_id, schedule_start)
            duration = _duration_minutes(order, allocation_result, config)
            machine_end = machine_start + timedelta(minutes=duration)
            machine_next_available[machine_id] = machine_end

            delay, delay_reason = _delay_status(order, machine_start, machine_end, config)
            schedule.append(
                _schedule_entry(
                    order_id=order_id,
                    machine_id=machine_id,
                    start=machine_start,
                    end=machine_end,
                    status="delayed" if delay else "scheduled",
                    reason=delay_reason,
                    delay=delay,
                )
            )

        logger.info("Created production schedule with %d entries", len(schedule))
        return schedule
    except Exception as exc:
        logger.exception("Failed to create production schedule")
        return [
            {
                "order": None,
                "machine": None,
                "start": None,
                "end": None,
                "status": "error",
                "reason": f"Failed to create production schedule: {exc}",
            }
        ]


class SchedulerAgent:
    """Small async wrapper used by AgentIQ or application code."""

    async def run(self, **kwargs: Any) -> list[dict[str, Any]]:
        return create_production_schedule(**kwargs)
