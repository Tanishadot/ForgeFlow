"""Models for What-If Simulation Agent."""

from typing import Any

from pydantic import BaseModel, Field


class WhatIfRequest(BaseModel):
    """Request body for the What-If Simulation Agent."""

    schedule: list[dict[str, Any]] = Field(..., description="Current production schedule JSON")
    machines: list[dict[str, Any]] | None = Field(
        default=None, description="Optional machine metadata (machine_id, type, capacity)"
    )
    inventory: list[dict[str, Any]] | None = Field(default=None, description="Optional inventory list")
    scenario: dict[str, Any] = Field(
        ..., description="Scenario descriptor, e.g. {'type':'machine_failure','machine':'M-1'}"
    )


class WhatIfImpact(BaseModel):
    delayed_orders: list[str] = Field(default_factory=list)
    schedule_changes: list[dict[str, Any]] = Field(default_factory=list)
    utilization_changes: dict[str, dict[str, float]] = Field(
        default_factory=dict,
        description="Mapping machine_id -> {before: x, after: y} utilization (minutes)",
    )


class WhatIfResponse(BaseModel):
    status: str = Field(...)
    scenario: dict[str, Any] = Field(...)
    impact: WhatIfImpact
    errors: list[str] = Field(default_factory=list)
