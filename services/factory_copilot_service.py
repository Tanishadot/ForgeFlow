"""Factory Copilot service: maintains chat history and queries NVIDIA NIM."""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_NIM_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct"


class FactoryCopilotService:
    """Handles conversational queries against a production schedule using NVIDIA NIM.

    This implementation keeps a very small in-memory session store mapping
    `session_id` -> list[message]. Each message is a dict with `role` and `content`.
    """

    _sessions: dict[str, list[dict[str, str]]] = {}

    @classmethod
    def _nim_is_configured(cls) -> bool:
        return bool(os.getenv("NVIDIA_API_KEY"))

    @classmethod
    def _new_session_id(cls) -> str:
        return uuid.uuid4().hex

    @classmethod
    def get_history(cls, session_id: str) -> list[dict[str, str]]:
        return cls._sessions.get(session_id, [])

    @classmethod
    def _save_message(cls, session_id: str, role: str, content: str) -> None:
        cls._sessions.setdefault(session_id, []).append({"role": role, "content": content})

    @classmethod
    async def chat(
        cls,
        message: str,
        schedule: list[dict[str, Any]],
        session_id: str | None = None,
        use_nim: bool = True,
    ) -> dict[str, Any]:
        if not session_id:
            session_id = cls._new_session_id()

        # Save user message to history
        cls._save_message(session_id, "user", message)

        # Build messages for NIM
        system_prompt = (
            "You are Factory Copilot. Answer user questions about the provided production schedule. "
            "Ground your answers in the schedule JSON and don't hallucinate. When asked for lists, return concise bullets. "
            "Maintain context with the conversation history. Return plain text replies."
        )

        schedule_text = json.dumps(schedule, indent=2, default=str)
        # Prepare message list: system, schedule, history, current user
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "system", "content": f"Schedule JSON:\n{schedule_text}"},
        ]

        # append prior history
        for m in cls.get_history(session_id):
            messages.append({"role": m["role"], "content": m["content"]})

        messages.append({"role": "user", "content": message})

        # Try NIM if requested and configured
        if use_nim and cls._nim_is_configured():
            try:
                reply = await cls._query_nim(messages=messages)
                cls._save_message(session_id, "assistant", reply)
                return {
                    "session_id": session_id,
                    "reply": reply,
                    "provider": "nim",
                    "status": "success",
                    "errors": [],
                }
            except Exception as exc:
                logger.exception("NIM query failed, falling back to local responder")
                fallback = cls._local_answer(message=message, schedule=schedule)
                cls._save_message(session_id, "assistant", fallback)
                return {
                    "session_id": session_id,
                    "reply": fallback,
                    "provider": "local",
                    "status": "fallback",
                    "errors": [str(exc)],
                }

        # local fallback
        reply = cls._local_answer(message=message, schedule=schedule)
        cls._save_message(session_id, "assistant", reply)
        return {
            "session_id": session_id,
            "reply": reply,
            "provider": "local",
            "status": "fallback",
            "errors": [] if not use_nim else ["NVIDIA NIM is not configured"],
        }

    @classmethod
    async def _query_nim(cls, messages: list[dict[str, str]]) -> str:
        api_key = os.environ["NVIDIA_API_KEY"]
        base_url = os.getenv("NVIDIA_NIM_BASE_URL", DEFAULT_NIM_BASE_URL).rstrip("/")
        model = os.getenv("NVIDIA_NIM_MODEL", DEFAULT_NIM_MODEL)
        timeout_seconds = float(os.getenv("NVIDIA_NIM_TIMEOUT_SECONDS", "30"))

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 800,
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
        # Expect same shape as explanation service
        content = data["choices"][0]["message"]["content"]
        # Return raw content
        return content

    @staticmethod
    def _local_answer(message: str, schedule: list[dict[str, Any]]) -> str:
        """Simple heuristic grounded answers for common queries."""
        text = message.lower()

        # Why is order X delayed?
        m = re.search(r"order\s+([A-Za-z0-9_-]+)\s+delayed", text)
        if m:
            order_id = m.group(1)
            for item in schedule:
                oid = str(item.get("order") or item.get("order_id") or "")
                if oid == order_id:
                    status = item.get("status", "scheduled")
                    if status == "delayed" or item.get("delay"):
                        reason = item.get("reason") or "a scheduling conflict or missing input"
                        return f"Order {order_id} is delayed: {reason}. Current status: {status}."
                    return f"Order {order_id} is not marked delayed (status={status})."
            return f"Order {order_id} not found in the provided schedule."

        # Which machine is overloaded?
        if "which machine is overloaded" in text or "overloaded" in text:
            counts: dict[str, int] = {}
            for item in schedule:
                m_id = str(item.get("machine") or item.get("machine_id") or "unassigned")
                counts[m_id] = counts.get(m_id, 0) + 1
            if not counts:
                return "No machine assignments found in the schedule."
            # pick machine with max assignments
            overloaded = max(counts.items(), key=lambda kv: kv[1])
            return f"Machine {overloaded[0]} has the most assignments ({overloaded[1]})."

        # What orders are due today?
        if "due today" in text or "due today?" in text:
            from datetime import datetime

            today = datetime.utcnow().date()
            due_orders = []
            for item in schedule:
                due = item.get("due") or item.get("end") or item.get("date")
                if not due:
                    continue
                try:
                    d = datetime.fromisoformat(str(due)).date()
                except Exception:
                    continue
                if d == today:
                    due_orders.append(str(item.get("order") or item.get("order_id") or "unknown"))
            if not due_orders:
                return "No orders are due today according to the provided schedule."
            return "Orders due today: " + ", ".join(due_orders)

        # Fallback: short summary of schedule
        total = len(schedule)
        machines = {str(item.get("machine") or item.get("machine_id") or "unassigned") for item in schedule}
        return (
            f"I can help with questions about the schedule. Currently there are {total} scheduled items "
            f"across {len(machines)} machines. Ask ‘Why is order <id> delayed?’ or ‘Which machine is overloaded?’."
        )
