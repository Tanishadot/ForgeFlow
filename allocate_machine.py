#!/usr/bin/env python3
"""Standalone entry point for the Machine Agent."""

import argparse
import json
import logging
import sys

from agents.machine_agent.machine_allocator import (
    MachineAllocationConfig,
    allocate_machine,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Recommend a machine assignment.")
    parser.add_argument("--machines-file", default="machines.csv", help="Machine CSV path.")
    parser.add_argument("--order-id", default=None, help="Order id to allocate.")
    parser.add_argument(
        "--required-capacity",
        type=float,
        default=0.0,
        help="Capacity required by the order.",
    )
    parser.add_argument("--machine-type", default=None, help="Required machine type.")
    parser.add_argument("--location", default=None, help="Required location.")
    parser.add_argument(
        "--overload-threshold",
        type=float,
        default=0.85,
        help="Utilization threshold for overload detection.",
    )
    parser.add_argument(
        "--minimum-efficiency",
        type=float,
        default=0.0,
        help="Minimum assignable machine efficiency from 0.0 to 1.0.",
    )
    args = parser.parse_args()

    logger.info("Running machine allocation")
    result = allocate_machine(
        order_id=args.order_id,
        required_capacity=args.required_capacity,
        machine_type=args.machine_type,
        location=args.location,
        machines_file=args.machines_file,
        config=MachineAllocationConfig(
            overload_threshold=args.overload_threshold,
            minimum_efficiency=args.minimum_efficiency,
        ),
    )
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
