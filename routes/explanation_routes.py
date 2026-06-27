"""Routes for production schedule explanations."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from dependencies.auth import verify_token
from limiter import limiter
from models.explanation_models import ExplanationRequest, ExplanationResponse
from services.production_explanation_service import ProductionExplanationService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["explanation"], dependencies=[Depends(verify_token)])


@router.post("/explain", response_model=ExplanationResponse)
@limiter.limit("20/minute")
async def explain_schedule(request: Request, body: ExplanationRequest) -> ExplanationResponse:
    """Explain a production schedule using NVIDIA NIM when configured."""
    try:
        result = await ProductionExplanationService.explain_schedule(
            schedule=body.schedule,
            context=body.context,
            use_nim=body.use_nim,
        )
        return ExplanationResponse(**result)
    except Exception as exc:
        logger.exception("Failed to explain production schedule")
        raise HTTPException(status_code=500, detail="Failed to explain production schedule") from exc
