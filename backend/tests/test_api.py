from fastapi.testclient import TestClient

from app.main import app


def test_dashboard_and_case_workflow():
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"

        dashboard = client.get("/api/dashboard")
        assert dashboard.status_code == 200
        assert dashboard.json()["workers_processed"] >= 8

        cases = client.get("/api/cases")
        assert cases.status_code == 200
        first_case = cases.json()[0]

        updated = client.patch(f"/api/cases/{first_case['id']}", json={"status": "approved", "actor": "Test operator"})
        assert updated.status_code == 200
        assert updated.json()["status"] == "approved"

        review = client.post("/api/review")
        assert review.status_code == 200
        assert review.json()["status"] == "completed"


def test_upload_rejects_wrong_columns():
    with TestClient(app) as client:
        response = client.post(
            "/api/runs/upload",
            files={"file": ("bad.csv", "name,value\na,1\n", "text/csv")},
            data={"name": "Bad import", "period": "Test"},
        )
        assert response.status_code == 422
