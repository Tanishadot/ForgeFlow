"""AgentIQ registration for the What-If Simulation Agent."""

import json
import logging
from typing import Any

from pydantic import Field

from aiq.builder.builder import Builder
from aiq.builder.function import FunctionInfo
from aiq.cli.register_workflow import register_function
from aiq.data_models.function import FunctionBaseConfig

from services.what_if_simulation_service import WhatIfSimulationService

logger = logging.getLogger(__name__)


class WhatIfAgentConfig(FunctionBaseConfig, name="what_if_agent"):
    """Configuration for the what-if simulation agent."""

    # Future options could include simulation fidelity, time limits, etc.
    pass


@register_function(config_type=WhatIfAgentConfig)
async def what_if_agent(config: WhatIfAgentConfig, _builder: Builder):
    """Register a what-if simulation function for AgentIQ.

    The function accepts a JSON string which may be either:
    - A schedule array
    - An object: {"schedule": [...], "machines": [...], "inventory": [...], "scenario": {...}}
    """
    logger.info("Initializing What-If Simulation Agent")

    def _parse_query(q: str) -> dict[str, Any]:
        if not q or not q.strip():
            return {}
        try:
            payload = json.loads(q)
        except json.JSONDecodeError:
            logger.warning("What-if query must be valid JSON")
            return {}
        if isinstance(payload, list):
            return {"schedule": payload}
        if isinstance(payload, dict):
            return payload
        return {}

    async def _simulate(query: str = "") -> str:
        payload = _parse_query(query)
        schedule = payload.get("schedule", [])
        machines = payload.get("machines")
        inventory = payload.get("inventory")
        scenario = payload.get("scenario", {})
        result = WhatIfSimulationService.simulate(schedule=schedule, machines=machines, inventory=inventory, scenario=scenario)
        return json.dumps(result, indent=2, default=str)

    yield FunctionInfo.from_fn(_simulate, description=_simulate.__doc__)
