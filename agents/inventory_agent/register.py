"""AgentIQ registration for the Inventory Agent."""

import json
import logging
from typing import Any

from pydantic import Field

from aiq.builder.builder import Builder
from aiq.builder.function import FunctionInfo
from aiq.cli.register_workflow import register_function
from aiq.data_models.function import FunctionBaseConfig

from .inventory_checker import DEFAULT_INVENTORY_FILE, verify_inventory

logger = logging.getLogger(__name__)


def _parse_inventory_query(query: str) -> dict[str, Any]:
    if not query or not query.strip():
        return {}

    try:
        payload = json.loads(query)
    except json.JSONDecodeError:
        logger.info("Inventory query is not JSON; running configured default check")
        return {}

    if not isinstance(payload, dict):
        logger.warning("Inventory query JSON must be an object; got %s", type(payload).__name__)
        return {}

    return payload


class InventoryAgentConfig(FunctionBaseConfig, name="inventory_agent"):
    """AgentIQ function configuration for inventory availability checks."""

    inventory_file: str = Field(
        default=DEFAULT_INVENTORY_FILE,
        description="Fallback CSV file to read when DataService has no inventory data.",
    )
    orders_file: str | None = Field(
        default=None,
        description="Optional CSV file containing order material requirements.",
    )


@register_function(config_type=InventoryAgentConfig)
async def inventory_agent(
    config: InventoryAgentConfig,
    _builder: Builder,
):
    """Register the inventory availability tool with AgentIQ."""
    logger.info("Initializing Inventory Agent with inventory_file=%s", config.inventory_file)

    async def _verify_inventory(query: str = "") -> str:
        """Return JSON inventory alerts.

        Reads inventory.csv or uploaded inventory data, verifies material
        availability for order requirements, detects shortages, and generates
        alerts such as {"order": "O3", "status": "blocked",
        "reason": "insufficient steel"}.

        Optional query JSON:
        {"order": "O3", "material": "steel", "required_quantity": 12}
        """
        logger.info("AgentIQ inventory check invoked with query=%r", query)
        try:
            payload = _parse_inventory_query(query)
            result = verify_inventory(
                order_id=payload.get("order") or payload.get("order_id"),
                material=payload.get("material"),
                required_quantity=payload.get("required_quantity"),
                inventory_file=payload.get("inventory_file", config.inventory_file),
                orders_file=payload.get("orders_file", config.orders_file),
            )
            return json.dumps(result, indent=2, default=str)
        except Exception:
            logger.exception("Unhandled failure while checking inventory")
            return json.dumps(
                {
                    "status": "error",
                    "agent": "inventory_agent",
                    "alerts": [],
                    "errors": ["Internal error while checking inventory"],
                },
                indent=2,
            )

    yield FunctionInfo.from_fn(
        _verify_inventory,
        description=_verify_inventory.__doc__,
    )
