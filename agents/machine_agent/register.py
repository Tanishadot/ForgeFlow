"""AgentIQ registration for the Machine Agent."""

import json
import logging
from typing import Any

from pydantic import Field

from aiq.builder.builder import Builder
from aiq.builder.function import FunctionInfo
from aiq.cli.register_workflow import register_function
from aiq.data_models.function import FunctionBaseConfig

from .machine_allocator import (
    DEFAULT_MACHINES_FILE,
    MachineAllocationConfig,
    allocate_machine,
)

logger = logging.getLogger(__name__)


def _parse_machine_query(query: str) -> dict[str, Any]:
    if not query or not query.strip():
        return {}

    try:
        payload = json.loads(query)
    except json.JSONDecodeError:
        logger.info("Machine query is not JSON; running configured default allocation")
        return {}

    if not isinstance(payload, dict):
        logger.warning("Machine query JSON must be an object; got %s", type(payload).__name__)
        return {}

    return payload


class MachineAgentConfig(FunctionBaseConfig, name="machine_agent"):
    """AgentIQ function configuration for machine allocation."""

    machines_file: str = Field(
        default=DEFAULT_MACHINES_FILE,
        description="Fallback CSV file to read when DataService has no machine data.",
    )
    overload_threshold: float = Field(
        default=0.85,
        ge=0.0,
        le=1.5,
        description="Utilization threshold at or above which a machine is overloaded.",
    )
    minimum_efficiency: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Minimum efficiency required for a machine to be assignable.",
    )


@register_function(config_type=MachineAgentConfig)
async def machine_agent(
    config: MachineAgentConfig,
    _builder: Builder,
):
    """Register the machine allocation tool with AgentIQ."""
    allocation_config = MachineAllocationConfig(
        overload_threshold=config.overload_threshold,
        minimum_efficiency=config.minimum_efficiency,
    )
    logger.info(
        "Initializing Machine Agent with machines_file=%s overload_threshold=%.2f",
        config.machines_file,
        config.overload_threshold,
    )

    async def _allocate_machine(query: str = "") -> str:
        """Return JSON machine allocation recommendations.

        Reads machine availability, detects downtime and overloaded machines,
        and recommends the best machine assignment.

        Optional query JSON:
        {"order": "O7", "required_capacity": 40, "machine_type": "CNC"}
        """
        logger.info("AgentIQ machine allocation invoked with query=%r", query)
        try:
            payload = _parse_machine_query(query)
            result = allocate_machine(
                order_id=payload.get("order") or payload.get("order_id"),
                required_capacity=payload.get("required_capacity", 0.0),
                machine_type=payload.get("machine_type"),
                location=payload.get("location"),
                machines_file=payload.get("machines_file", config.machines_file),
                config=allocation_config,
            )
            return json.dumps(result, indent=2, default=str)
        except Exception:
            logger.exception("Unhandled failure while allocating machine")
            return json.dumps(
                {
                    "status": "error",
                    "agent": "machine_agent",
                    "allocation": None,
                    "recommendations": [],
                    "machine_alerts": [],
                    "errors": ["Internal error while allocating machine"],
                },
                indent=2,
            )

    yield FunctionInfo.from_fn(
        _allocate_machine,
        description=_allocate_machine.__doc__,
    )
