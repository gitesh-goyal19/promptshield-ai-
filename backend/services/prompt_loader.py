"""Load prompt templates from the /prompts directory at runtime."""

import os
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"

_PRESETS = {
    "university_helpdesk": "preset_university_helpdesk.md",
    "customer_support": "preset_customer_support.md",
    "banking_faq": "preset_banking_faq.md",
}

_GENERATORS = {
    "test_generator": "test_generator.md",
    "evaluator": "evaluator.md",
    "prompt_improver": "prompt_improver.md",
}


def _read(filename: str) -> str:
    path = PROMPTS_DIR / filename
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def list_presets() -> list[dict]:
    """Return preset metadata: id, title, and the system prompt text."""
    titles = {
        "university_helpdesk": "University Helpdesk",
        "customer_support": "Customer Support",
        "banking_faq": "Banking FAQ",
    }
    out = []
    for pid, filename in _PRESETS.items():
        text = _read(filename)
        # system prompt is everything before "Sample tests:"
        system_prompt = text.split("Sample tests:", 1)[0].strip() if "Sample tests:" in text else text.strip()
        out.append({
            "id": pid,
            "title": titles.get(pid, pid),
            "system_prompt": system_prompt,
            "source": filename,
        })
    return out


def get_preset(preset_id: str) -> dict | None:
    for p in list_presets():
        if p["id"] == preset_id:
            return p
    return None


def load_prompt(name: str) -> str:
    """Load a named prompt template (test_generator, evaluator, prompt_improver)."""
    filename = _GENERATORS.get(name)
    if not filename:
        return ""
    return _read(filename)
