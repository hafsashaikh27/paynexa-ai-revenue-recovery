"""Unit tests for Phase 2: Comprehensive Database Models, Constraints, and Dataset."""
import uuid
import pytest
from datetime import datetime, timezone

from backend.app.models.entities import (
    Merchant,
    Customer,
    Transaction,
    RecoveryPolicy,
    RecoveryCase,
    ModelPrediction,
    LLMExplanation,
)


def test_merchant_creation_and_fields(db_session):
    merchant = Merchant(
        name="Apex Payments",
        code=f"APEX_{uuid.uuid4().hex[:6]}",
        category="E-commerce",
    )
    db_session.add(merchant)
    db_session.commit()
    db_session.refresh(merchant)

    assert merchant.id is not None
    assert merchant.name == "Apex Payments"
    assert merchant.category == "E-commerce"
    assert isinstance(merchant.created_at, datetime)


def test_customer_creation_and_relationships(db_session):
    merchant = Merchant(name="SubMerchant", code=f"SUB_{uuid.uuid4().hex[:6]}", category="SaaS")
    db_session.add(merchant)
    db_session.commit()

    customer = Customer(
        merchant_id=merchant.id,
        external_customer_id="EXT_1001",
        email="test@user.com",
        lifetime_value_minor=500000,  # ₹5,000.00
        successful_payments_count=8,
        failed_payments_count=1,
        has_opted_out=False,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    assert customer.id is not None
    assert customer.merchant_id == merchant.id
    assert customer.lifetime_value_minor == 500000
    assert customer.merchant.name == "SubMerchant"


def test_customer_opt_out_flag(db_session):
    merchant = Merchant(name="OptMerchant", code=f"OPT_{uuid.uuid4().hex[:6]}", category="SaaS")
    db_session.add(merchant)
    db_session.commit()

    customer = Customer(
        merchant_id=merchant.id,
        external_customer_id="EXT_OPT",
        email="opt@user.com",
        has_opted_out=True,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    assert customer.has_opted_out is True


def test_transaction_creation_and_minor_units(db_session):
    merchant = Merchant(name="Store", code=f"STR_{uuid.uuid4().hex[:6]}", category="Retail")
    db_session.add(merchant)
    db_session.commit()

    customer = Customer(
        merchant_id=merchant.id,
        external_customer_id="EXT_1002",
        email="buyer@store.com",
        lifetime_value_minor=100000,
    )
    db_session.add(customer)
    db_session.commit()

    tx = Transaction(
        merchant_id=merchant.id,
        customer_id=customer.id,
        amount_minor=125000,  # ₹1,250.00
        currency="INR",
        payment_method="UPI",
        status="FAILED",
        failure_reason="NETWORK_TIMEOUT",
        is_subscription=True,
        invoice_age_days=1,
        checkout_duration_sec=30,
        device_type="mobile",
        days_since_last_payment=15,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)

    assert tx.id is not None
    assert tx.amount_minor == 125000
    assert tx.failure_reason == "NETWORK_TIMEOUT"
    assert tx.payment_method == "UPI"


def test_recovery_policy_creation_and_version(db_session):
    merchant = Merchant(name="PolMerchant", code=f"POL_{uuid.uuid4().hex[:6]}", category="Services")
    db_session.add(merchant)
    db_session.commit()

    policy = RecoveryPolicy(
        merchant_id=merchant.id,
        name="High Value Recovery SLA",
        version="2.1.0",
    )
    db_session.add(policy)
    db_session.commit()
    db_session.refresh(policy)

    assert policy.id is not None
    assert policy.version == "2.1.0"
    assert policy.merchant.name == "PolMerchant"


def test_recovery_case_creation_and_constraints(db_session):
    merchant = Merchant(name="TestMerchant", code=f"TM_{uuid.uuid4().hex[:6]}", category="SaaS")
    db_session.add(merchant)
    db_session.commit()

    customer = Customer(
        merchant_id=merchant.id,
        external_customer_id="EXT_1003",
        email="test3@user.com",
        lifetime_value_minor=200000,
    )
    db_session.add(customer)
    db_session.commit()

    tx = Transaction(
        merchant_id=merchant.id,
        customer_id=customer.id,
        amount_minor=250000,
        currency="INR",
        payment_method="CREDIT_CARD",
        status="FAILED",
        failure_reason="INSUFFICIENT_FUNDS",
    )
    db_session.add(tx)
    db_session.commit()

    case = RecoveryCase(
        transaction_id=tx.id,
        merchant_id=merchant.id,
        customer_id=customer.id,
        policy_version="1.0.0",
        status="NEW",
        priority="HIGH",
        retry_count=0,
        contact_count=0,
        revenue_at_risk_minor=250000,
        recovered_amount_minor=0,
        currency="INR",
    )
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)

    assert case.id is not None
    assert case.status == "NEW"
    assert case.priority == "HIGH"
    assert case.revenue_at_risk_minor == 250000
    assert case.transaction.amount_minor == 250000


def test_recovery_case_status_transitions_tracking(db_session):
    merchant = Merchant(name="StatusM", code=f"SM_{uuid.uuid4().hex[:6]}", category="SaaS")
    db_session.add(merchant)
    db_session.commit()

    customer = Customer(merchant_id=merchant.id, external_customer_id="C_STAT", email="stat@user.com")
    db_session.add(customer)
    db_session.commit()

    tx = Transaction(
        merchant_id=merchant.id,
        customer_id=customer.id,
        amount_minor=50000,
        payment_method="DEBIT_CARD",
        status="FAILED",
        failure_reason="BANK_ERROR",
    )
    db_session.add(tx)
    db_session.commit()

    case = RecoveryCase(
        transaction_id=tx.id,
        merchant_id=merchant.id,
        customer_id=customer.id,
        status="NEW",
        priority="MEDIUM",
        revenue_at_risk_minor=50000,
    )
    db_session.add(case)
    db_session.commit()

    case.status = "IN_PROGRESS"
    case.retry_count = 1
    db_session.commit()
    db_session.refresh(case)

    assert case.status == "IN_PROGRESS"
    assert case.retry_count == 1


def test_model_prediction_and_json_fields(db_session):
    merchant = Merchant(name="PredMerchant", code=f"PM_{uuid.uuid4().hex[:6]}", category="SaaS")
    db_session.add(merchant)
    db_session.commit()

    customer = Customer(
        merchant_id=merchant.id,
        external_customer_id="EXT_1004",
        email="pred@user.com",
        lifetime_value_minor=300000,
    )
    db_session.add(customer)
    db_session.commit()

    tx = Transaction(
        merchant_id=merchant.id,
        customer_id=customer.id,
        amount_minor=150000,
        payment_method="DEBIT_CARD",
        status="FAILED",
        failure_reason="BANK_ERROR",
    )
    db_session.add(tx)
    db_session.commit()

    case = RecoveryCase(
        transaction_id=tx.id,
        merchant_id=merchant.id,
        customer_id=customer.id,
        status="NEW",
        priority="MEDIUM",
        revenue_at_risk_minor=150000,
    )
    db_session.add(case)
    db_session.commit()

    pred = ModelPrediction(
        recovery_case_id=case.id,
        model_name="recovery_probability_model",
        model_version="1.0.0",
        feature_version="1.0.0",
        prediction=0.885,
        feature_importance={"failure_reason": {"impact": "POSITIVE", "weight": 0.35}},
        inference_latency_ms=6.2,
    )
    db_session.add(pred)
    db_session.commit()
    db_session.refresh(pred)

    assert pred.id is not None
    assert pred.prediction == 0.885
    assert pred.feature_importance["failure_reason"]["impact"] == "POSITIVE"


def test_llm_explanation_and_key_factors(db_session):
    merchant = Merchant(name="ExpMerchant", code=f"EM_{uuid.uuid4().hex[:6]}", category="SaaS")
    db_session.add(merchant)
    db_session.commit()

    customer = Customer(
        merchant_id=merchant.id,
        external_customer_id="EXT_1005",
        email="exp@user.com",
    )
    db_session.add(customer)
    db_session.commit()

    tx = Transaction(
        merchant_id=merchant.id,
        customer_id=customer.id,
        amount_minor=90000,
        payment_method="UPI",
        status="FAILED",
        failure_reason="NETWORK_TIMEOUT",
    )
    db_session.add(tx)
    db_session.commit()

    case = RecoveryCase(
        transaction_id=tx.id,
        merchant_id=merchant.id,
        customer_id=customer.id,
        status="NEW",
        priority="LOW",
        revenue_at_risk_minor=90000,
    )
    db_session.add(case)
    db_session.commit()

    explanation = LLMExplanation(
        recovery_case_id=case.id,
        summary="High likelihood of recovery due to network timeout.",
        risk_level="LOW",
        recovery_likelihood="HIGH",
        key_factors=[{"feature": "Failure Reason", "impact": "POSITIVE", "explanation": "Network timeout resolves on retry."}],
        recommended_next_step="Recommend retry after short cooldown.",
        confidence=0.95,
        model_version="1.0.0",
        feature_version="1.0.0",
    )
    db_session.add(explanation)
    db_session.commit()
    db_session.refresh(explanation)

    assert explanation.id is not None
    assert explanation.risk_level == "LOW"
    assert explanation.recovery_likelihood == "HIGH"
    assert len(explanation.key_factors) == 1
