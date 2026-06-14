#!/usr/bin/env python3
"""Standalone entry point for the Scheduler Agent."""

import argparse
import json
import logging
import sys

from agents.scheduler_agent.production_scheduler import create_production_schedule

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a production schedule.")
    parser.add_argument("--orders-file", default="orders.csv", help="Orders CSV path.")
    parser.add_argument("--inventory-file", default="inventory.csv", help="Inventory CSV path.")
    parser.add_argument("--machines-file", default="machines.csv", help="Machines CSV path.")
    parser.add_argument("--schedule-date", default=None, help="Schedule date in YYYY-MM-DD.")
    parser.add_argument("--workday-start", default="09:00", help="Workday start in HH:MM.")
    parser.add_argument("--workday-end", default="17:00", help="Workday end in HH:MM.")
    parser.add_argument(
        "--default-duration-minutes",
        type=int,
        default=60,
        help="Fallback duration when an order has no duration or quantity.",
    )
    parser.add_argument(
        "--setup-minutes",
        type=int,
        default=0,
        help="Setup minutes added to every scheduled order.",
    )
    args = parser.parse_args()

    logger.info("Creating production schedule")
    result = create_production_schedule(
        schedule_date=args.schedule_date,
        workday_start=args.workday_start,
        workday_end=args.workday_end,
        default_duration_minutes=args.default_duration_minutes,
        setup_minutes=args.setup_minutes,
        orders_file=args.orders_file,
        inventory_file=args.inventory_file,
        machines_file=args.machines_file,
    )
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
