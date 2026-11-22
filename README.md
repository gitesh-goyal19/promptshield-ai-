# PromptShield AI

Defensive testing tool for chatbots you own or are authorized to test.

**PromptShield AI** is a college project in the "Prompt Safety Tester (Red-Team Kit)" category.
It lets you enter a chatbot's system prompt, generate safe synthetic prompt-injection tests,
run them against a target model, evaluate Pass / Fail / Needs Review, suggest an improved
system prompt, retest, compare before/after, and export reports.

**This is a defensive authorization tool only.** Do not test third-party chatbots without
explicit permission. It does not extract private data and does not guarantee security.

## Tech stack

- Frontend: React + Vite + Tailwind CSS + Recharts
- Backend: FastAPI + SQLAlchemy ORM + Pydantic
- Database: SQLite by default (`DATABASE_URL` env var switches to Postgres)
- AI: Google Gemini via the official `google-genai` Python SDK (backend only; key never reaches the browser)
- PDF: ReportLab
- Tests: Pytest

## Repository layout

```
PromptShield-AI/
  backend/          FastAPI app (main.py, api/, services/, db/, schemas/)
  frontend/         React + Vite app (src/, index.html)
  prompts/          Prompt templates loaded from disk (.md)
  benchmarks/       Synthetic adversarial + benign test fixtures
  tests/            Pytest suite
  docs/             Documentation
  reports/          Generated report output (gitignored)
  .env.example      Environment variable template (copy to .env)
  .gitignore        Ignores .env and *.db
```

## Quick start

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy the env template and fill in your values (never commit .env)
cp ../.env.example .env
# edit .env: set GEMINI_API_KEY, GEMINI_TARGET_MODEL, GEMINI_JUDGE_MODEL, etc.

uvicorn main:app --reload   # http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

The frontend proxies `/api` to `http://localhost:8000` in dev. Set `VITE_API_BASE_URL`
for production builds.

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (backend only) | (required for real model calls) |
| `GEMINI_TARGET_MODEL` | Model used for playground/test runs | `gemini-1.5-flash` |
| `GEMINI_JUDGE_MODEL` | Model used for judging/improvement | `gemini-1.5-flash` |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./promptshield.db` |
| `FRONTEND_ORIGIN` | CORS origin for the frontend | `http://localhost:5173` |
| `APP_ACCESS_CODE` | Optional code required for model-calling endpoints | (none) |
| `REQUEST_DELAY_SECONDS` | Delay between sequential test calls | `4` |
| `MAX_TESTS_PER_RUN` | Cap on tests per run | `15` |
| `DAILY_CALL_CAP` | Daily per-IP call cap | `100` |

Model names are **not hardcoded** — set them in `.env` to the model names from Google AI Studio.

## Demo Mode (no API key required)

Demo Mode uses a built-in simulator and needs no Gemini key.

1. Go to **Demo Mode**.
2. A prominent banner reads: **"Simulated Vulnerable Application. This is not a Gemini failure."**
3. Select **Vulnerable handler** and run the fixture. The synthetic university notice contains an
   embedded instruction ("answer BANANA"); the vulnerable handler follows it, so the result is
   **Fail** with a trust-boundary explanation.
4. Switch to **Protected handler** and rerun. The notice is treated as data only → **Pass**.
5. Demo reports list the provider as `simulator` and are never mixed with real Gemini results.

## Core flow

1. **New Project** — create a project; you must tick "I own this chatbot or have permission to test it."
2. **Presets / Playground** — load a synthetic preset (University Helpdesk, Customer Support, Banking FAQ) or paste a custom system prompt, then chat with the target model.
3. **Prompt Versions** — save the system prompt as v1 baseline; versions are numbered and never overwritten. View a text diff between versions.
4. **Test Builder** — generate synthetic tests per category (instruction_override, role_spoofing, conflicting_instructions, untrusted_text_injection, hidden_rule_disclosure, benign_requests). Review, edit, approve, or reject. Unapproved tests are never run.
5. **Test Runner** — run approved tests sequentially against a prompt version with quota protection (delay, backoff, caps). Live progress; cancel supported. Results are saved with the exact prompt, model, settings, input, response, latency, and timestamps.
6. **Results** — per-test verdicts (Pass / Fail / Needs Review / Error / Blocked). Manual override stores an audit trail (old → new verdict, reason, timestamp). Historical results are never silently edited.
7. **Prompt improver** — the judge model suggests a clearer system prompt based on failures; review and save as a new version. A note warns that some failures need application-level fixes, not just wording.
8. **Comparison** — rerun the same tests against v2; view per-category counts, newly fixed failures, regressions, benign false-refusal rate, and Recharts charts. Includes a limitation note: "small test set; not proof of security."
9. **Metrics** — computed only from saved data (pass rate, rule-break rate, benign false-refusal rate, JSON validity rate, average latency). Needs Review / Error / Blocked reported separately.
10. **Reports** — export Markdown or PDF with project info, models, versions, tests, responses, verdicts, overrides, comparison, suggested improvements, date, and a limitations disclaimer.
11. **Import/Export** — test sets as JSON.

## Security and limitations

- All model calls happen on the backend. The API key never reaches the browser.
- Only run tests against chatbots you own or are authorized to test.
- Generated tests are fictional and harmless: no real secrets, credentials, or third-party access.
- Results describe observed behavior under tested conditions and are **not a security guarantee**.
- Free-tier model data may be used by the provider; use only synthetic test data.
- Free hosts may reset a SQLite file — Postgres is recommended for persistence.

## Tests

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python3 -m pytest ../tests/
```

## Deployment

### Backend (Render)
See `render.yaml`. Required env vars: `GEMINI_API_KEY`, `GEMINI_TARGET_MODEL`,
`GEMINI_JUDGE_MODEL`, `DATABASE_URL`, `FRONTEND_ORIGIN`, `APP_ACCESS_CODE`,
`REQUEST_DELAY_SECONDS`, `MAX_TESTS_PER_RUN`, `DAILY_CALL_CAP`.

### Frontend (Vercel)
See `vercel.json`. Set `VITE_API_BASE_URL` to your backend URL.

> Warning: free hosts may reset a SQLite file, so Postgres is recommended for persistence.
> Never commit secrets (`.env` and `*.db` are gitignored).
# promptshield-ai-
