from app.services.validation import validate_rows


def test_detects_duplicate_and_currency_mismatch():
    rows = [
        {"worker_id": "W-1", "worker_name": "A", "country": "United States", "currency": "EUR", "gross_pay": "10", "net_pay": "8", "tax_id": "x", "contractor": False, "contract_end_date": ""},
        {"worker_id": "W-1", "worker_name": "A", "country": "United States", "currency": "USD", "gross_pay": "10", "net_pay": "8", "tax_id": "x", "contractor": False, "contract_end_date": ""},
    ]
    codes = [finding["rule_code"] for finding in validate_rows(rows)]
    assert codes.count("DUPLICATE_WORKER") == 2
    assert "CURRENCY_MISMATCH" in codes


def test_detects_missing_worker_data():
    rows = [
        {"worker_id": "W-2", "worker_name": "B", "country": "Canada", "currency": "CAD", "gross_pay": "10", "net_pay": "8", "tax_id": "", "contractor": True, "contract_end_date": ""},
    ]
    codes = {finding["rule_code"] for finding in validate_rows(rows)}
    assert codes == {"MISSING_TAX_ID", "MISSING_CONTRACT_END"}

