import os
from fastapi import APIRouter
import schemas

router = APIRouter(tags=["models"])


@router.get("/models", response_model=schemas.ModelInfo)
def models():
    return schemas.ModelInfo(
        target_model=os.getenv("GEMINI_TARGET_MODEL", "gemini-1.5-flash"),
        judge_model=os.getenv("GEMINI_JUDGE_MODEL", "gemini-1.5-flash"),
        api_key_present=bool(os.getenv("GEMINI_API_KEY")),
    )
