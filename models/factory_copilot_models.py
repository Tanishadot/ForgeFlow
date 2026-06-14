"""Pydantic models for the Factory Copilot chat API."""

from typing import Any, List
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request to chat with the Factory Copilot.

    - `message`: the user's question or prompt
    - `schedule`: current production schedule JSON (list of dicts)
    - `session_id`: optional session identifier to continue a conversation
    - `use_nim`: when true, attempt to use NVIDIA NIM
    """

    message: str = Field(..., description="User question for the copilot")
    schedule: List[dict[str, Any]] = Field(..., description="Current production schedule JSON")
    session_id: str | None = Field(default=None, description="Optional chat session id")
    use_nim: bool = Field(default=True, description="When true, use NVIDIA NIM if configured")


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    provider: str
    status: str
    errors: List[str] = Field(default_factory=list)


class HistoryResponse(BaseModel):
    session_id: str
    messages: List[dict[str, Any]]
