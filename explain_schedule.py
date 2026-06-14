#!/usr/bin/env python3
"""Standalone entry point for the Production Explanation Agent."""

import argparse
import asyncio
import json
import logging
import sys

from services.production_explanation_service import ProductionExplanationService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)


def _read_json(path: str | None) -> object:
    if path:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)
    return json.load(sys.stdin)


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Explain production schedule JSON.")
    parser.add_argument("--file", default=None, help="Path to schedule JSON. Reads stdin if omitted.")
    parser.add_argument("--no-nim", action="store_true", help="Disable NVIDIA NIM and use local fallback.")
    args = parser.parse_args()

    payload = _read_json(args.file)
    if isinstance(payload, list):
        schedule = payload
        context = None
    elif isinstance(payload, dict):
        schedule = payload.get("schedule", [])
        context = payload.get("context")
    else:
        raise ValueError("Input JSON must be a schedule array or an object with schedule")

    result = await ProductionExplanationService.explain_schedule(
        schedule=schedule,
        context=context,
        use_nim=not args.no_nim,
    )
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
