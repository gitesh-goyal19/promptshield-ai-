import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session
from db import get_db
from db.models import Project, Target, PromptVersion, TestRun, TestCase, TestResult, ReviewEvent, Verdict
from services.test_runner import run_tests, cancel_run, is_cancelled, clear_cancel
from services.evaluator import evaluate
from services.gemini_adapter import GeminiAdapter
from services.report_service import generate_markdown, generate_pdf
import os
import schemas

router = APIRouter(tags=["runs"])

_judge = GeminiAdapter()
_judge.model = os.getenv("GEMINI_JUDGE_MODEL", _judge.model)

# Active runs tracking for live progress
ACTIVE_RUNS: dict[int, dict] = {}


def _get_run_or_404(db: Session, run_id: int) -> TestRun:
    run = db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/projects/{project_id}/runs", response_model=schemas.TestRunOut, status_code=201)
def create_run(
    project_id: int,
    payload: schemas.TestRunCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    target = db.get(Target, payload.target_id)
    if not target or target.project_id != project_id:
        raise HTTPException(status_code=404, detail="Target not found")
    version = db.get(PromptVersion, payload.prompt_version_id)
    if not version or version.project_id != project_id:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    max_tests = payload.max_tests if payload.max_tests is not None else 15

    # Approved tests only
    tests = (
        db.query(TestCase)
        .filter(TestCase.project_id == project_id, TestCase.approved == True)  # noqa: E712
        .order_by(TestCase.id)
        .all()
    )
    if not tests:
        raise HTTPException(status_code=400, detail="No approved tests to run")

    run = TestRun(
        project_id=project_id,
        target_id=target.id,
        prompt_version_id=version.id,
        mode=payload.mode,
        status="pending",
        started_at=None,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Launch in background with its own DB session
    def runner(db_session):
        run_tests(
            db_factory=lambda: db_session,
            run_id=run.id,
            test_cases=tests,
            system_prompt=version.system_prompt,
            model_id=target.model_id,
            provider=target.provider,
            settings=payload.settings or {},
            delay_seconds=4.0,
            max_tests=max_tests,
        )
        ACTIVE_RUNS.pop(run.id, None)

    # use a fresh session factory for the background task
    from db import SessionLocal

    background.add_task(runner, SessionLocal())
    ACTIVE_RUNS[run.id] = {"status": "running", "project_id": project_id}
    return run


@router.get("/runs/{run_id}", response_model=schemas.TestRunOut)
def get_run(run_id: int, db: Session = Depends(get_db)):
    return _get_run_or_404(db, run_id)


@router.post("/runs/{run_id}/cancel")
def cancel_run_endpoint(run_id: int, db: Session = Depends(get_db)):
    run = _get_run_or_404(db, run_id)
    if run.status in ("completed", "cancelled", "error"):
        raise HTTPException(status_code=400, detail=f"Run already {run.status}")
    cancel_run(run_id)
    run.status = "cancelling"
    db.commit()
    return {"status": "cancelling", "run_id": run_id}


@router.get("/runs/{run_id}/results", response_model=list[schemas.TestResultOut])
def get_run_results(run_id: int, db: Session = Depends(get_db)):
    _get_run_or_404(db, run_id)
    results = (
        db.query(TestResult)
        .filter(TestResult.run_id == run_id)
        .order_by(TestResult.id)
        .all()
    )
    # attach test_case for test_id display
    out = []
    for r in results:
        tc = db.get(TestCase, r.test_case_id)
        out.append(
            schemas.TestResultOut(
                id=r.id,
                run_id=r.run_id,
                test_case_id=r.test_case_id,
                model_response=r.model_response,
                verdict=r.verdict,
                reason=r.reason,
                evidence=r.evidence,
                latency_ms=r.latency_ms,
                error=r.error,
                test_case=schemas.TestCaseOut(
                    id=tc.id,
                    project_id=tc.project_id,
                    test_id=tc.test_id,
                    category=tc.category,
                    attack_prompt=tc.attack_prompt,
                    rule_being_tested=tc.rule_being_tested,
                    expected_behavior=tc.expected_behavior,
                    evaluation_criteria=(tc.rubric_json or {}).get("evaluation_criteria", ""),
                    rubric_json=tc.rubric_json or {},
                    approved=tc.approved,
                    source=tc.source,
                )
                if tc
                else None,
            )
        )
    return out


@router.patch("/results/{result_id}/review", response_model=schemas.TestResultOut)
def review_result(result_id: int, payload: schemas.ResultReviewRequest, db: Session = Depends(get_db)):
    result = db.get(TestResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    if payload.new_verdict not in ("Pass", "Fail", "Needs Review"):
        raise HTTPException(status_code=400, detail="Invalid verdict")
    old_verdict = result.verdict
    if old_verdict == payload.new_verdict:
        # still record the audit event per spec (user re-confirmed)
        pass
    event = ReviewEvent(
        result_id=result.id,
        old_verdict=old_verdict,
        new_verdict=payload.new_verdict,
        reason=payload.reason,
    )
    db.add(event)
    result.verdict = payload.new_verdict
    result.reason = (payload.reason or result.reason) or ""
    db.commit()
    db.refresh(result)
    return result


@router.post("/runs/{run_id}/re-evaluate")
def re_evaluate_run(run_id: int, db: Session = Depends(get_db)):
    run = _get_run_or_404(db, run_id)
    results = (
        db.query(TestResult).filter(TestResult.run_id == run_id).order_by(TestResult.id).all()
    )
    judge = _judge
    updated = 0
    for r in results:
        if r.verdict in ("Error", "Blocked by provider"):
            continue
        tc = db.get(TestCase, r.test_case_id)
        if not tc:
            continue
        rubric = tc.rubric_json or {}
        verdict, reason, evidence = evaluate(
            judge,
            r.model_response or "",
            tc.rule_being_tested,
            {
                "category": tc.category,
                "attack_prompt": tc.attack_prompt,
                "rule_being_tested": tc.rule_being_tested,
                "expected_behavior": tc.expected_behavior,
                "evaluation_criteria": (rubric or {}).get("evaluation_criteria", ""),
            },
            tc.expected_behavior,
            rubric,
        )
        r.verdict = verdict
        r.reason = reason
        r.evidence = evidence
        db.add(r)
        updated += 1
    db.commit()
    return {"re_evaluated": updated}


@router.get("/projects/{project_id}/compare")
def compare_runs(project_id: int, run_a: int, run_b: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ra = db.get(TestRun, run_a)
    rb = db.get(TestRun, run_b)
    if not ra or ra.project_id != project_id:
        raise HTTPException(status_code=404, detail="Run A not found")
    if not rb or rb.project_id != project_id:
        raise HTTPException(status_code=404, detail="Run B not found")

    def results_for(run):
        return db.query(TestResult).filter(TestResult.run_id == run.id).all()

    res_a = results_for(ra)
    res_b = results_for(rb)

    # index by test_case_id
    idx_a = {r.test_case_id: r for r in res_a}
    idx_b = {r.test_case_id: r for r in res_b}

    # category counts for run B
    from sqlalchemy import func
    cats = (
        db.query(TestCase.category, TestResult.verdict, func.count(TestResult.id))
        .join(TestResult, TestResult.test_case_id == TestCase.id)
        .filter(TestResult.run_id == rb.id, TestCase.project_id == project_id)
        .group_by(TestCase.category, TestResult.verdict)
        .all()
    )
    category_counts = {}
    for cat, verdict, count in cats:
        category_counts.setdefault(cat, {"Pass": 0, "Fail": 0, "Needs Review": 0, "Error": 0, "Blocked by provider": 0})
        category_counts[cat][verdict] = count

    # matched test IDs (in both runs)
    matched_ids = sorted(set(idx_a.keys()) & set(idx_b.keys()))
    fixed = []
    regressions = []
    for tcid in matched_ids:
        va = idx_a[tcid].verdict
        vb = idx_b[tcid].verdict
        tc = db.get(TestCase, tcid)
        if va == Verdict.fail.value and vb == Verdict.pass_.value:
            fixed.append({"test_case_id": tcid, "category": tc.category if tc else None})
        if va == Verdict.pass_.value and vb == Verdict.fail.value:
            regressions.append({"test_case_id": tcid, "category": tc.category if tc else None})

    # benign false-refusal rate for run B
    benign_b = [
        r for r in res_b
        if db.get(TestCase, r.test_case_id)
        and db.get(TestCase, r.test_case_id).category == "benign_requests"
    ]
    benign_refusals_b = sum(1 for r in benign_b if r.verdict == Verdict.fail.value)
    benign_frr_b = (benign_refusals_b / len(benign_b) * 100) if benign_b else 0

    return {
        "run_a": {"id": run_a, "status": ra.status},
        "run_b": {"id": run_b, "status": rb.status},
        "category_counts": category_counts,
        "matched_tests": len(matched_ids),
        "newly_fixed": fixed,
        "new_regressions": regressions,
        "benign_false_refusal_rate": round(benign_frr_b, 1),
        "note": "Small test set; not proof of security.",
    }


@router.get("/runs/{run_id}/report")
def get_report(run_id: int, format: str = "md", db: Session = Depends(get_db)):
    run = db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    project = db.get(Project, run.project_id)
    target = db.get(Target, run.target_id)
    version = db.get(PromptVersion, run.prompt_version_id)
    results = (
        db.query(TestResult)
        .filter(TestResult.run_id == run_id)
        .order_by(TestResult.id)
        .all()
    )
    versions_list = [version] if version else []
    if format == "pdf":
        path = generate_pdf(project, target, versions_list, results, mode=run.mode)
        return FileResponse(path, media_type="application/pdf", filename=os.path.basename(path))
    md = generate_markdown(project, target, versions_list, results, mode=run.mode)
    return PlainTextResponse(content=md, media_type="text/markdown")



