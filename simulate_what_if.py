#!/usr/bin/env python3
"""Standalone runner for the What-If Simulation Agent."""

import argparse
import asyncio
import json
import logging
import sys

from services.what_if_simulation_service import WhatIfSimulationService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", stream=sys.stderr)


def _read_json(path: str | None) -> object:
    if path:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    return json.load(sys.stdin)


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Run what-if simulation")
    parser.add_argument("--file", default=None, help="Path to JSON payload or schedule array; reads stdin if omitted")
    args = parser.parse_args()

    payload = _read_json(args.file)
    if isinstance(payload, list):
        schedule = payload
        machines = None
        inventory = None
        scenario = {}
    elif isinstance(payload, dict):
        schedule = payload.get("schedule", [])
        machines = payload.get("machines")
        inventory = payload.get("inventory")
        scenario = payload.get("scenario", {})
    else:
        raise ValueError("Input JSON must be a schedule array or an object with schedule/scenario")

    result = WhatIfSimulationService.simulate(schedule=schedule, machines=machines, inventory=inventory, scenario=scenario)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
