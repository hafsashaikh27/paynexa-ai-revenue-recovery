"""Unit tests for Phase 4: Prediction Service & Recovery Case Endpoints."""
import uuid
import pytest
from backend.app.models.entities import (
    Merchant,
    Customer,
    Transaction,
    RecoveryCase,
    ModelPrediction,
)
from backend.app.services.prediction_service import PredictionService


def seed_test_case(db, status="NEW", priority="HIGH", reason="NETWORK_TIMEOUT"):
    merch = Merchant(name="Test M", code=f"TM_{uuid.uuid4().hex[:6]}", category="SaaS")
    db.add(merch)
    db.commit()

    cust = Customer(merchant_id=merch.id, external_customer_id=f"C_{uuid.uuid4().hex[:6]}", email="c1@test.com")
    db.add(cust)
    db.commit()

    tx = Transaction(
        merchant_id=merch.id,
        customer_id=cust.id,
        amount_minor=100000,
        payment_method="UPI",
        status="FAILED",
        failure_reason=reason,
    )
    db.add(tx)
    db.commit()

    case = RecoveryCase(
        transaction_id=tx.id,
        merchant_id=merch.id,
        customer_id=cust.id,
        status=status,
        priority=priority,
        revenue_at_risk_minor=100000,
        recovered_amount_minor=0,
    )
    db.add(case)
    db.commit()
    return case


def test_prediction_service_valid_case_and_immutability(db_session):
    case = seed_test_case(db_session)
    orig_status = case.status
    orig_priority = case.priority
    orig_recovered = case.recovered_amount_minor

    pred = PredictionService.predict_for_case(db_session, case.id)

    assert pred.id is not None
    assert pred.recovery_case_id == case.id
    assert 0.0 <= pred.prediction <= 1.0
    assert pred.model_name == "recovery_probability_model"

    # Verify immutability of the case
    db_session.refresh(case)
    assert case.status == orig_status
    assert case.priority == orig_priority
    assert case.recovered_amount_minor == orig_recovered


def test_consecutive_predictions_for_same_case(db_session):
    case = seed_test_case(db_session)
    pred1 = PredictionService.predict_for_case(db_session, case.id)
    pred2 = PredictionService.predict_for_case(db_session, case.id)

    assert pred1.id != pred2.id
    assert pred1.recovery_case_id == pred2.recovery_case_id


def test_get_recovery_cases_endpoint_pagination(client, db_session):
    seed_test_case(db_session)
    response = client.get("/api/recovery-cases?limit=5&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data
    assert data["limit"] == 5


def test_get_recovery_cases_filtering_by_status(client, db_session):
    seed_test_case(db_session, status="ESCALATED")
    seed_test_case(db_session, status="NEW")

    resp = client.get("/api/recovery-cases?status=ESCALATED")
    assert resp.status_code == 200
    data = resp.json()
    assert all(item["status"] == "ESCALATED" for item in data["items"])


def test_get_recovery_case_detail_success(client, db_session):
    case = seed_test_case(db_session)
    response = client.get(f"/api/recovery-cases/{case.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == case.id
    assert "transaction" in data
    assert "customer" in data
    assert "predictions" in data


def test_get_recovery_case_not_found(client):
    random_id = str(uuid.uuid4())
    response = client.get(f"/api/recovery-cases/{random_id}")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_get_recovery_case_invalid_uuid(client):
    response = client.get("/api/recovery-cases/not-a-valid-uuid")
    assert response.status_code == 422


def test_trigger_prediction_api(client, db_session):
    case = seed_test_case(db_session)
    response = client.post(f"/api/recovery-cases/{case.id}/predict")
    assert response.status_code == 200
    data = response.json()
    assert data["recovery_case_id"] == case.id
    assert "prediction" in data
    assert "inference_latency_ms" in data
    assert 0.0 <= data["prediction"] <= 1.0


def test_trigger_prediction_api_not_found(client):
    random_id = str(uuid.uuid4())
    response = client.post(f"/api/recovery-cases/{random_id}/predict")
    assert response.status_code == 404
