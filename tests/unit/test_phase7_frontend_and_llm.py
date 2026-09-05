"""Unit tests for Phase 7: Dashboard Summary, System Status, and End-to-End API Contracts."""
import uuid
import pytest
from backend.app.models.entities import (
    Merchant,
    Customer,
    Transaction,
    RecoveryCase,
    ModelPrediction,
    LLMExplanation,
)


def seed_dashboard_data(db):
    m = Merchant(name="Dash Store", code=f"DASH_{uuid.uuid4().hex[:6]}", category="Retail")
    db.add(m)
    db.commit()

    c = Customer(merchant_id=m.id, external_customer_id=f"C_{uuid.uuid4().hex[:6]}", email="dash@user.com", lifetime_value_minor=500000)
    db.add(c)
    db.commit()

    tx1 = Transaction(
        merchant_id=m.id,
        customer_id=c.id,
        amount_minor=100000,  # ₹1,000.00
        payment_method="UPI",
        status="FAILED",
        failure_reason="NETWORK_TIMEOUT",
    )
    tx2 = Transaction(
        merchant_id=m.id,
        customer_id=c.id,
        amount_minor=200000,  # ₹2,000.00
        payment_method="CREDIT_CARD",
        status="FAILED",
        failure_reason="CARD_DECLINED",
    )
    db.add_all([tx1, tx2])
    db.commit()

    case1 = RecoveryCase(
        transaction_id=tx1.id,
        merchant_id=m.id,
        customer_id=c.id,
        status="NEW",
        priority="HIGH",
        revenue_at_risk_minor=100000,
    )
    case2 = RecoveryCase(
        transaction_id=tx2.id,
        merchant_id=m.id,
        customer_id=c.id,
        status="IN_PROGRESS",
        priority="MEDIUM",
        revenue_at_risk_minor=200000,
    )
    db.add_all([case1, case2])
    db.commit()

    pred1 = ModelPrediction(
        recovery_case_id=case1.id,
        model_name="recovery_probability_model",
        model_version="1.0.0",
        feature_version="1.0.0",
        prediction=0.85,
        feature_importance={},
        inference_latency_ms=5.0,
    )
    pred2 = ModelPrediction(
        recovery_case_id=case2.id,
        model_name="recovery_probability_model",
        model_version="1.0.0",
        feature_version="1.0.0",
        prediction=0.45,
        feature_importance={},
        inference_latency_ms=7.0,
    )
    db.add_all([pred1, pred2])
    db.commit()

    exp1 = LLMExplanation(
        recovery_case_id=case1.id,
        summary="High recovery probability based on network timeout.",
        risk_level="LOW",
        recovery_likelihood="HIGH",
        key_factors=[],
        recommended_next_step="Retry transaction.",
        confidence=0.90,
        model_version="1.0.0",
        feature_version="1.0.0",
    )
    db.add(exp1)
    db.commit()
    return case1, case2


def test_dashboard_summary_metrics(client, db_session):
    seed_dashboard_data(db_session)
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()

    assert data["total_cases"] >= 2
    assert data["revenue_at_risk_minor"] >= 300000
    assert data["revenue_at_risk_inr"] >= 3000.00
    assert data["high_risk_cases"] >= 1
    assert data["explanations_generated"] >= 1
    assert data["average_recovery_probability"] > 0.0


def test_system_llm_status_endpoint_no_secrets(client):
    response = client.get("/api/system/llm-status")
    assert response.status_code == 200
    data = response.json()

    assert data["provider"] in ("GEMINI", "MOCK", "OPENAI")
    assert data["status"] in ("operational", "configured", "missing_api_key")
    assert "api_key" not in data
    assert "password" not in data
    assert "secret" not in data


def test_recovery_cases_search_and_filter(client, db_session):
    case1, case2 = seed_dashboard_data(db_session)

    # Filter by status
    resp_new = client.get("/api/recovery-cases?status=NEW")
    assert resp_new.status_code == 200
    data_new = resp_new.json()
    assert data_new["total"] >= 1
    assert all(item["status"] == "NEW" for item in data_new["items"])

    # Filter by priority
    resp_high = client.get("/api/recovery-cases?priority=HIGH")
    assert resp_high.status_code == 200
    data_high = resp_high.json()
    assert data_high["total"] >= 1
    assert all(item["priority"] == "HIGH" for item in data_high["items"])


def test_recovery_cases_search_by_id(client, db_session):
    case1, _ = seed_dashboard_data(db_session)
    resp = client.get(f"/api/recovery-cases?search={case1.id[:8]}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(item["id"] == case1.id for item in data["items"])
