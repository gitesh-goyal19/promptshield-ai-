from pydantic import BaseModel, ConfigDict, Field, constr
from typing import Optional, Any, Dict, List
from datetime import datetime


class HealthResponse(BaseModel):
    status: str = "ok"
    database: str = "connected"
    provider: str = "configured"


class ProjectBase(BaseModel):
    name: constr(strip_whitespace=True, min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=2000)
    authorization_confirmed: bool = False


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[constr(strip_whitespace=True, min_length=1, max_length=200)] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    authorization_confirmed: Optional[bool] = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class ModelInfo(BaseModel):
    target_model: str
    judge_model: str
    api_key_present: bool


class SettingsBase(BaseModel):
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)
    max_output_tokens: Optional[int] = Field(default=1000, ge=1, le=8192)


class TargetBase(SettingsBase):
    provider: constr(strip_whitespace=True, min_length=1, max_length=50)
    model_id: constr(strip_whitespace=True, min_length=1, max_length=200)


class TargetCreate(TargetBase):
    pass


class TargetOut(TargetBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


# ---------- Prompt versions ----------
class PromptVersionBase(BaseModel):
    system_prompt: constr(strip_whitespace=True, min_length=1, max_length=10000)


class PromptVersionCreate(PromptVersionBase):
    parent_version_id: Optional[int] = None


class PromptVersionOut(PromptVersionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    version_no: int
    parent_version_id: Optional[int] = None
    created_at: datetime


# ---------- Playground ----------
class ChatRequest(BaseModel):
    system_prompt: Optional[str] = Field(default="", max_length=4000)
    message: constr(strip_whitespace=True, min_length=1, max_length=4000)
    model: Optional[str] = None
    settings: Optional[dict] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    reply: str
    model: str
    provider: str
    latency_ms: int
    error: Optional[str] = None
    blocked: bool = False


# ---------- Test cases ----------
CATEGORY_CHOICES = [
    "instruction_override",
    "role_spoofing",
    "conflicting_instructions",
    "untrusted_text_injection",
    "hidden_rule_disclosure",
    "benign_requests",
]


class TestCaseBase(BaseModel):
    test_id: Optional[str] = Field(default=None, max_length=100)
    category: constr(strip_whitespace=True, min_length=1, max_length=100)
    attack_prompt: constr(strip_whitespace=True, min_length=1, max_length=4000)
    rule_being_tested: constr(strip_whitespace=True, min_length=1, max_length=2000)
    expected_behavior: constr(strip_whitespace=True, min_length=1, max_length=2000)
    evaluation_criteria: Optional[str] = Field(default="", max_length=2000)
    rubric_json: Optional[dict] = Field(default_factory=dict)
    approved: bool = False
    source: Optional[str] = Field(default="generated", max_length=50)


class TestCaseCreate(TestCaseBase):
    pass


class TestCaseUpdate(BaseModel):
    category: Optional[constr(strip_whitespace=True, min_length=1, max_length=100)] = None
    attack_prompt: Optional[constr(strip_whitespace=True, min_length=1, max_length=4000)] = None
    rule_being_tested: Optional[constr(strip_whitespace=True, min_length=1, max_length=2000)] = None
    expected_behavior: Optional[constr(strip_whitespace=True, min_length=1, max_length=2000)] = None
    evaluation_criteria: Optional[str] = Field(default=None, max_length=2000)
    rubric_json: Optional[dict] = None
    approved: Optional[bool] = None
    source: Optional[str] = Field(default=None, max_length=50)


class TestCaseOut(TestCaseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


class TestGenerateRequest(BaseModel):
    category: str
    n: int = Field(default=5, ge=1, le=20)
    system_prompt: Optional[str] = Field(default="", max_length=10000)


class TestGenerateResponse(BaseModel):
    generated: int
    fallback_used: bool
    tests: List[TestCaseOut]


# ---------- Test runs ----------
class TestRunCreate(BaseModel):
    target_id: int
    prompt_version_id: int
    mode: str = Field(default="gemini", max_length=50)
    settings: Optional[dict] = Field(default_factory=dict)
    max_tests: Optional[int] = Field(default=None, ge=1, le=100)


class TestRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    target_id: int
    prompt_version_id: int
    mode: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None


class TestResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    run_id: int
    test_case_id: int
    model_response: Optional[str] = None
    verdict: str
    reason: Optional[str] = None
    evidence: Optional[str] = None
    latency_ms: Optional[int] = None
    error: Optional[str] = None
    test_case: Optional[TestCaseOut] = None


# ---------- Manual review ----------
class ResultReviewRequest(BaseModel):
    new_verdict: str
    reason: Optional[str] = None


class ReviewEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    result_id: int
    old_verdict: str
    new_verdict: str
    reason: Optional[str] = None
    reviewed_at: datetime


class PromptSuggestRequest(BaseModel):
    prompt_version_id: int
    failures: Optional[list[dict]] = Field(default_factory=list)


