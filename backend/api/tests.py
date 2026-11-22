from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from db import get_db
from db.models import Project, TestCase
from services.test_generator import generate_tests, CATEGORIES
from services.gemini_adapter import GeminiAdapter
import schemas
import json

router = APIRouter(tags=["tests"])

_adapter = GeminiAdapter()


@router.get("/projects/{project_id}/tests", response_model=list[schemas.TestCaseOut])
def list_tests(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(TestCase).filter(TestCase.project_id == project_id).order_by(TestCase.id).all()


@router.post("/projects/{project_id}/tests/generate", response_model=schemas.TestGenerateResponse)
def generate_tests_endpoint(project_id: int, payload: schemas.TestGenerateRequest, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {payload.category}")

    gen = generate_tests(_adapter, payload.category, payload.n, payload.system_prompt or "")

    created = []
    for t in gen["tests"]:
        tc = TestCase(
            project_id=project_id,
            category=t.category,
            attack_prompt=t.attack_prompt,
            rule_being_tested=t.rule_being_tested,
            expected_behavior=t.expected_behavior,
            rubric_json={"evaluation_criteria": t.evaluation_criteria, "test_id": t.test_id},
            approved=False,
            source=t.source or "generated",
        )
        db.add(tc)
        db.commit()
        db.refresh(tc)
        created.append(tc)

    return schemas.TestGenerateResponse(
        generated=len(created),
        fallback_used=gen["fallback_used"],
        tests=created,
    )


@router.patch("/tests/{test_id}", response_model=schemas.TestCaseOut)
def update_test(test_id: int, payload: schemas.TestCaseUpdate, db: Session = Depends(get_db)):
    tc = db.get(TestCase, test_id)
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(tc, field, value)
    db.commit()
    db.refresh(tc)
    return tc


@router.get("/projects/{project_id}/tests/export")
def export_tests(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tests = (
        db.query(TestCase)
        .filter(TestCase.project_id == project_id)
        .order_by(TestCase.id)
        .all()
    )
    data = []
    for t in tests:
        data.append({
            "test_id": t.test_id,
            "category": t.category,
            "attack_prompt": t.attack_prompt,
            "rule_being_tested": t.rule_being_tested,
            "expected_behavior": t.expected_behavior,
            "evaluation_criteria": (t.rubric_json or {}).get("evaluation_criteria", ""),
            "rubric_json": t.rubric_json or {},
            "approved": t.approved,
            "source": t.source,
        })
    return PlainTextResponse(
        content=json.dumps(data, indent=2),
        media_type="application/json",
    )


@router.post("/projects/{project_id}/tests/import")
async def import_tests(project_id: int, request: Request, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    body = await request.json()
    if not isinstance(body, list):
        raise HTTPException(status_code=400, detail="Expected a JSON array of test cases")
    created = 0
    for item in body:
        try:
            validated = schemas.TestCaseCreate(**item)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid test case: {item.get('test_id', 'unknown')}")
        tc = TestCase(
            project_id=project_id,
            category=validated.category,
            attack_prompt=validated.attack_prompt,
            rule_being_tested=validated.rule_being_tested,
            expected_behavior=validated.expected_behavior,
            rubric_json={"evaluation_criteria": validated.evaluation_criteria, "test_id": validated.test_id},
            approved=validated.approved,
            source=validated.source or "imported",
        )
        db.add(tc)
        db.commit()
        created += 1
    return {"imported": created}

