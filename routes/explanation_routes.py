"""Routes for production schedule explanations."""

import logging

from fastapi import APIRouter, HTTPException

from models.explanation_models import ExplanationRequest, ExplanationResponse
from services.production_explanation_service import ProductionExplanationService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["explanation"])


@router.post("/explain", response_model=ExplanationResponse)
async def explain_schedule(request: ExplanationRequest) -> ExplanationResponse:
    """Explain a production schedule using NVIDIA NIM when configured."""
    try:
        result = await ProductionExplanationService.explain_schedule(
            schedule=request.schedule,
            context=request.context,
            use_nim=request.use_nim,
        )
        return ExplanationResponse(**result)
    except Exception as exc:
        logger.exception("Failed to explain production schedule")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to explain production schedule: {exc}",
        ) from exc
