"""
Shift summary route.
  POST /api/v1/shift/summarize
    → Accepts recent shift_logs and generates an LLM summary via NVIDIA NIM.
    → Stores result in shift_context table.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/shift", tags=["shift"])


class ShiftLogEntry(BaseModel):
    shift:      str | None
    notes:      str
    created_at: str


class ShiftSummarizeRequest(BaseModel):
    company_id: str
    logs:       list[ShiftLogEntry]


class ShiftSummarizeResponse(BaseModel):
    summary: str
    status:  str


def _build_prompt(logs: list[ShiftLogEntry]) -> str:
    entries = []
    for log in logs:
        shift = log.shift or "Unknown Shift"
        entries.append(f"[{shift}] {log.notes}")
    log_text = "\n".join(entries)

    return (
        "You are an AI assistant for a manufacturing factory. "
        "Below are shift handover notes submitted by factory floor employees. "
        "Summarize the key issues, observations, and recommendations for the next shift. "
        "Be concise, factual, and action-oriented. Format your response with:\n"
        "- Key issues observed\n"
        "- Machines affected (if any)\n"
        "- Recommended actions for next shift\n\n"
        f"SHIFT NOTES:\n{log_text}"
    )


async def _call_nim(prompt: str) -> str:
    """Call NVIDIA NIM (or any OpenAI-compatible API) for summarization."""
    if not settings.nim_is_configured:
        raise ValueError("NVIDIA NIM is not configured (missing NVIDIA_API_KEY)")

    payload = {
        "model":       settings.nvidia_nim_model,
        "messages":    [{"role": "user", "content": prompt}],
        "max_tokens":  settings.nvidia_nim_max_tokens_explain,
        "temperature": settings.nvidia_nim_temperature,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            settings.nim_chat_url,
            headers=settings.nim_headers,
            json=payload,
            timeout=settings.nvidia_nim_timeout_seconds,
        )

    if resp.status_code != 200:
        raise ValueError(f"NIM API error {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    return data["choices"][0]["message"]["content"]


async def _store_context(company_id: str, summary: str) -> None:
    """Store the generated summary in the shift_context Supabase table."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase not configured — skipping shift_context storage")
        return

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/shift_context"
    headers = {
        "apikey":        settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }

    async with httpx.AsyncClient() as client:
        await client.post(
            url,
            headers=headers,
            json={"company_id": company_id, "summary": summary},
            timeout=10,
        )


@router.post("/summarize", response_model=ShiftSummarizeResponse)
async def summarize_shift(req: ShiftSummarizeRequest):
    """
    Summarize a batch of shift log entries using NVIDIA NIM.
    Falls back to a template summary if NIM is not configured.
    """
    if not req.logs:
        return ShiftSummarizeResponse(
            summary="No shift notes were found to summarize.",
            status="empty",
        )

    prompt = _build_prompt(req.logs)

    try:
        summary = await _call_nim(prompt)
        status  = "generated"
    except ValueError as exc:
        logger.warning("NIM call failed (%s) — using fallback summary", exc)
        # Simple fallback: bullet the raw notes
        lines = [f"• [{l.shift or '?'}] {l.notes}" for l in req.logs[:10]]
        summary = "Previous shift highlights:\n" + "\n".join(lines)
        status  = "fallback"

    # Persist to Supabase
    await _store_context(req.company_id, summary)

    return ShiftSummarizeResponse(summary=summary, status=status)
