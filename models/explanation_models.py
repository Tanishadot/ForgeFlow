"""Models for production schedule explanations."""

from typing import Any

from pydantic import BaseModel, Field


class ExplanationRequest(BaseModel):
    """Request body for the /explain endpoint."""

    schedule: list[dict[str, Any]] = Field(
        ...,
        description="Production schedule JSON to explain.",
    )
    context: dict[str, Any] | None = Field(
        default=None,
        description="Optional context such as prioritized orders, inventory status, or machine data.",
    )
    use_nim: bool = Field(
        default=True,
        description="When true, use NVIDIA NIM if it is configured.",
    )


class ExplanationResponse(BaseModel):
    """Natural language production explanation response."""

    status: str = Field(..., description="success, fallback, or error.")
    provider: str = Field(..., description="nim or local.")
    summaries: list[str] = Field(
        default_factory=list,
        description="Natural language summaries explaining the schedule.",
    )
    recommendations: list[str] = Field(
        default_factory=list,
        description="Actionable recommendations for the scheduler (reorders, rerouting, etc.).",
    )
    errors: list[str] = Field(default_factory=list)
