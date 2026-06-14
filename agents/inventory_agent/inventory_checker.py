"""Inventory availability checks for the NVIDIA AgentIQ Inventory Agent."""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Any

import pandas as pd

from services.data_service import DataService

logger = logging.getLogger(__name__)

DEFAULT_INVENTORY_FILE = "inventory.csv"

MATERIAL_COLUMNS = (
    "material",
    "material_name",
    "product_name",
    "sku",
    "product_id",
    "inventory_id",
)
AVAILABLE_COLUMNS = ("quantity_on_hand", "available_quantity", "stock", "quantity")
REORDER_COLUMNS = ("reorder_level", "minimum_quantity", "safety_stock")
ORDER_COLUMNS = ("order_id", "order", "id")
REQUIRED_MATERIAL_COLUMNS = ("material", "material_name", "product_name", "sku", "product_id")
REQUIRED_QUANTITY_COLUMNS = ("required_quantity", "material_quantity", "quantity")


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


def _normalize_key(value: Any) -> str:
    return str(value).strip().lower()


def _records_from_data_service(data_type: str) -> list[dict[str, Any]]:
    data = DataService.get_data(data_type)
    if data.empty:
        return []
    return data.to_dict(orient="records")


def _records_from_csv(file_path: str) -> list[dict[str, Any]]:
    path = Path(file_path)
    if not path.exists():
        logger.warning("%s was not found", file_path)
        return []
    logger.info("Reading inventory data from %s", path)
    return pd.read_csv(path).to_dict(orient="records")


def _load_inventory(inventory_file: str | None = DEFAULT_INVENTORY_FILE) -> list[dict[str, Any]]:
    records = _records_from_data_service("inventory")
    if records:
        logger.info("Loaded %d inventory records from DataService", len(records))
        return records
    if inventory_file:
        return _records_from_csv(inventory_file)
    return []


def _load_orders(orders_file: str | None = None) -> list[dict[str, Any]]:
    records = _records_from_data_service("orders")
    if records:
        logger.info("Loaded %d order records from DataService", len(records))
        return records
    if orders_file and Path(orders_file).exists():
        logger.info("Reading order requirements from %s", orders_file)
        return pd.read_csv(orders_file).to_dict(orient="records")
    return []


def _inventory_index(inventory_records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for row in inventory_records:
        material = _first_present(row, MATERIAL_COLUMNS)
        if _is_missing(material):
            logger.warning("Skipping inventory row without material identifier: %s", row)
            continue

        available = _safe_float(_first_present(row, AVAILABLE_COLUMNS))
        reorder_level = _safe_float(_first_present(row, REORDER_COLUMNS))
        key = _normalize_key(material)

        if key not in index:
            index[key] = {
                "material": str(material),
                "available_quantity": 0.0,
                "reorder_level": reorder_level,
                "source_rows": [],
            }

        index[key]["available_quantity"] += available
        index[key]["reorder_level"] = max(index[key]["reorder_level"], reorder_level)
        index[key]["source_rows"].append(row)

    return index


def _order_requirements(order_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    for index, row in enumerate(order_records):
        order_id = _first_present(row, ORDER_COLUMNS) or f"row-{index}"
        material = _first_present(row, REQUIRED_MATERIAL_COLUMNS)
        required_quantity = _safe_float(_first_present(row, REQUIRED_QUANTITY_COLUMNS))
        if _is_missing(material) or required_quantity <= 0:
            logger.info("Skipping order %s because material or required quantity is missing", order_id)
            continue
        requirements.append(
            {
                "order": str(order_id),
                "material": str(material),
                "required_quantity": required_quantity,
            }
        )
    return requirements


def _status_for_requirement(
    requirement: dict[str, Any],
    inventory_by_material: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    material = requirement["material"]
    required_quantity = requirement["required_quantity"]
    inventory_item = inventory_by_material.get(_normalize_key(material))

    if inventory_item is None:
        return {
            "order": requirement["order"],
            "status": "blocked",
            "reason": f"insufficient {material}",
            "material": material,
            "required_quantity": required_quantity,
            "available_quantity": 0.0,
            "shortage_quantity": required_quantity,
        }

    available_quantity = inventory_item["available_quantity"]
    shortage_quantity = max(0.0, required_quantity - available_quantity)
    if shortage_quantity > 0:
        return {
            "order": requirement["order"],
            "status": "blocked",
            "reason": f"insufficient {material}",
            "material": material,
            "required_quantity": required_quantity,
            "available_quantity": available_quantity,
            "shortage_quantity": shortage_quantity,
        }

    return {
        "order": requirement["order"],
        "status": "available",
        "reason": "materials available",
        "material": material,
        "required_quantity": required_quantity,
        "available_quantity": available_quantity,
        "shortage_quantity": 0.0,
    }


def _stock_alerts(inventory_by_material: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    for item in inventory_by_material.values():
        available_quantity = item["available_quantity"]
        reorder_level = item["reorder_level"]
        if reorder_level > 0 and available_quantity <= reorder_level:
            alerts.append(
                {
                    "material": item["material"],
                    "status": "alert",
                    "reason": "below reorder level",
                    "available_quantity": available_quantity,
                    "reorder_level": reorder_level,
                }
            )
    return alerts


def verify_inventory(
    order_id: str | None = None,
    material: str | None = None,
    required_quantity: float | None = None,
    inventory_file: str | None = DEFAULT_INVENTORY_FILE,
    orders_file: str | None = None,
) -> dict[str, Any]:
    """Read inventory, verify availability, detect shortages, and return alerts."""
    response: dict[str, Any] = {
        "status": "success",
        "agent": "inventory_agent",
        "alerts": [],
        "summary": {
            "inventory_items": 0,
            "requirements_checked": 0,
            "blocked_orders": 0,
        },
        "errors": [],
    }

    try:
        inventory_records = _load_inventory(inventory_file)
        if not inventory_records:
            response["status"] = "error"
            response["errors"].append("No inventory data found")
            return response

        inventory_by_material = _inventory_index(inventory_records)
        response["summary"]["inventory_items"] = len(inventory_by_material)

        if material and required_quantity is not None:
            requirements = [
                {
                    "order": order_id or "ad-hoc",
                    "material": material,
                    "required_quantity": _safe_float(required_quantity),
                }
            ]
        else:
            requirements = _order_requirements(_load_orders(orders_file))

        availability_alerts = [
            _status_for_requirement(requirement, inventory_by_material)
            for requirement in requirements
        ]
        reorder_alerts = _stock_alerts(inventory_by_material)
        alerts = availability_alerts + reorder_alerts

        response["alerts"] = alerts
        response["summary"]["requirements_checked"] = len(requirements)
        response["summary"]["blocked_orders"] = sum(
            1 for alert in availability_alerts if alert["status"] == "blocked"
        )
        if any(alert["status"] == "blocked" for alert in availability_alerts):
            response["status"] = "blocked"
        elif reorder_alerts:
            response["status"] = "alert"

        logger.info(
            "Inventory verification completed: %d requirements checked, %d alerts generated",
            len(requirements),
            len(alerts),
        )
        return response
    except Exception as exc:
        logger.exception("Failed to verify inventory availability")
        response["status"] = "error"
        response["errors"].append(f"Failed to verify inventory availability: {exc}")
        return response


class InventoryAgent:
    """Small async wrapper used by AgentIQ or application code."""

    async def run(self, **kwargs: Any) -> dict[str, Any]:
        return verify_inventory(**kwargs)
