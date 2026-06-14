"""Thin async client for NVIDIA NIM chat completions.

Usage:
    from nim_client import nim_client

    reply = await nim_client.chat([
        {"role": "system", "content": "You are a factory assistant."},
        {"role": "user",   "content": "Which orders are delayed?"},
    ])
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from settings import settings

logger = logging.getLogger(__name__)


class NIMClient:
    """Async wrapper around the NVIDIA NIM chat completions endpoint."""

    @property
    def is_configured(self) -> bool:
        return settings.nim_is_configured

    async def chat(
        self,
        messages: list[dict[str, str]],
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> str:
        """Send a chat request to NIM and return the assistant reply as a string.

        Raises:
            RuntimeError: if the API key is not configured.
            httpx.HTTPStatusError: if NIM returns a non-2xx response.
        """
        if not self.is_configured:
            raise RuntimeError(
                "NVIDIA_API_KEY is not set. "
                "Copy .env.example → .env and add your key."
            )

        payload: dict[str, Any] = {
            "model": settings.nvidia_nim_model,
            "messages": messages,
            "temperature": temperature if temperature is not None else settings.nvidia_nim_temperature,
            "max_tokens": max_tokens if max_tokens is not None else settings.nvidia_nim_max_tokens_chat,
        }

        logger.debug(
            "NIM request: model=%s messages=%d",
            settings.nvidia_nim_model,
            len(messages),
        )

        async with httpx.AsyncClient(timeout=settings.nvidia_nim_timeout_seconds) as client:
            response = await client.post(
                settings.nim_chat_url,
                headers=settings.nim_headers,
                json=payload,
            )
            response.raise_for_status()

        data = response.json()
        content: str = data["choices"][0]["message"]["content"]
        logger.debug("NIM response: %d chars", len(content))
        return content


# Shared singleton — import this, not the class.
nim_client = NIMClient()
