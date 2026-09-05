"""Unit tests for Phase 3: Machine Learning Pipeline, Features, Inference, and Metrics."""
import pytest
import numpy as np
import pandas as pd
from unittest.mock import MagicMock

from backend.app.ml.features import (
    FEATURE_NAMES,
    FEATURE_VERSION,
    NUMERICAL_FEATURES,
    BOOLEAN_FEATURES,
    CATEGORICAL_FEATURES,
    extract_features_from_entities,
    build_feature_dataframe,
)
from backend.app.ml.predictor import RecoveryPredictor, get_predictor
from scripts.train_model import generate_synthetic_training_data


def test_feature_names_list():
    assert len(FEATURE_NAMES) == len(NUMERICAL_FEATURES) + len(BOOLEAN_FEATURES) + len(CATEGORICAL_FEATURES)
    assert "amount_minor" in FEATURE_NAMES
    assert "failure_reason" in FEATURE_NAMES
    assert "payment_method" in FEATURE_NAMES
    assert "retry_count" in FEATURE_NAMES
    assert "contact_count" in FEATURE_NAMES
    assert "is_subscription" in FEATURE_NAMES
    assert "has_opted_out" in FEATURE_NAMES
    assert "merchant_category" in FEATURE_NAMES


def test_no_target_leakage_in_features():
    """Verify that future outcomes (recovered_amount, status, policy override) are NOT extracted as features."""
    forbidden_targets = [
        "recovered",
        "recovered_amount_minor",
        "status",
        "final_status",
        "outcome",
        "is_recovered",
        "actual_recovery",
    ]
    for target in forbidden_targets:
        assert target not in FEATURE_NAMES, f"Target leakage detected: {target} is in FEATURE_NAMES"


def test_feature_extraction_from_entities():
    mock_tx = MagicMock(
        amount_minor=150000,
        invoice_age_days=2,
        days_since_last_payment=10,
        checkout_duration_sec=45,
        is_subscription=True,
        payment_method="CREDIT_CARD",
        failure_reason="NETWORK_TIMEOUT",
        device_type="mobile",
    )
    mock_cust = MagicMock(
        lifetime_value_minor=600000,
        successful_payments_count=5,
        failed_payments_count=1,
        has_opted_out=False,
    )
    mock_merch = MagicMock(category="SaaS")
    mock_case = MagicMock(retry_count=1, contact_count=0)

    features = extract_features_from_entities(
        transaction=mock_tx,
        customer=mock_cust,
        merchant=mock_merch,
        recovery_case=mock_case,
    )

    assert features["amount_minor"] == 150000.0
    assert features["payment_method"] == "CREDIT_CARD"
    assert features["failure_reason"] == "NETWORK_TIMEOUT"
    assert features["is_subscription"] == 1
    assert features["has_opted_out"] == 0
    assert features["merchant_category"] == "SaaS"


def test_feature_extraction_handles_none_safely():
    features = extract_features_from_entities(None, None, None, None)
    assert features["amount_minor"] == 0.0
    assert features["payment_method"] == "UNKNOWN"
    assert features["failure_reason"] == "UNKNOWN"
    assert features["merchant_category"] == "E-commerce"


def test_build_feature_dataframe():
    record = {
        "amount_minor": 100000,
        "payment_method": "UPI",
        "failure_reason": "INSUFFICIENT_FUNDS",
    }
    df = build_feature_dataframe([record])
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 1
    assert df["amount_minor"].iloc[0] == 100000.0
    assert df["device_type"].iloc[0] == "UNKNOWN"


def test_predictor_singleton():
    p1 = get_predictor()
    p2 = get_predictor()
    assert p1 is p2
    assert p1.model_name == "recovery_probability_model"
    assert p1.model_version == "1.0.0"
    assert p1.feature_version == "1.0.0"


def test_predictor_inference_probability_range():
    predictor = get_predictor()
    mock_tx = MagicMock(
        amount_minor=200000,
        invoice_age_days=1,
        days_since_last_payment=5,
        checkout_duration_sec=30,
        is_subscription=True,
        payment_method="UPI",
        failure_reason="NETWORK_TIMEOUT",
        device_type="mobile",
    )
    mock_cust = MagicMock(
        lifetime_value_minor=800000,
        successful_payments_count=6,
        failed_payments_count=0,
        has_opted_out=False,
    )
    mock_merch = MagicMock(category="E-commerce")
    mock_case = MagicMock(retry_count=0, contact_count=0)

    prob, importance, latency = predictor.predict(
        transaction=mock_tx,
        customer=mock_cust,
        merchant=mock_merch,
        recovery_case=mock_case,
    )

    assert 0.0 <= prob <= 1.0
    assert isinstance(prob, float)
    assert latency > 0.0
    assert isinstance(importance, dict)
    assert "failure_reason" in importance
    assert "customer_payment_history" in importance
    assert "retry_count" in importance


def test_predictor_high_vs_low_recovery_signals():
    predictor = get_predictor()

    high_tx = MagicMock(
        amount_minor=100000,
        invoice_age_days=0,
        days_since_last_payment=2,
        checkout_duration_sec=20,
        is_subscription=True,
        payment_method="UPI",
        failure_reason="NETWORK_TIMEOUT",
        device_type="mobile",
    )
    high_cust = MagicMock(
        lifetime_value_minor=1000000,
        successful_payments_count=10,
        failed_payments_count=0,
        has_opted_out=False,
    )
    high_merch = MagicMock(category="SaaS")
    high_case = MagicMock(retry_count=0, contact_count=0)

    high_prob, _, _ = predictor.predict(high_tx, high_cust, high_merch, high_case)

    low_tx = MagicMock(
        amount_minor=1000000,
        invoice_age_days=30,
        days_since_last_payment=90,
        checkout_duration_sec=200,
        is_subscription=False,
        payment_method="CREDIT_CARD",
        failure_reason="FRAUD_REVIEW",
        device_type="desktop",
    )
    low_cust = MagicMock(
        lifetime_value_minor=0,
        successful_payments_count=0,
        failed_payments_count=6,
        has_opted_out=True,
    )
    low_merch = MagicMock(category="Digital Goods")
    low_case = MagicMock(retry_count=3, contact_count=2)

    low_prob, _, _ = predictor.predict(low_tx, low_cust, low_merch, low_case)

    assert high_prob > low_prob, f"Expected high_prob ({high_prob}) > low_prob ({low_prob})"


def test_synthetic_training_data_generator():
    df = generate_synthetic_training_data(n_samples=100, random_state=42)
    assert len(df) == 100
    assert "recovered" in df.columns
    assert df["recovered"].isin([0, 1]).all()
    assert "amount_minor" in df.columns
    assert "failure_reason" in df.columns
