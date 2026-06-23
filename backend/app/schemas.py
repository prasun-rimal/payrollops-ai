from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import CaseStatus, Severity, UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: UserRole


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ExceptionAnalysis(BaseModel):
    severity: Severity
    explanation: str = Field(min_length=20)
    recommendation: str = Field(min_length=10)
    policy_citation: str = Field(min_length=5)
    confidence: float = Field(ge=0, le=1)


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payroll_run_id: int
    worker_id: str
    worker_name: str
    country: str
    rule_code: str
    title: str
    severity: Severity
    status: CaseStatus
    amount: Decimal
    explanation: str
    recommendation: str
    policy_citation: str
    confidence: Decimal
    assigned_to: str
    created_at: datetime
    updated_at: datetime


class CaseUpdate(BaseModel):
    status: CaseStatus


class PayrollRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    period: str
    country_count: int
    worker_count: int
    gross_total: Decimal
    status: str
    created_at: datetime


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int | None
    event_type: str
    actor: str
    detail: str
    created_at: datetime


class PolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_name: str
    section: str
    content: str
    country: str


class PolicyCreate(BaseModel):
    document_name: str = Field(min_length=3, max_length=160)
    section: str = Field(min_length=3, max_length=160)
    content: str = Field(min_length=20, max_length=5000)
    country: str = Field(default="Global", min_length=2, max_length=80)


class DashboardSummary(BaseModel):
    open_cases: int
    critical_cases: int
    approval_rate: float
    estimated_hours_saved: float
    payroll_total: Decimal
    workers_processed: int
    cases_by_severity: dict[str, int]
    cases_by_country: dict[str, int]
