"""Production schedule explanations powered by NVIDIA NIM."""
from __future__ import annotations

import json
import logging
from typing import Any

from nim_client import nim_client

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a production planning analyst for a manufacturing factory. "
    "Your job is to explain WHY scheduling decisions were made — not just what the schedule says. "
    "Focus on: priority reasoning, inventory bottlenecks, machine constraints, rerouting decisions, and delays. "
    "Return ONLY valid JSON with exactly two top-level keys: "
    "'summaries' (array of strings, one per schedule item in order) and "
    "'recommendations' (array of 2-4 actionable strings for the factory scheduler)."
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
                "recommendations": [],
                "errors": ["Schedule is empty"],
            }

        ctx = context or {}

        if use_nim and nim_client.is_configured:
            try:
                result = await cls._explain_with_nim(schedule=schedule, context=ctx)
                return {
                    "status": "success",
                    "provider": "nim",
                    "summaries": result["summaries"],
                    "recommendations": result.get("recommendations", []),
                    "errors": [],
                }
            except Exception as exc:
                logger.exception("NVIDIA NIM explanation failed; using local fallback")
                local = cls._local_explanations(schedule=schedule, context=ctx)
                return {
                    "status": "fallback",
                    "provider": "local",
                    "summaries": local["summaries"],
                    "recommendations": local["recommendations"],
                    "errors": [f"NIM failed: {exc}"],
                }

        local = cls._local_explanations(schedule=schedule, context=ctx)
        return {
            "status": "fallback",
            "provider": "local",
            "summaries": local["summaries"],
            "recommendations": local["recommendations"],
            "errors": [] if not use_nim else ["NVIDIA_API_KEY not configured"],
        }

    @classmethod
    async def _explain_with_nim(
        cls,
        schedule: list[dict[str, Any]],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        from settings import settings

        # Build a rich context block for NIM
        ctx_parts: list[str] = []

        orders = context.get("orders", [])
        if orders:
            # Build a priority map: order_id → {score, rank}
            priority_map = {
                str(o.get("order_id") or o.get("order", "")): {
                    "score": o.get("priority_score"),
                    "rank":  o.get("queue_rank"),
                    "due":   o.get("due_date"),
                    "urgency": o.get("urgency_score"),
                }
                for o in orders if isinstance(o, dict)
            }
            ctx_parts.append(f"Priority scores (from OrderPrioritizerAgent):\n{json.dumps(priority_map, default=str)}")

        machines = context.get("machines", [])
        if machines:
            machine_summary = [
                {"id": m.get("machine_id"), "type": m.get("machine_type"),
                 "status": m.get("status"), "utilization_pct": m.get("utilization_pct")}
                for m in machines if isinstance(m, dict)
            ]
            ctx_parts.append(f"Machine status:\n{json.dumps(machine_summary, default=str)}")

        inventory = context.get("inventory", [])
        if inventory:
            low_stock = [
                {"material": i.get("material_name"), "on_hand": i.get("quantity_on_hand"),
                 "reorder_level": i.get("reorder_level")}
                for i in inventory if isinstance(i, dict)
                and (i.get("quantity_on_hand", 0) or 0) < (i.get("reorder_level", 0) or 0)
            ]
            ctx_parts.append(f"Low/critical inventory:\n{json.dumps(low_stock, default=str)}")

        summary = context.get("summary", {})
        if summary:
            ctx_parts.append(f"Schedule summary: {json.dumps(summary, default=str)}")

        ctx_block = "\n\n".join(ctx_parts) if ctx_parts else "No additional context provided."

        prompt = (
            "Analyze this production schedule and explain the decisions made.\n\n"
            "For each order in 'summaries', explain:\n"
            "- WHY it was prioritized at this rank (due date urgency, quantity, priority score)\n"
            "- Which machine was assigned and WHY (type match, availability, capacity)\n"
            "- If BLOCKED: what specific inventory material is missing and how to resolve it\n"
            "- If DELAYED: why it was pushed past the workday and what the downstream impact is\n"
            "- If REROUTED or unusual: explain the rerouting decision\n\n"
            "For 'recommendations', provide 2-4 specific, actionable steps the factory scheduler "
            "should take TODAY to improve this schedule (reorder materials, reschedule orders, "
            "perform machine maintenance, adjust priorities).\n\n"
            f"Schedule ({len(schedule)} items):\n{json.dumps(schedule, indent=2, default=str)}\n\n"
            f"Context:\n{ctx_block}\n\n"
            "Return ONLY JSON: {\"summaries\": [...], \"recommendations\": [...]}"
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
        recommendations = parsed.get("recommendations", [])

        if not isinstance(summaries, list) or not all(isinstance(s, str) for s in summaries):
            raise ValueError(f"NIM returned unexpected summaries shape: {type(summaries)}")

        return {
            "summaries": summaries,
            "recommendations": [r for r in recommendations if isinstance(r, str)],
        }

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
    ) -> dict[str, Any]:
        """Deterministic fallback when NIM is unavailable."""
        priority_ctx = cls._priority_context(context)
        inventory    = {
            str(i.get("material_name", "") or i.get("product_id", "")).lower(): i
            for i in context.get("inventory", [])
            if isinstance(i, dict)
        }
        machine_util = {
            str(m.get("machine_id", "")): m
            for m in context.get("machines", [])
            if isinstance(m, dict)
        }

        summaries: list[str] = []
        blocked_materials: set[str] = set()
        overloaded_machines: set[str] = set()

        for position, item in enumerate(schedule, start=1):
            order   = item.get("order", f"order-{position}")
            machine = item.get("machine")
            start   = item.get("start")
            end     = item.get("end")
            status  = item.get("status", "scheduled")
            reason  = item.get("reason", "")

            priority_text = priority_ctx.get(str(order), f"Order {order} at position {position}.")

            if status == "blocked":
                material_hint = ""
                if reason:
                    # Extract material name from "insufficient <material>" reason
                    mat = reason.replace("insufficient", "").strip()
                    if mat:
                        blocked_materials.add(mat)
                        material_hint = f" Reorder {mat} immediately."
                detail = f"BLOCKED — {reason or 'inventory requirement not met'}. No machine assigned.{material_hint}"

            elif item.get("delay") or status == "delayed":
                detail = (
                    f"DELAYED — {reason or 'scheduled past workday end'}. "
                    f"Assigned to {machine or 'unassigned'} ({start} → {end}). "
                    "Consider splitting this order or extending shift hours."
                )

            else:
                minfo = machine_util.get(str(machine), {}) if machine else {}
                util = minfo.get("utilization_pct")
                util_note = ""
                if util is not None and float(util) > 85:
                    overloaded_machines.add(str(machine))
                    util_note = f" Machine {machine} is at {util}% utilization — high load."
                detail = (
                    f"ON TIME. Assigned to {machine} ({start} → {end}).{util_note}"
                    if machine
                    else "Scheduled but no machine matched the required type."
                )

            summaries.append(f"{priority_text} {detail}")

        # Generate targeted recommendations from observed bottlenecks
        recommendations: list[str] = []
        for mat in list(blocked_materials)[:2]:
            recommendations.append(
                f"Trigger emergency reorder for '{mat}' — orders are blocked waiting on this material."
            )
        for m_id in list(overloaded_machines)[:2]:
            recommendations.append(
                f"Machine {m_id} is overloaded. Consider redistributing orders to idle machines "
                "or scheduling overtime."
            )
        delayed = [s for s in schedule if s.get("status") == "delayed" or s.get("delay")]
        if delayed:
            recommendations.append(
                f"{len(delayed)} order(s) are delayed past workday end. "
                "Review due dates and consider extending shift hours or splitting orders."
            )
        if not recommendations:
            recommendations.append(
                "Schedule is running smoothly. Monitor machine utilization and reorder levels "
                "to maintain on-time delivery."
            )

        return {"summaries": summaries, "recommendations": recommendations}

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
            score = order.get("priority_score")
            rank  = order.get("queue_rank", i)
            due   = order.get("due_date") or order.get("deadline")
            urgency = order.get("urgency_score")
            parts = [f"Order {oid} ranked #{rank}"]
            if score is not None:
                parts.append(f"(priority score {round(float(score), 3)})")
            if due:
                parts.append(f"due {due}")
            if urgency is not None:
                parts.append(f"urgency {urgency}/10")
            result[str(oid)] = " ".join(parts) + "."
        return result
