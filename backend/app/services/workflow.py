from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import AIReview, AuditEvent, ExceptionCase, PayrollRun
from app.services.graph import build_exception_workflow
from app.services.validation import validate_rows


def create_payroll_run(db: Session, name: str, period: str, rows: list[dict]) -> PayrollRun:
    run = PayrollRun(
        name=name,
        period=period,
        country_count=len({row["country"] for row in rows}),
        worker_count=len(rows),
        gross_total=sum(Decimal(str(row["gross_pay"])) for row in rows),
    )
    db.add(run)
    db.flush()

    workflow = build_exception_workflow(db)
    finding_count = 0
    for finding in validate_rows(rows):
        result = workflow.invoke({"finding": finding})
        analysis = result["analysis"]
        case = ExceptionCase(
            payroll_run_id=run.id,
            worker_id=finding["worker_id"],
            worker_name=finding["worker_name"],
            country=finding["country"],
            rule_code=finding["rule_code"],
            title=finding["title"],
            severity=analysis.severity,
            amount=finding["amount"],
            explanation=analysis.explanation,
            recommendation=analysis.recommendation,
            policy_citation=analysis.policy_citation,
            confidence=Decimal(str(analysis.confidence)),
            assigned_to="Payroll Operations" if analysis.severity.value in {"critical", "high"} else "Contractor Operations",
        )
        db.add(case)
        db.flush()
        db.add(AIReview(
            case_id=case.id,
            provider=result["analysis_provider"],
            model=result["analysis_model"],
            confidence=Decimal(str(analysis.confidence)),
            policy_citation=analysis.policy_citation,
            fallback_reason=result.get("fallback_reason"),
        ))
        db.add(AuditEvent(
            case_id=case.id,
            event_type="case_created",
            detail=f"Validation finding classified by {result['analysis_provider']} and routed for review.",
        ))
        finding_count += 1

    run.status = "review_required" if finding_count else "ready"
    db.add(AuditEvent(
        event_type="payroll_ingested",
        detail=f"Processed {len(rows)} synthetic payroll rows and created {finding_count} review cases.",
    ))
    db.commit()
    db.refresh(run)
    return run
