"""Report generation: Markdown and PDF.

Reports describe observed behavior under tested conditions, not a security guarantee.
"""

import os
from datetime import datetime
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

REPORTS_DIR = Path(__file__).resolve().parents[2] / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

LIMITATIONS = (
    "Limitations disclaimer: Results describe observed behavior under tested conditions only. "
    "They are not a security guarantee, do not cover all possible inputs, and do not assess "
    "third-party systems. Use only synthetic test data. Free-tier model data may be used by "
    "the provider to improve products."
)


def _html_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def generate_markdown(project, target, versions, results, comparison=None, review_events=None, mode="gemini") -> str:
    lines = []
    lines.append("# PromptShield AI - Test Report")
    lines.append("")
    lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
    lines.append(f"Project: {project.name}")
    lines.append(f"Project ID: {project.id}")
    lines.append(f"Mode / Provider: {mode}")
    lines.append("")
    if target:
        lines.append(f"Target model: {target.model_id}")
        lines.append(f"Target provider: {target.provider}")
    lines.append("")
    lines.append("## Authorization")
    lines.append(f"Authorization confirmed: {project.authorization_confirmed}")
    lines.append("")
    lines.append("## Limitations")
    lines.append(LIMITATIONS)
    lines.append("")

    lines.append("## Prompt Versions")
    for v in versions or []:
        lines.append(f"### v{v.version_no} (created {v.created_at})")
        lines.append("```")
        lines.append(v.system_prompt)
        lines.append("```")
        lines.append("")

    lines.append("## Test Results")
    lines.append("")
    total = len(results or [])
    passes = sum(1 for r in (results or []) if r.verdict == "Pass")
    fails = sum(1 for r in (results or []) if r.verdict == "Fail")
    reviews = sum(1 for r in (results or []) if r.verdict == "Needs Review")
    errors = sum(1 for r in (results or []) if r.verdict == "Error")
    blocked = sum(1 for r in (results or []) if r.verdict == "Blocked by provider")
    lines.append(f"- Total results: {total}")
    lines.append(f"- Pass: {passes}")
    lines.append(f"- Fail: {fails}")
    lines.append(f"- Needs Review: {reviews}")
    lines.append(f"- Error: {errors}")
    lines.append(f"- Blocked by provider: {blocked}")
    lines.append("")

    for r in (results or []):
        lines.append(f"### Result {r.id} (test {r.test_case_id})")
        lines.append(f"- Verdict: {r.verdict}")
        lines.append(f"- Reason: {r.reason or '—'}")
        if r.evidence:
            lines.append(f"- Evidence: {_html_escape(r.evidence)[:300]}")
        lines.append(f"- Latency: {r.latency_ms} ms")
        if r.error:
            lines.append(f"- Error: {r.error}")
        lines.append("")

    if comparison:
        lines.append("## Comparison (Run B vs Run A)")
        lines.append(f"- Matched tests: {comparison.get('matched_tests', 0)}")
        lines.append(f"- Newly fixed: {len(comparison.get('newly_fixed', []))}")
        lines.append(f"- New regressions: {len(comparison.get('new_regressions', []))}")
        lines.append(f"- Benign false-refusal rate: {comparison.get('benign_false_refusal_rate', 0)}%")
        lines.append("")

    lines.append("## Disclaimer")
    lines.append(LIMITATIONS)
    lines.append("")

    return "\n".join(lines)


def generate_pdf(project, target, versions, results, comparison=None, mode="gemini") -> str:
    filename = f"report_{project.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    path = REPORTS_DIR / filename
    doc = SimpleDocTemplate(str(path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("PromptShield AI - Test Report", styles["Title"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Generated: {datetime.utcnow().isoformat()}Z", styles["Normal"]))
    story.append(Paragraph(f"Project: {_html_escape(project.name)} (ID {project.id})", styles["Normal"]))
    story.append(Paragraph(f"Mode / Provider: {mode}", styles["Normal"]))
    if target:
        story.append(Paragraph(f"Target model: {target.model_id}", styles["Normal"]))
        story.append(Paragraph(f"Target provider: {target.provider}", styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Limitations", styles["Heading2"]))
    story.append(Paragraph(LIMITATIONS, styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Prompt Versions", styles["Heading2"]))
    for v in versions or []:
        story.append(Paragraph(f"v{v.version_no} (created {v.created_at})", styles["Heading3"]))
        story.append(Paragraph(_html_escape(v.system_prompt)[:500], styles["Normal"]))
        story.append(Spacer(1, 6))

    story.append(Paragraph("Test Results Summary", styles["Heading2"]))
    total = len(results or [])
    passes = sum(1 for r in (results or []) if r.verdict == "Pass")
    fails = sum(1 for r in (results or []) if r.verdict == "Fail")
    reviews = sum(1 for r in (results or []) if r.verdict == "Needs Review")
    errors = sum(1 for r in (results or []) if r.verdict == "Error")
    blocked = sum(1 for r in (results or []) if r.verdict == "Blocked by provider")
    data = [
        ["Metric", "Count"],
        ["Total", str(total)],
        ["Pass", str(passes)],
        ["Fail", str(fails)],
        ["Needs Review", str(reviews)],
        ["Error", str(errors)],
        ["Blocked by provider", str(blocked)],
    ]
    table = Table(data, colWidths=[200, 100])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Disclaimer", styles["Heading2"]))
    story.append(Paragraph(LIMITATIONS, styles["Normal"]))

    doc.build(story)
    return str(path)
