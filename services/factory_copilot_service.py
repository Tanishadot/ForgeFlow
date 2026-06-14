"""Factory Copilot: session-based chat grounded in the production schedule."""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from nim_client import nim_client

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are Factory Copilot, an AI assistant for manufacturing production planning. "
    "Answer questions about the production schedule provided. "
    "Ground every answer in the schedule data — do not hallucinate order IDs, machines, or times. "
    "Be concise and direct. Factory schedulers are busy; avoid filler sentences. "
    "Return plain text."
)


class FactoryCopilotService:
    """Session-based conversational copilot grounded in a production schedule."""

    _sessions: dict[str, list[dict[str, str]]] = {}

    # ── Public API ────────────────────────────────────────────────────────────

    @classmethod
    def get_history(cls, session_id: str) -> list[dict[str, str]]:
        return list(cls._sessions.get(session_id, []))

    @classmethod
    async def chat(
        cls,
        message: str,
        schedule: list[dict[str, Any]],
        session_id: str | None = None,
        use_nim: bool = True,
    ) -> dict[str, Any]:
        if not session_id:
            session_id = uuid.uuid4().hex

        cls._append(session_id, "user", message)

        if use_nim and nim_client.is_configured:
            try:
                reply = await cls._nim_reply(message, schedule, session_id)
                cls._append(session_id, "assistant", reply)
                return cls._ok(session_id, reply, "nim")
            except Exception as exc:
                logger.exception("NIM chat failed; using local fallback")
                reply = cls._local_answer(message, schedule)
                cls._append(session_id, "assistant", reply)
                return cls._ok(session_id, reply, "local", errors=[str(exc)])

        reply = cls._local_answer(message, schedule)
        cls._append(session_id, "assistant", reply)
        errors = [] if not use_nim else ["NVIDIA_API_KEY not configured"]
        return cls._ok(session_id, reply, "local", errors=errors)

    # ── Internal helpers ──────────────────────────────────────────────────────

    @classmethod
    def _append(cls, session_id: str, role: str, content: str) -> None:
        cls._sessions.setdefault(session_id, []).append({"role": role, "content": content})

    @staticmethod
    def _ok(
        session_id: str,
        reply: str,
        provider: str,
        errors: list[str] | None = None,
    ) -> dict[str, Any]:
        return {
            "session_id": session_id,
            "reply": reply,
            "response": reply,   # alias for forward-compatibility
            "provider": provider,
            "status": "success" if not errors else "fallback",
            "errors": errors or [],
        }

    @classmethod
    async def _nim_reply(
        cls,
        message: str,
        schedule: list[dict[str, Any]],
        session_id: str,
    ) -> str:
        schedule_json = json.dumps(schedule, indent=2, default=str)
        messages: list[dict[str, str]] = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "system", "content": f"Current production schedule:\n{schedule_json}"},
        ]
        # Append prior turns (skip the last user message — it's added below)
        for turn in cls._sessions.get(session_id, [])[:-1]:
            messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": message})

        return await nim_client.chat(messages=messages)

    # ── Local heuristic answers ───────────────────────────────────────────────

    @staticmethod
    def _local_answer(message: str, schedule: list[dict[str, Any]]) -> str:
        text = message.lower()

        # "why is order X delayed/blocked?"
        m = re.search(r"order\s+([A-Za-z0-9_-]+)", text)
        if m and any(kw in text for kw in ("delay", "block", "status", "why")):
            oid = m.group(1).upper()
            for item in schedule:
                raw = str(item.get("order") or item.get("order_id") or "")
                if raw.upper() == oid or oid in raw.upper():
                    status = item.get("status", "scheduled")
                    reason = item.get("reason", "no reason recorded")
                    machine = item.get("machine") or "unassigned"
                    start   = item.get("start") or "—"
                    end     = item.get("end") or "—"
                    if status == "blocked":
                        return f"Order {raw} is BLOCKED: {reason}. No machine has been assigned."
                    if status == "delayed" or item.get("delay"):
                        return f"Order {raw} is DELAYED: {reason}. Assigned to {machine} ({start} → {end})."
                    return f"Order {raw} is on time — status: {status}. Machine: {machine}, {start} → {end}."
            return f"Order {oid} was not found in the current schedule."

        # "which machine is overloaded / busiest?"
        if any(kw in text for kw in ("overload", "busiest", "most load", "machine")):
            counts: dict[str, int] = {}
            for item in schedule:
                mid = str(item.get("machine") or "unassigned")
                if mid != "unassigned":
                    counts[mid] = counts.get(mid, 0) + 1
            if not counts:
                return "No machine assignments found in the current schedule."
            busiest_id, busiest_count = max(counts.items(), key=lambda kv: kv[1])
            return (
                f"Machine {busiest_id} has the most assignments ({busiest_count} orders). "
                f"All machine load counts: {', '.join(f'{m}={c}' for m, c in sorted(counts.items()))}."
            )

        # "what orders are blocked / delayed / at risk?"
        if any(kw in text for kw in ("blocked", "at risk", "delayed", "late")):
            blocked = [s["order"] for s in schedule if s.get("status") == "blocked"]
            delayed = [s["order"] for s in schedule if s.get("status") == "delayed" or s.get("delay")]
            parts: list[str] = []
            if blocked:
                parts.append(f"Blocked ({len(blocked)}): {', '.join(str(o) for o in blocked)}")
            if delayed:
                parts.append(f"Delayed ({len(delayed)}): {', '.join(str(o) for o in delayed)}")
            return ". ".join(parts) if parts else "No blocked or delayed orders in the current schedule."

        # "how can I recover / what can I do?"
        if any(kw in text for kw in ("recover", "reroute", "fix", "resolve", "action")):
            blocked = [s for s in schedule if s.get("status") == "blocked"]
            delayed = [s for s in schedule if s.get("status") == "delayed" or s.get("delay")]
            if not blocked and not delayed:
                return "The schedule looks healthy — no blocked or delayed orders at the moment."
            actions: list[str] = []
            if blocked:
                actions.append(
                    f"Release {len(blocked)} blocked order(s) by resolving inventory or machine constraints: "
                    + ", ".join(str(s["order"]) for s in blocked)
                )
            if delayed:
                actions.append(
                    f"Review {len(delayed)} delayed order(s) — consider rerouting to an available machine or negotiating the deadline: "
                    + ", ".join(str(s["order"]) for s in delayed)
                )
            return " | ".join(actions)

        # Generic summary
        total   = len(schedule)
        on_time = sum(1 for s in schedule if not s.get("delay") and s.get("status") not in ("blocked", "delayed", "error"))
        return (
            f"Schedule summary: {total} orders total, {on_time} on time. "
            f"Ask about a specific order, machine load, or recovery options."
        )
