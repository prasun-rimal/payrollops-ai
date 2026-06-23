from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PayrollRun, PolicyChunk, User, UserRole
from app.security import hash_password
from app.services.embeddings import embed_text
from app.services.workflow import create_payroll_run
from app.config import get_settings


POLICIES = [
    ("Global Payroll Controls", "Duplicate payments", "Global", "Every payroll run must contain one payment record per worker identifier. Duplicate records must be held for manual reconciliation before funds are released."),
    ("Global Payroll Controls", "Required worker data", "Global", "Payments must not be approved when required tax identifiers or contractual dates are missing. Operations must complete the worker record and preserve the review evidence."),
    ("United States Payroll Guide", "Payment currency", "United States", "United States payroll records are processed in USD unless an approved employing-entity exception is documented."),
    ("United Kingdom Payroll Guide", "Payment currency", "United Kingdom", "United Kingdom payroll records are processed in GBP. Currency exceptions require an approved contract and payroll operations review."),
    ("Global Payroll Controls", "Non-positive pay", "Global", "Any zero or negative net payment must be blocked and reviewed for deduction errors, retroactive adjustments, or prior-period corrections."),
]

ROWS = [
    {"worker_id": "US-1042", "worker_name": "Maya Chen", "country": "United States", "currency": "USD", "gross_pay": "8200", "net_pay": "5918", "tax_id": "US-XXX-42", "contractor": False, "contract_end_date": ""},
    {"worker_id": "GB-2091", "worker_name": "Theo Martin", "country": "United Kingdom", "currency": "USD", "gross_pay": "6400", "net_pay": "4720", "tax_id": "GB-XXX-91", "contractor": False, "contract_end_date": ""},
    {"worker_id": "CA-3308", "worker_name": "Nora Singh", "country": "Canada", "currency": "CAD", "gross_pay": "7100", "net_pay": "5185", "tax_id": "", "contractor": False, "contract_end_date": ""},
    {"worker_id": "US-4410", "worker_name": "Eli Brooks", "country": "United States", "currency": "USD", "gross_pay": "9400", "net_pay": "-120", "tax_id": "US-XXX-10", "contractor": False, "contract_end_date": ""},
    {"worker_id": "DE-5522", "worker_name": "Lena Fischer", "country": "Germany", "currency": "EUR", "gross_pay": "5900", "net_pay": "4012", "tax_id": "DE-XXX-22", "contractor": True, "contract_end_date": ""},
    {"worker_id": "US-1042", "worker_name": "Maya Chen", "country": "United States", "currency": "USD", "gross_pay": "8200", "net_pay": "5918", "tax_id": "US-XXX-42", "contractor": False, "contract_end_date": ""},
    {"worker_id": "GB-7715", "worker_name": "Amelia Wood", "country": "United Kingdom", "currency": "GBP", "gross_pay": "6900", "net_pay": "5011", "tax_id": "GB-XXX-15", "contractor": False, "contract_end_date": ""},
    {"worker_id": "CA-8820", "worker_name": "Owen Taylor", "country": "Canada", "currency": "CAD", "gross_pay": "7500", "net_pay": "5390", "tax_id": "CA-XXX-20", "contractor": False, "contract_end_date": ""},
]


def seed_demo(db: Session) -> None:
    demo_users = [
        ("Prasun Rimal", "admin@payrollops.demo", "DemoAdmin!2026", UserRole.admin),
        ("Jordan Lee", "reviewer@payrollops.demo", "DemoReviewer!2026", UserRole.reviewer),
    ]
    for name, email, password, role in demo_users:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(name=name, email=email, password_hash=hash_password(password), role=role))
    db.commit()

    if db.scalar(select(func.count()).select_from(PayrollRun)):
        if get_settings().ai_provider in {"gemini", "openai"}:
            for policy in db.scalars(select(PolicyChunk)).all():
                policy.embedding = embed_text(policy.content)
            db.commit()
        return

    for document, section, country, content in POLICIES:
        db.add(PolicyChunk(document_name=document, section=section, country=country, content=content, embedding=embed_text(content)))
    db.flush()

    create_payroll_run(db, "June 2026 Global Payroll", "Jun 1-15, 2026", ROWS)
