from typing import Any, Dict, List, Optional
import pandas as pd
from backend.app.config import settings

FEATURE_VERSION = "1.0.0"

# List of input features extracted from business entities
NUMERICAL_FEATURES = [
    "amount_minor",
    "invoice_age_days",
    "lifetime_value_minor",
    "successful_payments_count",
    "failed_payments_count",
    "retry_count",
    "contact_count",
    "days_since_last_payment",
    "checkout_duration_sec",
]

BOOLEAN_FEATURES = [
    "is_subscription",
    "has_opted_out",
]

CATEGORICAL_FEATURES = [
    "payment_method",
    "failure_reason",
    "device_type",
    "merchant_category",
]

FEATURE_NAMES = NUMERICAL_FEATURES + BOOLEAN_FEATURES + CATEGORICAL_FEATURES


def extract_features_from_entities(
    transaction: Any,
    customer: Any,
    merchant: Any,
    recovery_case: Any,
) -> Dict[str, Any]:
    """
    Extract a normalized dictionary of features from database entities.
    Strictly forbids target leakage (e.g. recovered_amount_minor, final status).
    """
    return {
        "amount_minor": float(transaction.amount_minor) if transaction else 0.0,
        "invoice_age_days": float(transaction.invoice_age_days) if transaction else 0.0,
        "lifetime_value_minor": float(customer.lifetime_value_minor) if customer else 0.0,
        "successful_payments_count": float(customer.successful_payments_count) if customer else 0.0,
        "failed_payments_count": float(customer.failed_payments_count) if customer else 0.0,
        "retry_count": float(recovery_case.retry_count) if recovery_case else 0.0,
        "contact_count": float(recovery_case.contact_count) if recovery_case else 0.0,
        "days_since_last_payment": float(transaction.days_since_last_payment) if transaction else 0.0,
        "checkout_duration_sec": float(transaction.checkout_duration_sec) if transaction else 0.0,
        "is_subscription": 1 if (transaction and transaction.is_subscription) else 0,
        "has_opted_out": 1 if (customer and customer.has_opted_out) else 0,
        "payment_method": str(transaction.payment_method) if transaction else "UNKNOWN",
        "failure_reason": str(transaction.failure_reason) if transaction else "UNKNOWN",
        "device_type": str(transaction.device_type) if transaction else "mobile",
        "merchant_category": str(merchant.category) if merchant else "E-commerce",
    }


def build_feature_dataframe(data_records: List[Dict[str, Any]]) -> pd.DataFrame:
    """Build a sanitized pandas DataFrame for model training or batch inference."""
    df = pd.DataFrame(data_records)
    for col in NUMERICAL_FEATURES:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        else:
            df[col] = 0.0
    for col in BOOLEAN_FEATURES:
        if col in df.columns:
            df[col] = df[col].astype(int)
        else:
            df[col] = 0
    for col in CATEGORICAL_FEATURES:
        if col in df.columns:
            df[col] = df[col].astype(str).fillna("UNKNOWN")
        else:
            df[col] = "UNKNOWN"
    return df
