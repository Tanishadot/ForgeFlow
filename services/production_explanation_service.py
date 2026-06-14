"""Production schedule explanations powered by NVIDIA NIM."""
from __future__ import annotations

import json
import logging
from typing import Any

from nim_client import nim_client

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a production planning explanation agent for a manufacturing factory. "
    "Explain schedule decisions plainly and concisely for a factory scheduler. "
    "Return only valid JSON with a top-level 'summaries' array of strings, "
    "one string per order in the schedule."
)


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

        if use_nim and nim_client.is_configured:
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
                return {
                    "status": "fallback",
                    "provider": "local",
                    "summaries": cls._local_explanations(schedule=schedule, context=context or {}),
                    "errors": [f"NIM failed: {exc}"],
                }

        return {
            "status": "fallback",
            "provider": "local",
            "summaries": cls._local_explanations(schedule=schedule, context=context or {}),
            "errors": [] if not use_nim else ["NVIDIA_API_KEY not configured"],
        }

    @classmethod
    async def _explain_with_nim(
        cls,
        schedule: list[dict[str, Any]],
        context: dict[str, Any],
    ) -> list[str]:
        from settings import settings

        prompt = (
            "Explain this production schedule. For each order explain: why it was prioritised, "
            "any delays or blocks, and why that machine was assigned. One concise sentence per order.\n\n"
            f"Schedule JSON:\n{json.dumps(schedule, indent=2, default=str)}\n\n"
            f"Context:\n{json.dumps(context, indent=2, default=str)}"
        )

        content = await nim_client.chat(
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
            max_tokens=settings.nvidia_nim_max_tokens_explain,
        )

        parsed = cls._parse_json(content)
        summaries = parsed.get("summaries", [])
        if not isinstance(summaries, list) or not all(isinstance(s, str) for s in summaries):
            raise ValueError(f"NIM returned unexpected summaries shape: {type(summaries)}")
        return summaries

    @staticmethod
    def _parse_json(content: str) -> dict[str, Any]:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            return json.loads(content[start: end + 1])

    @classmethod
    def _local_explanations(
        cls,
        schedule: list[dict[str, Any]],
        context: dict[str, Any],
    ) -> list[str]:
        priority_ctx = cls._priority_context(context)
        summaries: list[str] = []

        for position, item in enumerate(schedule, start=1):
            order   = item.get("order", f"order-{position}")
            machine = item.get("machine")
            start   = item.get("start")
            end     = item.get("end")
            status  = item.get("status", "scheduled")
            reason  = item.get("reason")

            priority_text = priority_ctx.get(
                str(order),
                f"Order {order} is at schedule position {position}.",
            )

            if status == "blocked":
                detail = f"Blocked — {reason or 'planning constraint not met'}. No machine assigned."
            elif item.get("delay") or status == "delayed":
                detail = (
                    f"Delayed — {reason or 'scheduled past workday end'}. "
                    f"Assigned to {machine} ({start} → {end})."
                )
            else:
                detail = (
                    f"On time. Assigned to {machine} ({start} → {end})."
                    if machine else "No machine assigned."
                )

            summaries.append(f"{priority_text} {detail}")

        return summaries

    @staticmethod
    def _priority_context(context: dict[str, Any]) -> dict[str, str]:
        orders = context.get("prioritized_orders") or context.get("orders") or []
        if isinstance(orders, dict):
            orders = orders.get("orders", [])
        if not isinstance(orders, list):
            return {}

        result: dict[str, str] = {}
        for i, order in enumerate(orders, start=1):
            if not isinstance(order, dict):
                continue
            oid = order.get("order") or order.get("order_id")
            if not oid:
                continue
            score  = order.get("priority_score")
            rank   = order.get("queue_rank", i)
            result[str(oid)] = f"Order {oid} ranked #{rank} with priority score {score}."
        return result
