"""FastAPI routes for the Factory Copilot conversational API."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from dependencies.auth import verify_token
from limiter import limiter
from models.factory_copilot_models import ChatRequest, ChatResponse, HistoryResponse
from services.factory_copilot_service import FactoryCopilotService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"], dependencies=[Depends(verify_token)])


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
async def copilot_chat(request: Request, body: ChatRequest) -> ChatResponse:
    try:
        result = await FactoryCopilotService.chat(
            message=body.message,
            schedule=body.schedule,
            session_id=body.session_id,
            use_nim=body.use_nim,
        )
        return ChatResponse(**result)
    except Exception as exc:
        logger.exception("Copilot chat failed")
        raise HTTPException(status_code=500, detail="Copilot request failed") from exc


@router.get("/history", response_model=HistoryResponse)
async def copilot_history(session_id: str) -> HistoryResponse:
    history = FactoryCopilotService.get_history(session_id)
    return HistoryResponse(session_id=session_id, messages=history)
