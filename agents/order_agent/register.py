"""AgentIQ registration for the Order Prioritizer function."""

import json
import logging

from pydantic import Field

from aiq.builder.builder import Builder
from aiq.builder.function import FunctionInfo
from aiq.cli.register_workflow import register_function
from aiq.data_models.function import FunctionBaseConfig

from .order_prioritizer import PriorityWeights, prioritize_orders

logger = logging.getLogger(__name__)


class OrderPrioritizerConfig(FunctionBaseConfig, name="order_prioritizer"):
    """AgentIQ function configuration for order prioritization."""

    priority_weight_due_date: float = Field(
        default=0.4,
        ge=0.0,
        le=1.0,
        description="Weight assigned to due date. Closer or overdue orders rank higher.",
    )
    priority_weight_quantity: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Weight assigned to order quantity. Larger quantities rank higher.",
    )
    priority_weight_urgency: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Weight assigned to urgency_score on a 0-10 scale.",
    )
    result_limit: int = Field(
        default=0,
        ge=0,
        description="Maximum number of orders to return. Use 0 for all orders.",
    )


@register_function(config_type=OrderPrioritizerConfig)
async def order_prioritizer(
    config: OrderPrioritizerConfig,
    _builder: Builder,
):
    """Register the prioritize_orders tool with AgentIQ."""
    weights = PriorityWeights(
        due_date=config.priority_weight_due_date,
        quantity=config.priority_weight_quantity,
        urgency_score=config.priority_weight_urgency,
    )
    logger.info(
        "Initializing Order Prioritizer with weights due=%.2f quantity=%.2f urgency=%.2f",
        weights.due_date,
        weights.quantity,
        weights.urgency_score,
    )

    async def _prioritize(query: str = "") -> str:
        """Return a JSON prioritized order queue.

        Reads stored orders and ranks them by due_date, quantity, and
        urgency_score. Each order includes queue_rank, priority_score, and
        priority_factors.
        """
        logger.info("AgentIQ prioritize_orders invoked with query=%r", query)
        try:
            result = prioritize_orders(weights=weights, limit=config.result_limit)
            return json.dumps(result, indent=2, default=str)
        except Exception:
            logger.exception("Unhandled failure while prioritizing orders")
            return json.dumps(
                {
                    "status": "error",
                    "agent": "order_prioritizer",
                    "orders": [],
                    "errors": ["Internal error while prioritizing orders"],
                },
                indent=2,
            )

    yield FunctionInfo.from_fn(
        _prioritize,
        description=_prioritize.__doc__,
    )
