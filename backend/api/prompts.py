import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from db.models import Project, PromptVersion, TestResult, TestRun, TestCase, Verdict
from services.prompt_improver import suggest_improvement
from services.gemini_adapter import GeminiAdapter
import schemas

router = APIRouter(prefix="/projects", tags=["prompts"])

_judge = GeminiAdapter()
_judge.model = os.getenv("GEMINI_JUDGE_MODEL", _judge.model)


def _next_version_no(db: Session, project_id: int) -> int:
    last = (
        db.query(PromptVersion)
        .filter(PromptVersion.project_id == project_id)
        .order_by(PromptVersion.version_no.desc())
        .first()
    )
    return (last.version_no + 1) if last else 1


@router.post("/{project_id}/prompts", status_code=201)
def create_prompt_version(project_id: int, payload: schemas.PromptVersionCreate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    version_no = _next_version_no(db, project_id)
    parent = None
    if payload.parent_version_id:
        parent = db.get(PromptVersion, payload.parent_version_id)
        if not parent or parent.project_id != project_id:
            raise HTTPException(status_code=404, detail="Parent version not found")
    pv = PromptVersion(
        project_id=project_id,
        version_no=version_no,
        system_prompt=payload.system_prompt,
        parent_version_id=payload.parent_version_id,
    )
    db.add(pv)
    db.commit()
    db.refresh(pv)
    return pv


@router.get("/{project_id}/prompts")
def list_prompt_versions(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return (
        db.query(PromptVersion)
        .filter(PromptVersion.project_id == project_id)
        .order_by(PromptVersion.version_no)
        .all()
    )


@router.get("/{project_id}/prompts/{version_id}")
def get_prompt_version(project_id: int, version_id: int, db: Session = Depends(get_db)):
    pv = db.get(PromptVersion, version_id)
    if not pv or pv.project_id != project_id:
        raise HTTPException(status_code=404, detail="Prompt version not found")
    return pv


@router.post("/{project_id}/prompts/suggest")
def suggest_improved_prompt(project_id: int, payload: schemas.PromptSuggestRequest, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    version = db.get(PromptVersion, payload.prompt_version_id)
    if not version or version.project_id != project_id:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    failures = payload.failures or []
    return suggest_improvement(_judge, version.system_prompt, failures)


@router.get("/{project_id}/metrics")
def get_metrics(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    results = (
        db.query(TestResult)
        .join(TestRun, TestResult.run_id == TestRun.id)
        .filter(TestRun.project_id == project_id)
        .all()
    )
    total = len(results)
    pass_count = sum(1 for r in results if r.verdict == Verdict.pass_.value)
    fail_count = sum(1 for r in results if r.verdict == Verdict.fail.value)
    review_count = sum(1 for r in results if r.verdict == Verdict.needs_review.value)
    error_count = sum(1 for r in results if r.verdict == Verdict.error.value)
    blocked_count = sum(1 for r in results if r.verdict == Verdict.blocked.value)
    decided = pass_count + fail_count
    pass_rate = (pass_count / decided * 100) if decided else 0
    rule_break_rate = (fail_count / decided * 100) if decided else 0
    benign_tests = [
        r for r in results
        if db.get(TestCase, r.test_case_id)
        and db.get(TestCase, r.test_case_id).category == "benign_requests"
    ]
    benign_refusals = sum(1 for r in benign_tests if r.verdict == Verdict.fail.value)
    benign_false_refusal = (benign_refusals / len(benign_tests) * 100) if benign_tests else 0
    latencies = [r.latency_ms for r in results if r.latency_ms is not None]
    avg_latency = (sum(latencies) / len(latencies)) if latencies else 0
    return {
        "completed": total,
        "pass_rate": round(pass_rate, 1),
        "rule_break_rate": round(rule_break_rate, 1),
        "benign_false_refusal_rate": round(benign_false_refusal, 1),
        "needs_review": review_count,
        "error": error_count,
        "blocked": blocked_count,
        "average_latency_ms": round(avg_latency, 1),
    }
