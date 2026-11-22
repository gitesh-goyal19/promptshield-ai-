import os
from dotenv import load_dotenv
load_dotenv()
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db import init_db
from api import projects, targets, prompts, playground, models, presets, demo, tests, runs

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./promptshield.db")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

REQUEST_DELAY_SECONDS = float(os.getenv("REQUEST_DELAY_SECONDS", "4"))
MAX_TESTS_PER_RUN = int(os.getenv("MAX_TESTS_PER_RUN", "15"))
DAILY_CALL_CAP = int(os.getenv("DAILY_CALL_CAP", "100"))
APP_ACCESS_CODE = os.getenv("APP_ACCESS_CODE", "")

# Simple per-IP rate limiter and daily call counter (in-memory, resets on restart)
_ip_timestamps: dict[str, list[float]] = {}
_daily_calls: dict[str, int] = {}


def _is_model_calling(request: Request) -> bool:
    path = request.url.path
    if request.method == "POST":
        if path == "/api/playground/chat":
            return True
        if path == "/api/demo/run":
            return True
        if path.startswith("/api/projects/") and ("/tests/generate" in path or "/runs" in path):
            return True
    return False


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit_ok(ip: str) -> bool:
    now = time.time()
    window = _ip_timestamps.setdefault(ip, [])
    window[:] = [t for t in window if now - t < 60]
    if len(window) >= 30:
        return False
    window.append(now)
    return True


def _daily_cap_ok(ip: str) -> bool:
    if DAILY_CALL_CAP <= 0:
        return True
    today = time.strftime("%Y-%m-%d")
    key = f"{ip}:{today}"
    count = _daily_calls.get(key, 0)
    if count >= DAILY_CALL_CAP:
        return False
    _daily_calls[key] = count + 1
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="PromptShield AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN] if FRONTEND_ORIGIN else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def quota_and_access_middleware(request: Request, call_next):
    ip = _client_ip(request)
    if _is_model_calling(request):
        if APP_ACCESS_CODE:
            provided = request.headers.get("X-App-Access-Code", "")
            if provided != APP_ACCESS_CODE:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid or missing app access code"},
                )
        if not _rate_limit_ok(ip):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Per-IP rate limit exceeded. Try again later."},
            )
        if not _daily_cap_ok(ip):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Daily call cap exceeded. Try again tomorrow."},
            )
    response = await call_next(request)
    return response


app.include_router(projects.router, prefix="/api")
app.include_router(targets.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")
app.include_router(playground.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(presets.router, prefix="/api")
app.include_router(demo.router, prefix="/api")
app.include_router(tests.router, prefix="/api")
app.include_router(runs.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"name": "PromptShield AI", "status": "running"}
