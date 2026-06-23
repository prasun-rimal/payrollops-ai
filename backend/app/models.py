from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, DateTime, Enum as SqlEnum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CaseStatus(str, Enum):
    open = "open"
    approved = "approved"
    dismissed = "dismissed"


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class UserRole(str, Enum):
    admin = "admin"
    reviewer = "reviewer"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), default=UserRole.reviewer)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class PortableVector(TypeDecorator):
    impl = JSON
    cache_ok = True

    def __init__(self, dimensions: int = 1536) -> None:
        super().__init__()
        self.dimensions = dimensions

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector(self.dimensions))
        return dialect.type_descriptor(JSON())


class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    period: Mapped[str] = mapped_column(String(40))
    country_count: Mapped[int] = mapped_column(default=0)
    worker_count: Mapped[int] = mapped_column(default=0)
    gross_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(String(30), default="review_required")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    cases: Mapped[list["ExceptionCase"]] = relationship(back_populates="payroll_run", cascade="all, delete-orphan")


class ExceptionCase(Base):
    __tablename__ = "exception_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    payroll_run_id: Mapped[int] = mapped_column(ForeignKey("payroll_runs.id"), index=True)
    worker_id: Mapped[str] = mapped_column(String(40), index=True)
    worker_name: Mapped[str] = mapped_column(String(120))
    country: Mapped[str] = mapped_column(String(80))
    rule_code: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(180))
    severity: Mapped[Severity] = mapped_column(SqlEnum(Severity))
    status: Mapped[CaseStatus] = mapped_column(SqlEnum(CaseStatus), default=CaseStatus.open)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    explanation: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str] = mapped_column(Text)
    policy_citation: Mapped[str] = mapped_column(Text)
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), default=0)
    assigned_to: Mapped[str] = mapped_column(String(120), default="Unassigned")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    payroll_run: Mapped[PayrollRun] = relationship(back_populates="cases")
    events: Mapped[list["AuditEvent"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    reviews: Mapped[list["AIReview"]] = relationship(back_populates="case", cascade="all, delete-orphan")


class AIReview(Base):
    __tablename__ = "ai_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("exception_cases.id"), index=True)
    provider: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(120))
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), default=0)
    policy_citation: Mapped[str] = mapped_column(Text)
    fallback_reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    case: Mapped[ExceptionCase] = relationship(back_populates="reviews")


class PolicyChunk(Base):
    __tablename__ = "policy_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_name: Mapped[str] = mapped_column(String(160))
    section: Mapped[str] = mapped_column(String(160))
    content: Mapped[str] = mapped_column(Text)
    country: Mapped[str] = mapped_column(String(80), default="Global")
    embedding: Mapped[list[float]] = mapped_column(PortableVector(1536))


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int | None] = mapped_column(ForeignKey("exception_cases.id"), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    actor: Mapped[str] = mapped_column(String(120), default="system")
    detail: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    case: Mapped[ExceptionCase | None] = relationship(back_populates="events")
