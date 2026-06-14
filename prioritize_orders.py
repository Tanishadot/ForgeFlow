#!/usr/bin/env python3
"""Standalone entry point for the Order Prioritization Agent.

Reads orders from the in-memory data store, computes priority scores,
and prints the prioritized queue as JSON.

Usage:
    python prioritize_orders.py                 # all orders
    python prioritize_orders.py --limit 10      # top 10 only
    python prioritize_orders.py --due-weight 0.5 --qty-weight 0.25 --urg-weight 0.25
"""

import argparse
import json
import logging
import sys

from agents.order_agent.order_prioritizer import PriorityWeights, prioritize_orders

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prioritize orders from the data store.")
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Maximum number of orders to return (0 = unlimited).",
    )
    parser.add_argument("--due-weight", type=float, default=0.4, help="Due-date weight (0-1).")
    parser.add_argument("--qty-weight", type=float, default=0.3, help="Quantity weight (0-1).")
    parser.add_argument("--urg-weight", type=float, default=0.3, help="Urgency-score weight (0-1).")
    args = parser.parse_args()

    weights = PriorityWeights(
        due_date=args.due_weight,
        quantity=args.qty_weight,
        urgency_score=args.urg_weight,
    )

    logger.info(
        "Running prioritization with weights: due=%.2f qty=%.2f urg=%.2f limit=%d",
        weights.due_date,
        weights.quantity,
        weights.urgency_score,
        args.limit,
    )

    try:
        result = prioritize_orders(weights=weights, limit=args.limit)
    except Exception:
        logger.exception("Fatal error during prioritization")
        sys.exit(1)

    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
