#!/usr/bin/env python3
"""Standalone entry point for the Inventory Agent."""

import argparse
import json
import logging
import sys

from agents.inventory_agent.inventory_checker import verify_inventory

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify inventory material availability.")
    parser.add_argument("--inventory-file", default="inventory.csv", help="Inventory CSV path.")
    parser.add_argument("--orders-file", default=None, help="Optional order requirements CSV path.")
    parser.add_argument("--order-id", default=None, help="Single order id to check.")
    parser.add_argument("--material", default=None, help="Single material to check.")
    parser.add_argument(
        "--required-quantity",
        type=float,
        default=None,
        help="Required quantity for the single material check.",
    )
    args = parser.parse_args()

    logger.info("Running inventory verification")
    result = verify_inventory(
        order_id=args.order_id,
        material=args.material,
        required_quantity=args.required_quantity,
        inventory_file=args.inventory_file,
        orders_file=args.orders_file,
    )
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
