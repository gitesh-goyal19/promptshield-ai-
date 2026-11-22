from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db import get_db
from db.models import Project, Target
import schemas

router = APIRouter(prefix="/projects", tags=["targets"])


@router.get("/{project_id}/targets", response_model=list[schemas.TargetOut])
def list_targets(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Target).filter(Target.project_id == project_id).all()


@router.post("/{project_id}/targets", response_model=schemas.TargetOut, status_code=201)
def create_target(project_id: int, payload: schemas.TargetCreate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    target = Target(
        project_id=project_id,
        provider=payload.provider,
        model_id=payload.model_id,
        settings_json=payload.model_dump(exclude={"provider", "model_id"}),
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return schemas.TargetOut(
        id=target.id,
        project_id=target.project_id,
        provider=target.provider,
        model_id=target.model_id,
        temperature=target.settings_json.get("temperature"),
        max_output_tokens=target.settings_json.get("max_output_tokens"),
    )
