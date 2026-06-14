"""FastAPI routes for the Factory Copilot conversational API."""

import logging
from fastapi import APIRouter, HTTPException

from models.factory_copilot_models import ChatRequest, ChatResponse, HistoryResponse
from services.factory_copilot_service import FactoryCopilotService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.post("/chat", response_model=ChatResponse)
async def copilot_chat(request: ChatRequest) -> ChatResponse:
    try:
        result = await FactoryCopilotService.chat(
            message=request.message,
            schedule=request.schedule,
            session_id=request.session_id,
            use_nim=request.use_nim,
        )
        return ChatResponse(**result)
    except Exception as exc:
        logger.exception("Copilot chat failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/history", response_model=HistoryResponse)
async def copilot_history(session_id: str) -> HistoryResponse:
    history = FactoryCopilotService.get_history(session_id)
    return HistoryResponse(session_id=session_id, messages=history)
