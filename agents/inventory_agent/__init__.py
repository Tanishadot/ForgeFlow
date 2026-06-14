"""Inventory Agent package exports."""

from .inventory_checker import InventoryAgent, verify_inventory

try:
    from .register import InventoryAgentConfig, inventory_agent
except ModuleNotFoundError:
    InventoryAgentConfig = None
    inventory_agent = None

__all__ = [
    "InventoryAgent",
    "verify_inventory",
    "InventoryAgentConfig",
    "inventory_agent",
]
