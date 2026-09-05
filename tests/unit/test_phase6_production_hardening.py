"""Unit tests for Phase 6: Production Hardening, Correlation ID, Health, and Security Boundaries."""
import os
import inspect
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app


@pytest.fixture(scope="module")
def hardening_client():
    return TestClient(app)


def test_health_liveness_endpoint(hardening_client):
    response = hardening_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "RecoverAI API"
    assert data["version"] == "1.0.0"


def test_api_health_endpoint(hardening_client):
    response = hardening_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_ready_readiness_endpoint(hardening_client):
    response = hardening_client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "llm_provider" in data
    assert "ml_model" in data


def test_api_ready_endpoint(hardening_client):
    response = hardening_client.get("/api/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ready", "not_ready")


def test_correlation_id_preservation(hardening_client):
    custom_corr_id = "test-corr-id-998877"
    response = hardening_client.get("/health", headers={"X-Correlation-ID": custom_corr_id})
    assert response.status_code == 200
    assert response.headers.get("X-Correlation-ID") == custom_corr_id


def test_correlation_id_auto_generation(hardening_client):
    response = hardening_client.get("/health")
    assert response.status_code == 200
    corr_id = response.headers.get("X-Correlation-ID")
    assert corr_id is not None
    assert len(corr_id) > 10


def test_safe_error_handling_no_traceback(hardening_client):
    response = hardening_client.get("/api/recovery-cases/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "traceback" not in data
    assert "Traceback" not in response.text


def test_security_boundary_no_prohibited_payment_execution():
    """
    Explicitly audits codebase to verify that execution engines, card charging functions,
    and direct SMS/Email/WhatsApp messaging do not exist in business logic.
    """
    from backend.app.services import prediction_service, reasoning_service

    pred_code = inspect.getsource(prediction_service)
    reas_code = inspect.getsource(reasoning_service)

    prohibited_terms = [
        "execute_payment",
        "charge(",
        "send_email",
        "send_sms",
        "send_whatsapp",
        "authorize(",
        "override_policy",
    ]

    for term in prohibited_terms:
        assert term not in pred_code, f"Security violation: {term} found in prediction_service"
        assert term not in reas_code, f"Security violation: {term} found in reasoning_service"
