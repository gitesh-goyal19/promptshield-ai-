from fastapi import APIRouter, HTTPException
from services.gemini_adapter import GeminiAdapter
import schemas

router = APIRouter(tags=["playground"])

_adapter = GeminiAdapter()


@router.post("/playground/chat", response_model=schemas.ChatResponse)
def chat(payload: schemas.ChatRequest):
    model = payload.model or _adapter.model
    settings = payload.settings or {}
    result = _adapter.generate(payload.system_prompt, payload.message, settings)
    return schemas.ChatResponse(
        reply=result.text,
        model=result.model,
        provider=result.provider,
        latency_ms=result.latency_ms,
        error=result.error,
        blocked=result.blocked,
    )
