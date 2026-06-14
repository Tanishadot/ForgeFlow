"""AgentIQ registration for the Production Explanation Agent."""

import json
import logging
from typing import Any

from pydantic import Field

from aiq.builder.builder import Builder
from aiq.builder.function import FunctionInfo
from aiq.cli.register_workflow import register_function
from aiq.data_models.function import FunctionBaseConfig

from services.production_explanation_service import ProductionExplanationService

logger = logging.getLogger(__name__)


def _parse_explanation_query(query: str) -> dict[str, Any]:
    if not query or not query.strip():
        return {}

    try:
        payload = json.loads(query)
    except json.JSONDecodeError:
        logger.warning("Explanation query must be JSON")
        return {}

    if isinstance(payload, list):
        return {"schedule": payload}
    if isinstance(payload, dict):
        return payload

    logger.warning("Explanation query JSON must be an object or schedule array")
    return {}


class ExplanationAgentConfig(FunctionBaseConfig, name="explanation_agent"):
    """AgentIQ function configuration for production explanations."""

    use_nim: bool = Field(
        default=True,
        description="Use NVIDIA NIM when NVIDIA_API_KEY is configured.",
    )


@register_function(config_type=ExplanationAgentConfig)
async def explanation_agent(
    config: ExplanationAgentConfig,
    _builder: Builder,
):
    """Register the production explanation tool with AgentIQ."""
    logger.info("Initializing Production Explanation Agent")

    async def _explain(query: str = "") -> str:
        """Return natural language explanations for production schedule JSON.

        Query JSON may be either a schedule array or:
        {"schedule": [...], "context": {...}, "use_nim": true}
        """
        logger.info("AgentIQ explanation invoked")
        payload = _parse_explanation_query(query)
        schedule = payload.get("schedule", [])
        context = payload.get("context")
        use_nim = payload.get("use_nim", config.use_nim)
        result = await ProductionExplanationService.explain_schedule(
            schedule=schedule,
            context=context,
            use_nim=use_nim,
        )
        return json.dumps(result, indent=2, default=str)

    yield FunctionInfo.from_fn(
        _explain,
        description=_explain.__doc__,
    )
