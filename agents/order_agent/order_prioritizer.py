"""Order prioritization logic for the NVIDIA AgentIQ Order Agent."""

from __future__ import annotations

import logging
import math
from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Any

from services.data_service import DataService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PriorityWeights:
    """Weights used to compute the final order priority score."""

    due_date: float = 0.4
    quantity: float = 0.3
    urgency_score: float = 0.3

    def normalized(self) -> "PriorityWeights":
        total = self.due_date + self.quantity + self.urgency_score
        if total <= 0:
            logger.warning("Invalid zero priority weights supplied; using defaults")
            return DEFAULT_WEIGHTS
        return PriorityWeights(
            due_date=self.due_date / total,
            quantity=self.quantity / total,
            urgency_score=self.urgency_score / total,
        )


DEFAULT_WEIGHTS = PriorityWeights()


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return str(value).strip().lower() in {"", "nan", "none", "null"}


def _safe_parse_date(value: Any) -> date | None:
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
        except (ValueError, TypeError):
            continue
    logger.warning("Unable to parse due date value: %s", value)
    return None


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if _is_missing(value):
            return default
        parsed = float(value)
    except (ValueError, TypeError):
        return default
    if math.isnan(parsed) or math.isinf(parsed):
        return default
    return parsed


def _due_date_score(due_date: date | None) -> float:
    if due_date is None:
        return 0.0
    days_until_due = (due_date - date.today()).days
    if days_until_due < 0:
        return 1.0
    if days_until_due > 365:
        return 0.0
    return max(0.0, 1.0 - days_until_due / 365.0)


def _quantity_score(quantity: Any, max_quantity: float) -> float:
    value = _safe_float(quantity)
    if value <= 0 or max_quantity <= 0:
        return 0.0
    return min(1.0, value / max_quantity)


def _urgency_score(urgency: Any) -> float:
    value = _safe_float(urgency)
    return max(0.0, min(1.0, value / 10.0))


def _compute_score(
    row: dict[str, Any],
    weights: PriorityWeights,
    max_quantity: float,
) -> tuple[float, dict[str, Any]]:
    due = _safe_parse_date(row.get("due_date") or row.get("order_date"))
    due_score = _due_date_score(due)
    quantity_score = _quantity_score(row.get("quantity"), max_quantity)
    urgency_score = _urgency_score(row.get("urgency_score"))

    priority_score = (
        weights.due_date * due_score
        + weights.quantity * quantity_score
        + weights.urgency_score * urgency_score
    )
    factors = {
        "due_date": due.isoformat() if due else None,
        "quantity": _safe_float(row.get("quantity")),
        "urgency_score": _safe_float(row.get("urgency_score")),
        "normalized_scores": {
            "due_date": round(due_score, 4),
            "quantity": round(quantity_score, 4),
            "urgency_score": round(urgency_score, 4),
        },
        "weights": asdict(weights),
    }
    return round(priority_score, 4), factors


def prioritize_orders(
    weights: PriorityWeights | None = None,
    limit: int = 0,
) -> dict[str, Any]:
    """Read stored orders, rank them, and return a JSON-serializable queue."""
    normalized_weights = (weights or DEFAULT_WEIGHTS).normalized()
    response: dict[str, Any] = {
        "status": "success",
        "agent": "order_prioritizer",
        "total_orders": 0,
        "returned_orders": 0,
        "priority_model": {
            "rank_order": "highest priority_score first",
            "factors": ["due_date", "quantity", "urgency_score"],
            "weights": asdict(normalized_weights),
        },
        "orders": [],
        "errors": [],
    }

    logger.info("Reading orders from data store")
    try:
        orders_df = DataService.get_data("orders")
    except Exception as exc:
        logger.exception("Failed to read orders data")
        response["status"] = "error"
        response["errors"].append(f"Failed to read orders data: {exc}")
        return response

    if orders_df.empty:
        logger.warning("No orders found in data store")
        response["status"] = "empty"
        return response

    try:
        records = orders_df.to_dict(orient="records")
        response["total_orders"] = len(records)
    except Exception as exc:
        logger.exception("Failed to convert orders DataFrame to records")
        response["status"] = "error"
        response["errors"].append(f"Failed to convert orders data: {exc}")
        return response

    logger.info("Computing priority scores for %d orders", len(records))
    max_quantity = max((_safe_float(row.get("quantity")) for row in records), default=0.0)
    scored_orders: list[dict[str, Any]] = []

    for index, row in enumerate(records):
        try:
            score, factors = _compute_score(row, normalized_weights, max_quantity)
            prioritized_order = dict(row)
            prioritized_order["queue_rank"] = 0
            prioritized_order["priority_score"] = score
            prioritized_order["priority_factors"] = factors
            scored_orders.append(prioritized_order)
        except Exception as exc:
            order_id = row.get("order_id", f"row-{index}")
            logger.exception("Error scoring order %s", order_id)
            response["errors"].append(f"Skipped order {order_id}: {exc}")

    scored_orders.sort(
        key=lambda row: (
            row["priority_score"],
            _urgency_score(row.get("urgency_score")),
            _due_date_score(_safe_parse_date(row.get("due_date") or row.get("order_date"))),
            _safe_float(row.get("quantity")),
        ),
        reverse=True,
    )

    for rank, row in enumerate(scored_orders, start=1):
        row["queue_rank"] = rank

    if limit > 0:
        scored_orders = scored_orders[:limit]

    response["returned_orders"] = len(scored_orders)
    response["orders"] = scored_orders
    logger.info("Returning %d prioritized orders", len(scored_orders))
    return response


class OrderPrioritizerAgent:
    """Small async wrapper used by AgentIQ or application code."""

    def __init__(self, weights: PriorityWeights | None = None):
        self._weights = weights or DEFAULT_WEIGHTS

    async def run(self, limit: int = 0, **kwargs: Any) -> dict[str, Any]:
        return prioritize_orders(weights=self._weights, limit=limit)
