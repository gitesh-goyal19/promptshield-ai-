from fastapi import APIRouter
from services.prompt_loader import list_presets, get_preset

router = APIRouter(prefix="/presets", tags=["presets"])


@router.get("")
def list_presets_endpoint():
    return list_presets()


@router.get("/{preset_id}")
def get_preset_endpoint(preset_id: str):
    preset = get_preset(preset_id)
    if not preset:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset
