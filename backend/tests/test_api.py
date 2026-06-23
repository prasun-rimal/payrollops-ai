import os
from pathlib import Path

from fastapi.testclient import TestClient


test_database = Path("/tmp/payrollops-api-tests.db")
test_database.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{test_database}"

from app.main import app


def login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_dashboard_and_case_workflow():
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"

        headers = login(client, "reviewer@payrollops.demo", "DemoReviewer!2026")
        me = client.get("/api/auth/me", headers=headers)
        assert me.json()["role"] == "reviewer"

        dashboard = client.get("/api/dashboard", headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()["workers_processed"] >= 8

        cases = client.get("/api/cases", headers=headers)
        assert cases.status_code == 200
        first_case = cases.json()[0]

        updated = client.patch(f"/api/cases/{first_case['id']}", json={"status": "approved"}, headers=headers)
        assert updated.status_code == 200
        assert updated.json()["status"] == "approved"

        review = client.post("/api/review", headers=headers)
        assert review.status_code == 200
        assert review.json()["status"] == "completed"

        policies = client.get("/api/policies", headers=headers)
        assert policies.status_code == 200
        assert len(policies.json()) >= 5

        system = client.get("/api/system", headers=headers)
        assert system.status_code == 200
        assert system.json()["structured_outputs"] is True


def test_upload_rejects_wrong_columns():
    with TestClient(app) as client:
        headers = login(client, "admin@payrollops.demo", "DemoAdmin!2026")
        response = client.post(
            "/api/runs/upload",
            headers=headers,
            files={"file": ("bad.csv", "name,value\na,1\n", "text/csv")},
            data={"name": "Bad import", "period": "Test"},
        )
        assert response.status_code == 422


def test_authentication_and_role_permissions():
    with TestClient(app) as client:
        assert client.get("/api/dashboard").status_code == 401
        invalid = client.post("/api/auth/login", json={"email": "admin@payrollops.demo", "password": "WrongPassword!"})
        assert invalid.status_code == 401

        reviewer_headers = login(client, "reviewer@payrollops.demo", "DemoReviewer!2026")
        forbidden = client.post(
            "/api/policies",
            headers=reviewer_headers,
            json={"document_name": "Test Policy", "section": "Reviewer access", "country": "Global", "content": "Reviewers must not be able to create policy sections."},
        )
        assert forbidden.status_code == 403

        admin_headers = login(client, "admin@payrollops.demo", "DemoAdmin!2026")
        created = client.post(
            "/api/policies",
            headers=admin_headers,
            json={"document_name": "Test Policy", "section": "Admin access", "country": "Global", "content": "Administrators may create grounded policy sections for testing."},
        )
        assert created.status_code == 201
