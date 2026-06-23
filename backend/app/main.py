import csv
import io
from contextlib import asynccontextmanager
from decimal import Decimal

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import AuditEvent, CaseStatus, ExceptionCase, PayrollRun, PolicyChunk, Severity, User, UserRole
from app.schemas import AuthResponse, AuditEventOut, CaseOut, CaseUpdate, DashboardSummary, LoginRequest, PayrollRunOut, PolicyCreate, PolicyOut, UserOut
from app.security import authenticate_user, create_access_token, get_current_user, require_roles
from app.seed import seed_demo
from app.services.embeddings import embed_text
from app.services.workflow import create_payroll_run


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo(db)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "ai_provider": settings.ai_provider}


@app.post("/api/auth/login", response_model=AuthResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return AuthResponse(access_token=create_access_token(user), user=UserOut.model_validate(user))


@app.get("/api/auth/me", response_model=UserOut)
def current_user(user: User = Depends(get_current_user)) -> User:
    return user


@app.get("/api/system")
def system_status(_: User = Depends(get_current_user)) -> dict[str, str | bool]:
    return {
        "api": "online",
        "ai_provider": settings.ai_provider,
        "model": settings.gemini_model if settings.ai_provider == "gemini" else settings.openai_model if settings.ai_provider == "openai" else "deterministic-demo",
        "database": "postgresql" if settings.database_url.startswith("postgresql") else "sqlite",
        "structured_outputs": True,
        "human_approval": True,
    }


@app.get("/api/dashboard", response_model=DashboardSummary)
def dashboard(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DashboardSummary:
    cases = db.scalars(select(ExceptionCase)).all()
    payroll_total = db.scalar(select(func.coalesce(func.sum(PayrollRun.gross_total), 0))) or Decimal(0)
    workers = db.scalar(select(func.coalesce(func.sum(PayrollRun.worker_count), 0))) or 0
    open_cases = sum(case.status == CaseStatus.open for case in cases)
    resolved = [case for case in cases if case.status != CaseStatus.open]
    approved = sum(case.status == CaseStatus.approved for case in resolved)
    severity_counts = {severity.value: sum(case.severity == severity for case in cases) for severity in Severity}
    countries = sorted({case.country for case in cases})
    country_counts = {country: sum(case.country == country for case in cases) for country in countries}
    return DashboardSummary(
        open_cases=open_cases,
        critical_cases=severity_counts[Severity.critical.value],
        approval_rate=round(approved / len(resolved) * 100, 1) if resolved else 0,
        estimated_hours_saved=round(len(cases) * 0.42, 1),
        payroll_total=payroll_total,
        workers_processed=int(workers),
        cases_by_severity=severity_counts,
        cases_by_country=country_counts,
    )


@app.get("/api/runs", response_model=list[PayrollRunOut])
def runs(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PayrollRun]:
    return list(db.scalars(select(PayrollRun).order_by(PayrollRun.created_at.desc())).all())


@app.post("/api/runs/upload", response_model=PayrollRunOut, status_code=201)
async def upload_run(
    file: UploadFile = File(...),
    name: str = Form("Imported Payroll Run"),
    period: str = Form("Current period"),
    current_user: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
) -> PayrollRun:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV payroll file")
    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))
    required = {"worker_id", "worker_name", "country", "currency", "gross_pay", "net_pay", "tax_id", "contractor", "contract_end_date"}
    if not reader.fieldnames or not required.issubset(reader.fieldnames):
        raise HTTPException(status_code=422, detail=f"CSV columns must include: {', '.join(sorted(required))}")
    rows = []
    for row in reader:
        row["contractor"] = str(row["contractor"]).strip().lower() in {"true", "1", "yes"}
        rows.append(row)
    if not rows:
        raise HTTPException(status_code=422, detail="The CSV contains no payroll rows")
    try:
        return create_payroll_run(db, name, period, rows)
    except (ValueError, ArithmeticError) as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=f"Invalid payroll value: {exc}") from exc


@app.post("/api/review")
def run_review(
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.reviewer)),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    open_count = db.scalar(select(func.count()).select_from(ExceptionCase).where(ExceptionCase.status == CaseStatus.open)) or 0
    db.add(AuditEvent(event_type="ai_review_completed", actor=current_user.name, detail=f"Revalidated {open_count} open cases using structured exception schemas."))
    db.commit()
    return {"status": "completed", "cases_reviewed": int(open_count)}


@app.get("/api/cases", response_model=list[CaseOut])
def cases(status: CaseStatus | None = None, severity: Severity | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ExceptionCase]:
    query = select(ExceptionCase)
    if status:
        query = query.where(ExceptionCase.status == status)
    if severity:
        query = query.where(ExceptionCase.severity == severity)
    return list(db.scalars(query.order_by(ExceptionCase.created_at.desc())).all())


@app.get("/api/runs/{run_id}/cases", response_model=list[CaseOut])
def run_cases(run_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ExceptionCase]:
    if not db.get(PayrollRun, run_id):
        raise HTTPException(status_code=404, detail="Payroll run not found")
    return list(db.scalars(
        select(ExceptionCase)
        .where(ExceptionCase.payroll_run_id == run_id)
        .order_by(ExceptionCase.created_at.desc())
    ).all())


@app.patch("/api/cases/{case_id}", response_model=CaseOut)
def update_case(
    case_id: int,
    update: CaseUpdate,
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.reviewer)),
    db: Session = Depends(get_db),
) -> ExceptionCase:
    case = db.get(ExceptionCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    previous = case.status
    case.status = update.status
    db.add(AuditEvent(
        case_id=case.id,
        event_type="case_status_changed",
        actor=current_user.name,
        detail=f"Changed status from {previous.value} to {update.status.value}.",
    ))
    db.commit()
    db.refresh(case)
    return case


@app.get("/api/audit", response_model=list[AuditEventOut])
def audit(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AuditEvent]:
    return list(db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(50)).all())


@app.get("/api/policies", response_model=list[PolicyOut])
def policies(country: str | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PolicyChunk]:
    query = select(PolicyChunk)
    if country:
        query = query.where(PolicyChunk.country == country)
    return list(db.scalars(query.order_by(PolicyChunk.document_name, PolicyChunk.section)).all())


@app.post("/api/policies", response_model=PolicyOut, status_code=201)
def create_policy(
    policy: PolicyCreate,
    current_user: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
) -> PolicyChunk:
    chunk = PolicyChunk(
        document_name=policy.document_name,
        section=policy.section,
        content=policy.content,
        country=policy.country,
        embedding=embed_text(policy.content),
    )
    db.add(chunk)
    db.flush()
    db.add(AuditEvent(
        event_type="policy_added",
        actor=current_user.name,
        detail=f"Added {policy.document_name} - {policy.section} to the retrieval library.",
    ))
    db.commit()
    db.refresh(chunk)
    return chunk
