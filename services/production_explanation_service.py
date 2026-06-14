"""Production schedule explanations powered by NVIDIA NIM."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_NIM_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct"


class ProductionExplanationService:
    """Creates natural language summaries for production schedules."""

    @classmethod
    async def explain_schedule(
        cls,
        schedule: list[dict[str, Any]],
        context: dict[str, Any] | None = None,
        use_nim: bool = True,
    ) -> dict[str, Any]:
        if not schedule:
            return {
                "status": "error",
                "provider": "local",
                "summaries": [],
                "errors": ["Schedule is empty"],
            }

        if use_nim and cls._nim_is_configured():
            try:
                summaries = await cls._explain_with_nim(schedule=schedule, context=context or {})
                return {
                    "status": "success",
                    "provider": "nim",
                    "summaries": summaries,
                    "errors": [],
                }
            except Exception as exc:
                logger.exception("NVIDIA NIM explanation failed; using local fallback")
                fallback = cls._local_explanations(schedule=schedule, context=context or {})
                return {
                    "status": "fallback",
                    "provider": "local",
                    "summaries": fallback,
                    "errors": [f"NVIDIA NIM explanation failed: {exc}"],
                }

        return {
            "status": "fallback",
            "provider": "local",
            "summaries": cls._local_explanations(schedule=schedule, context=context or {}),
            "errors": [] if not use_nim else ["NVIDIA NIM is not configured"],
        }

    @staticmethod
    def _nim_is_configured() -> bool:
        return bool(os.getenv("NVIDIA_API_KEY"))

    @classmethod
    async def _explain_with_nim(
        cls,
        schedule: list[dict[str, Any]],
        context: dict[str, Any],
    ) -> list[str]:
        api_key = os.environ["NVIDIA_API_KEY"]
        base_url = os.getenv("NVIDIA_NIM_BASE_URL", DEFAULT_NIM_BASE_URL).rstrip("/")
        model = os.getenv("NVIDIA_NIM_MODEL", DEFAULT_NIM_MODEL)
        timeout_seconds = float(os.getenv("NVIDIA_NIM_TIMEOUT_SECONDS", "30"))

        prompt = cls._build_prompt(schedule=schedule, context=context)
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a production planning explanation agent. "
                        "Explain schedule decisions plainly and concisely. "
                        "Return only valid JSON with a top-level 'summaries' array of strings."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 1200,
        }

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        parsed = cls._parse_nim_json(content)
        summaries = parsed.get("summaries", [])
        if not isinstance(summaries, list) or not all(isinstance(item, str) for item in summaries):
            raise ValueError("NIM response did not contain a valid summaries array")
        return summaries

    @staticmethod
    def _build_prompt(schedule: list[dict[str, Any]], context: dict[str, Any]) -> str:
        return (
            "Explain this production schedule. Cover why orders were prioritized, "
            "any delays or blocked orders, and why machines were assigned. "
            "Use one concise summary per order.\n\n"
            f"Schedule JSON:\n{json.dumps(schedule, indent=2, default=str)}\n\n"
            f"Optional context:\n{json.dumps(context, indent=2, default=str)}"
        )

    @staticmethod
    def _parse_nim_json(content: str) -> dict[str, Any]:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            return json.loads(content[start : end + 1])

    @classmethod
    def _local_explanations(
        cls,
        schedule: list[dict[str, Any]],
        context: dict[str, Any],
    ) -> list[str]:
        priority_context = cls._priority_context(context)
        summaries: list[str] = []

        for position, item in enumerate(schedule, start=1):
            order = item.get("order", f"order-{position}")
            machine = item.get("machine")
            start = item.get("start")
            end = item.get("end")
            status = item.get("status", "scheduled")
            reason = item.get("reason")

            priority_text = priority_context.get(
                str(order),
                f"Order {order} appears in schedule position {position}, so it was treated as a higher-priority job than later entries.",
            )

            if status == "blocked":
                delay_text = f"It is blocked because {reason or 'a required planning constraint was not satisfied'}."
                machine_text = "No machine was assigned because the order cannot be released yet."
            elif item.get("delay") or status == "delayed":
                delay_text = f"It is delayed because {reason or 'its planned completion misses a scheduling constraint'}."
                machine_text = (
                    f"It was assigned to machine {machine} from {start} to {end} "
                    "based on available capacity and machine fit."
                )
            else:
                delay_text = "No delay was detected for this order."
                machine_text = (
                    f"It was assigned to machine {machine} from {start} to {end} "
                    "because that machine was available for the required production window."
                    if machine
                    else "No machine assignment was present in the schedule."
                )

            summaries.append(f"{priority_text} {delay_text} {machine_text}")

        return summaries

    @staticmethod
    def _priority_context(context: dict[str, Any]) -> dict[str, str]:
        prioritized_orders = context.get("prioritized_orders") or context.get("orders") or []
        if isinstance(prioritized_orders, dict):
            prioritized_orders = prioritized_orders.get("orders", [])

        explanations: dict[str, str] = {}
        if not isinstance(prioritized_orders, list):
            return explanations

        for index, order in enumerate(prioritized_orders, start=1):
            if not isinstance(order, dict):
                continue
            order_id = order.get("order") or order.get("order_id")
            if not order_id:
                continue
            factors = order.get("priority_factors", {})
            score = order.get("priority_score")
            rank = order.get("queue_rank", index)
            factor_text = ""
            if isinstance(factors, dict):
                normalized = factors.get("normalized_scores", {})
                if isinstance(normalized, dict):
                    factor_text = (
                        f" due-date score {normalized.get('due_date')},"
                        f" quantity score {normalized.get('quantity')},"
                        f" urgency score {normalized.get('urgency_score')}."
                    )
            explanations[str(order_id)] = (
                f"Order {order_id} was prioritized at queue rank {rank}"
                f" with priority score {score}.{factor_text}"
            )
        return explanations
