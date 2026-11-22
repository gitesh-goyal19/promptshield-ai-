"""Prompt improver: asks the judge model to suggest a clearer system prompt based on failures."""

import json
import re
from pathlib import Path

from services.adapter import ModelAdapter, GenerationResult
import schemas


def _load_prompt_improver() -> str:
    path = Path(__file__).resolve().parents[2] / "prompts" / "prompt_improver.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def _extract_json_object(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text


def suggest_improvement(adapter: ModelAdapter, original_prompt: str, failures: list[dict]) -> dict:
    """Ask the judge model for an improved system prompt.

    Returns {suggested_system_prompt, rationale, note}.
    failures: list of {rule_being_tested, expected_behavior, model_response, reason}
    """
    template = _load_prompt_improver()
    failures_json = json.dumps(failures, indent=2)
    user_prompt = (
        f"original_system_prompt: {original_prompt}\n"
        f"failures: {failures_json}\n"
    )
    result: GenerationResult = adapter.generate(
        system_prompt=template,
        user_prompt=user_prompt,
        settings={"temperature": 0.4, "max_output_tokens": 1500},
    )
    if result.error or result.blocked:
        return {
            "suggested_system_prompt": original_prompt,
            "rationale": f"Improvement unavailable: {result.error or 'blocked'}",
            "note": "Some failures may need application-level fixes (input isolation, output validation, tool permissions), not just prompt wording.",
        }
    try:
        parsed = json.loads(_extract_json_object(result.text))
        return {
            "suggested_system_prompt": str(parsed.get("suggested_system_prompt", original_prompt)),
            "rationale": str(parsed.get("rationale", "")),
            "note": str(parsed.get("note", "Some failures may need application-level fixes (input isolation, output validation, tool permissions), not just prompt wording.")),
        }
    except (json.JSONDecodeError, ValueError):
        return {
            "suggested_system_prompt": original_prompt,
            "rationale": "Could not parse judge suggestion.",
            "note": "Some failures may need application-level fixes (input isolation, output validation, tool permissions), not just prompt wording.",
        }
