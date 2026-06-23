from collections import Counter
from decimal import Decimal


EXPECTED_CURRENCY = {"United States": "USD", "United Kingdom": "GBP", "Canada": "CAD", "Germany": "EUR"}


def validate_rows(rows: list[dict]) -> list[dict]:
    findings: list[dict] = []
    ids = Counter(row["worker_id"] for row in rows)

    for row in rows:
        base = {
            "worker_id": row["worker_id"],
            "worker_name": row["worker_name"],
            "country": row["country"],
            "amount": Decimal(str(row["gross_pay"])),
        }
        if ids[row["worker_id"]] > 1:
            findings.append({
                **base,
                "rule_code": "DUPLICATE_WORKER",
                "title": "Duplicate worker in payroll run",
                "severity": "critical",
                "explanation": "The worker appears more than once in the same payroll run, creating a material duplicate-payment risk.",
                "recommendation": "Place both records on hold and reconcile the worker identifier before releasing payment.",
            })
        expected = EXPECTED_CURRENCY.get(row["country"])
        if expected and row["currency"] != expected:
            findings.append({
                **base,
                "rule_code": "CURRENCY_MISMATCH",
                "title": "Currency does not match worker country",
                "severity": "high",
                "explanation": f"The record uses {row['currency']} although the configured payroll currency for {row['country']} is {expected}.",
                "recommendation": "Confirm the worker's employing entity and contract currency before recalculating the payment.",
            })
        if not row.get("tax_id"):
            findings.append({
                **base,
                "rule_code": "MISSING_TAX_ID",
                "title": "Required tax identifier is missing",
                "severity": "high",
                "explanation": "The payroll record is missing a tax identifier required by the configured pre-payment controls.",
                "recommendation": "Request the missing identifier and block payment until the worker record is complete.",
            })
        if Decimal(str(row["net_pay"])) <= 0:
            findings.append({
                **base,
                "rule_code": "NON_POSITIVE_NET_PAY",
                "title": "Net pay is zero or negative",
                "severity": "critical",
                "explanation": "Deductions reduce this worker's net pay to zero or below, which requires manual payroll review.",
                "recommendation": "Verify deductions, adjustments, and prior-period corrections before finalizing payroll.",
            })
        if row.get("contractor") and not row.get("contract_end_date"):
            findings.append({
                **base,
                "rule_code": "MISSING_CONTRACT_END",
                "title": "Contractor agreement date is incomplete",
                "severity": "medium",
                "explanation": "The worker is classified as a contractor but has no contract end date in the source record.",
                "recommendation": "Confirm the active agreement period with contractor operations before approval.",
            })
    return findings

