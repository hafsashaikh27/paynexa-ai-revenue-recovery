#!/usr/bin/env python3
"""
Model Training Script for RecoverAI.
Trains a scikit-learn Pipeline (ColumnTransformer + Classifier) to predict payment recovery probability.
Saves model artifact and metadata in backend/app/ml/model/
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.ml.features import (
    NUMERICAL_FEATURES,
    BOOLEAN_FEATURES,
    CATEGORICAL_FEATURES,
    FEATURE_VERSION,
)
from backend.app.config import settings


def generate_synthetic_training_data(n_samples: int = 6000, random_state: int = 42) -> pd.DataFrame:
    """Generate realistic historical payment failure recovery dataset."""
    np.random.seed(random_state)

    payment_methods = ["CREDIT_CARD", "DEBIT_CARD", "UPI", "NET_BANKING", "WALLET"]
    failure_reasons = [
        "NETWORK_TIMEOUT",
        "INSUFFICIENT_FUNDS",
        "CARD_DECLINED",
        "EXPIRED_CARD",
        "INVALID_CARD",
        "BANK_ERROR",
        "FRAUD_REVIEW",
        "UNKNOWN",
    ]
    device_types = ["mobile", "desktop", "tablet"]
    merchant_categories = ["E-commerce", "SaaS", "Retail", "Services", "Digital Goods"]

    data = []
    for i in range(n_samples):
        pm = np.random.choice(payment_methods, p=[0.35, 0.25, 0.25, 0.10, 0.05])
        reason = np.random.choice(
            failure_reasons,
            p=[0.25, 0.25, 0.15, 0.10, 0.08, 0.10, 0.04, 0.03],
        )
        device = np.random.choice(device_types, p=[0.60, 0.35, 0.05])
        cat = np.random.choice(merchant_categories)

        amount_minor = int(np.random.exponential(scale=350000) + 10000)  # ~100 to 10000 INR
        invoice_age = int(np.random.choice([0, 1, 2, 3, 7, 14, 30], p=[0.4, 0.2, 0.15, 0.1, 0.08, 0.05, 0.02]))
        ltv_minor = int(np.random.exponential(scale=1500000) + 50000)
        succ_count = int(np.random.poisson(lam=4))
        failed_count = int(np.random.poisson(lam=1))
        retry_count = int(np.random.choice([0, 1, 2, 3, 4], p=[0.4, 0.3, 0.15, 0.1, 0.05]))
        contact_count = int(np.random.choice([0, 1, 2], p=[0.7, 0.2, 0.1]))
        days_since_last = int(np.random.choice([1, 5, 15, 30, 60, 90]))
        checkout_sec = int(np.random.normal(loc=45, scale=20))
        checkout_sec = max(5, checkout_sec)
        is_sub = int(np.random.choice([0, 1], p=[0.65, 0.35]))
        opted_out = int(np.random.choice([0, 1], p=[0.95, 0.05]))

        # Calculate ground truth probability with business logic
        latent_prob = 0.50

        if reason == "NETWORK_TIMEOUT":
            latent_prob += 0.35
        elif reason == "BANK_ERROR":
            latent_prob += 0.20
        elif reason == "INSUFFICIENT_FUNDS":
            latent_prob -= 0.10
        elif reason == "CARD_DECLINED":
            latent_prob -= 0.18
        elif reason == "EXPIRED_CARD":
            latent_prob -= 0.30
        elif reason in ("INVALID_CARD", "FRAUD_REVIEW"):
            latent_prob -= 0.40

        if succ_count > failed_count + 2:
            latent_prob += 0.15
        elif failed_count > succ_count:
            latent_prob -= 0.15

        latent_prob -= retry_count * 0.07
        if is_sub == 1:
            latent_prob += 0.08
        if opted_out == 1:
            latent_prob -= 0.30
        if invoice_age > 10:
            latent_prob -= 0.15

        prob = np.clip(latent_prob, 0.02, 0.98)
        recovered = 1 if np.random.rand() < prob else 0

        data.append({
            "amount_minor": amount_minor,
            "invoice_age_days": invoice_age,
            "lifetime_value_minor": ltv_minor,
            "successful_payments_count": succ_count,
            "failed_payments_count": failed_count,
            "retry_count": retry_count,
            "contact_count": contact_count,
            "days_since_last_payment": days_since_last,
            "checkout_duration_sec": checkout_sec,
            "is_subscription": is_sub,
            "has_opted_out": opted_out,
            "payment_method": pm,
            "failure_reason": reason,
            "device_type": device,
            "merchant_category": cat,
            "recovered": recovered,
        })

    return pd.DataFrame(data)


def train_and_save_model() -> dict:
    """Train recovery probability model and persist artifacts."""
    print("Generating training dataset...")
    df = generate_synthetic_training_data(n_samples=6000, random_state=42)

    X = df.drop(columns=["recovered"])
    y = df["recovered"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Feature preprocessors
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERICAL_FEATURES),
            ("bool", "passthrough", BOOLEAN_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
        ]
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=100,
                    max_depth=8,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )

    print("Training RandomForest model pipeline...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_proba)),
    }

    print("Model Evaluation Metrics:")
    for k, v in metrics.items():
        print(f"  - {k}: {v:.4f}")

    # Ensure output directory exists
    model_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "app", "ml", "model")
    os.makedirs(model_dir, exist_ok=True)

    model_file = os.path.join(model_dir, "recovery_model.joblib")
    metadata_file = os.path.join(model_dir, "model_metadata.joblib")

    metadata = {
        "model_name": settings.MODEL_NAME,
        "model_version": settings.MODEL_VERSION,
        "feature_version": FEATURE_VERSION,
        "metrics": metrics,
        "feature_names": list(X.columns),
        "trained_at": pd.Timestamp.now(tz="UTC").isoformat(),
    }

    joblib.dump(pipeline, model_file)
    joblib.dump(metadata, metadata_file)
    print(f"Model successfully saved to {model_file}")
    print(f"Metadata saved to {metadata_file}")

    return metrics


if __name__ == "__main__":
    train_and_save_model()
