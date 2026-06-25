import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_session
from sqlalchemy.orm import Session
from src.main import app
from src.db.session import get_db
from src.models.case import Case, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from datetime import date

# Setup a test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_temp.db"

@pytest.fixture
def client():
    # For simplicity in this test script, we just use the existing dev app
    # In a real test we'd override get_db to use a test sqlite db.
    with TestClient(app) as c:
        yield c

def test_export_with_filters(client):
    # This test assumes there are some cases in the DB.
    # We call the new POST endpoint for table.xlsx with a filter
    payload = {
        "columns": ["vk_number", "TRI-S", "audit_trail"],
        "filters": {
            "include_excluded": True,
            "problematic_only": False
        }
    }
    
    response = client.post("/api/exports/table.xlsx", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(response.content) > 0
    print("\nXLSX Export Success: received", len(response.content), "bytes")

    # Test CSV
    response_csv = client.post("/api/exports/table.csv", json=payload)
    assert response_csv.status_code == 200
    assert response_csv.headers["content-type"] == "text/csv"
    # Check if header matches mapping
    content = response_csv.content.decode("utf-8")
    assert "vk_number" in content
    assert "TRI-S" in content
    assert "audit_trail" in content
    print("CSV Export Success: received", len(response_csv.content), "bytes")

if __name__ == "__main__":
    # If run directly, try to execute the test logic
    import sys
    from fastapi.testclient import TestClient
    from src.main import app
    
    with TestClient(app) as client:
        try:
            test_export_with_filters(client)
            print("Tests PASSED")
        except Exception as e:
            print(f"Tests FAILED: {e}")
            sys.exit(1)
