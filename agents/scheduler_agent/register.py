"""AgentIQ registration for the Scheduler Agent."""

import json
import logging
from typing import Any

from pydantic import Field

from aiq.builder.builder import Builder
from aiq.builder.function import FunctionInfo
from aiq.cli.register_workflow import register_function
from aiq.data_models.function import FunctionBaseConfig

from .production_scheduler import (
    DEFAULT_INVENTORY_FILE,
    DEFAULT_MACHINES_FILE,
    DEFAULT_ORDERS_FILE,
    create_production_schedule,
)

logger = logging.getLogger(__name__)


def _parse_scheduler_query(query: str) -> dict[str, Any]:
    if not query or not query.strip():
        return {}

    try:
        payload = json.loads(query)
    except json.JSONDecodeError:
        logger.info("Scheduler query is not JSON; running configured default schedule")
        return {}

    if not isinstance(payload, dict):
        logger.warning("Scheduler query JSON must be an object; got %s", type(payload).__name__)
        return {}

    return payload


class SchedulerAgentConfig(FunctionBaseConfig, name="scheduler_agent"):
    """AgentIQ function configuration for production scheduling."""

    orders_file: str = Field(
        default=DEFAULT_ORDERS_FILE,
        description="Fallback CSV file for orders when DataService has no order data.",
    )
    inventory_file: str = Field(
        default=DEFAULT_INVENTORY_FILE,
        description="Fallback CSV file for inventory when DataService has no inventory data.",
    )
    machines_file: str = Field(
        default=DEFAULT_MACHINES_FILE,
        description="Fallback CSV file for machines when DataService has no machine data.",
    )
    workday_start: str = Field(default="09:00", description="Schedule start time in HH:MM.")
    workday_end: str = Field(default="17:00", description="Schedule end time in HH:MM.")
    default_duration_minutes: int = Field(
        default=60,
        ge=1,
        description="Fallback duration when an order has no quantity or duration.",
    )
    setup_minutes: int = Field(
        default=0,
        ge=0,
        description="Setup minutes added to every scheduled order.",
    )


@register_function(config_type=SchedulerAgentConfig)
async def scheduler_agent(
    config: SchedulerAgentConfig,
    _builder: Builder,
):
    """Register the production scheduling tool with AgentIQ."""
    logger.info("Initializing Scheduler Agent")

    async def _create_schedule(query: str = "") -> str:
        """Return a JSON production schedule.

        Optional query JSON may include:
        {
          "orders": [...],
          "inventory_status": {...},
          "machine_availability": {...},
          "schedule_date": "2026-06-14",
          "workday_start": "09:00",
          "workday_end": "17:00"
        }
        """
        logger.info("AgentIQ scheduler invoked with query=%r", query)
        try:
            payload = _parse_scheduler_query(query)
            result = create_production_schedule(
                orders=payload.get("orders"),
                inventory_status=payload.get("inventory_status"),
                machine_availability=payload.get("machine_availability"),
                schedule_date=payload.get("schedule_date"),
                workday_start=payload.get("workday_start", config.workday_start),
                workday_end=payload.get("workday_end", config.workday_end),
                default_duration_minutes=payload.get(
                    "default_duration_minutes",
                    config.default_duration_minutes,
                ),
                setup_minutes=payload.get("setup_minutes", config.setup_minutes),
                orders_file=payload.get("orders_file", config.orders_file),
                inventory_file=payload.get("inventory_file", config.inventory_file),
                machines_file=payload.get("machines_file", config.machines_file),
            )
            return json.dumps(result, indent=2, default=str)
        except Exception:
            logger.exception("Unhandled failure while creating production schedule")
            return json.dumps(
                [
                    {
                        "order": None,
                        "machine": None,
                        "start": None,
                        "end": None,
                        "status": "error",
                        "reason": "Internal error while creating production schedule",
                    }
                ],
                indent=2,
            )

    yield FunctionInfo.from_fn(
        _create_schedule,
        description=_create_schedule.__doc__,
    )
