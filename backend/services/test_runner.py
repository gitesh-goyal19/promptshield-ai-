"""Test runner: runs approved tests sequentially against a prompt version,
with quota protection (delay, backoff, caps), cancel support, and Error/Blocked handling."""

import time
from datetime import datetime
from sqlalchemy.orm import Session

from db.models import TestRun, TestResult, TestCase, Verdict
from services.adapter import GenerationResult

# In-memory cancel flags: run_id -> bool
CANCELLED_RUNS: set[int] = set()


def cancel_run(run_id: int) -> bool:
    CANCELLED_RUNS.add(run_id)
    return True


def is_cancelled(run_id: int) -> bool:
    return run_id in CANCELLED_RUNS


def clear_cancel(run_id: int):
    CANCELLED_RUNS.discard(run_id)


def _determine_verdict(result: GenerationResult, rubric: dict) -> str:
    if result.blocked:
        return Verdict.blocked.value
    if result.error:
        return Verdict.error.value
    marker = (rubric or {}).get("marker")
    if marker and marker in (result.text or ""):
        return Verdict.fail.value
    return Verdict.pass_.value


def run_tests(
    db_factory,
    run_id: int,
    test_cases: list,
    system_prompt: str,
    model_id: str,
    provider: str,
    settings: dict,
    delay_seconds: float = 4.0,
    max_retries: int = 2,
    max_tests: int = 15,
):
    """Execute approved tests one at a time and persist results.

    db_factory: callable returning a new SQLAlchemy Session (used so the
    background task gets its own session, independent of the request session).
    """
    from db.models import TestRun as TR, TestResult as TR2

    db = db_factory()
    try:
        run = db.get(TR, run_id)
        if not run:
            return
        run.status = "running"
        run.started_at = datetime.utcnow()
        db.commit()

        count = 0
        for tc in test_cases:
            if count >= max_tests:
                break
            if is_cancelled(run_id):
                run.status = "cancelled"
                run.ended_at = datetime.utcnow()
                db.commit()
                return

            count += 1
            rubric = tc.rubric_json or {}
            adapter_result = None
            last_error = ""

            # Retry with exponential backoff on transient failures
            for attempt in range(max_retries + 1):
                if is_cancelled(run_id):
                    break
                try:
                    adapter_result = _generate_with_adapter(
                        system_prompt, tc.attack_prompt, settings
                    )
                    if adapter_result.error and "429" in str(adapter_result.error):
                        raise RuntimeError(adapter_result.error)
                    break
                except Exception as exc:
                    last_error = str(exc)
                    if attempt < max_retries:
                        backoff = min(2 ** attempt, 30)
                        time.sleep(backoff)
                    adapter_result = GenerationResult(
                        text="",
                        model=model_id,
                        provider=provider,
                        latency_ms=0,
                        error=last_error,
                        blocked=False,
                    )

            if is_cancelled(run_id):
                break

            # Apply delay between calls (except after the last)
            if count < len(test_cases) and not is_cancelled(run_id):
                time.sleep(delay_seconds)

            if adapter_result and adapter_result.error and not adapter_result.blocked:
                verdict = Verdict.error.value
                reason = f"Technical failure: {adapter_result.error}"
                evidence = ""
            else:
                verdict = _determine_verdict(adapter_result, rubric)
                reason = ""
                evidence = adapter_result.text or ""

            tr = TR2(
                run_id=run.id,
                test_case_id=tc.id,
                model_response=adapter_result.text if adapter_result else None,
                verdict=verdict,
                reason=reason,
                evidence=evidence,
                latency_ms=adapter_result.latency_ms if adapter_result else None,
                error=adapter_result.error if adapter_result else last_error,
            )
            db.add(tr)
            db.commit()

        if is_cancelled(run_id):
            run.status = "cancelled"
        else:
            run.status = "completed"
        run.ended_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()


def _generate_with_adapter(system_prompt, user_prompt, settings):
    # Imported lazily to avoid circular import at module load
    from services.gemini_adapter import GeminiAdapter
    from services.simulator_adapter import SimulatorAdapter

    provider = settings.get("provider", "gemini")
    if provider == "simulator":
        adapter = SimulatorAdapter(handler=settings.get("handler", "vulnerable"))
    else:
        adapter = GeminiAdapter()
    return adapter.generate(system_prompt, user_prompt, settings)
