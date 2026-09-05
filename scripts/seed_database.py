#!/usr/bin/env python3
"""
Seed script for RecoverAI.
Populates merchants, customers, transactions, recovery policies, recovery cases,
initial ML predictions, and LLM explanations for rich dashboard analytics.
"""

import os
import sys
import uuid
import random
from datetime import datetime, timedelta, timezone

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.core.database import SessionLocal, init_db, engine
from backend.app.models.entities import (
    Merchant,
    Customer,
    Transaction,
    RecoveryPolicy,
    RecoveryCase,
    ModelPrediction,
    LLMExplanation,
)
from backend.app.services.prediction_service import PredictionService
from backend.app.services.reasoning_service import ReasoningService
from backend.app.ml.predictor import get_predictor


def seed_data():
    print("Initializing database tables...")
    init_db()

    db = SessionLocal()
    try:
        # Check if database is already populated
        existing_cases = db.query(RecoveryCase).count()
        if existing_cases > 50:
            print(f"Database already contains {existing_cases} recovery cases. Skipping duplicate seed.")
            return

        print("Seeding demo merchants...")
        merchants = [
            Merchant(
                id=str(uuid.uuid4()),
                name="Aura Fashion Retail",
                code="AURA_IN",
                category="E-commerce",
            ),
            Merchant(
                id=str(uuid.uuid4()),
                name="CloudScale Analytics",
                code="CLOUD_SAAS",
                category="SaaS",
            ),
            Merchant(
                id=str(uuid.uuid4()),
                name="Zenith Digital Streaming",
                code="ZENITH_DIGI",
                category="Digital Goods",
            ),
            Merchant(
                id=str(uuid.uuid4()),
                name="Nexus Prime B2B",
                code="NEXUS_B2B",
                category="Services",
            ),
        ]
        db.add_all(merchants)
        db.commit()

        print("Seeding recovery policies...")
        policies = []
        for m in merchants:
            pol = RecoveryPolicy(
                id=str(uuid.uuid4()),
                merchant_id=m.id,
                name=f"{m.name} Standard Recovery Policy",
                version="1.0.0",
            )
            policies.append(pol)
        db.add_all(policies)
        db.commit()

        print("Seeding 1,000 customers...")
        random.seed(42)
        customers = []
        domains = ["gmail.com", "outlook.com", "yahoo.com", "company.io", "tech.in"]
        for i in range(1000):
            merchant = random.choice(merchants)
            succ_count = int(random.expovariate(1 / 5))
            failed_count = int(random.expovariate(1 / 1.5))
            ltv_minor = int((succ_count * random.uniform(1000, 8000) + random.uniform(500, 2000)) * 100)
            opted_out = random.random() < 0.04

            cust = Customer(
                id=str(uuid.uuid4()),
                merchant_id=merchant.id,
                external_customer_id=f"CUST_{i+1:05d}",
                email=f"customer{i+1}@{random.choice(domains)}",
                lifetime_value_minor=ltv_minor,
                successful_payments_count=succ_count,
                failed_payments_count=failed_count,
                has_opted_out=opted_out,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(10, 365)),
            )
            customers.append(cust)

        # Batch insert customers
        db.bulk_save_objects(customers)
        db.commit()

        # Re-fetch customers with IDs
        customers_list = db.query(Customer).all()
        cust_by_merchant = {}
        for c in customers_list:
            cust_by_merchant.setdefault(c.merchant_id, []).append(c)

        print("Seeding 5,000 transactions & recovery cases...")
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
        statuses = ["NEW", "IN_PROGRESS", "ESCALATED", "RECOVERED", "FAILED", "CLOSED"]
        status_weights = [0.40, 0.25, 0.15, 0.10, 0.05, 0.05]
        priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        priority_weights = [0.25, 0.40, 0.25, 0.10]
        devices = ["mobile", "desktop", "tablet"]

        policy_map = {p.merchant_id: p for p in policies}

        tx_objects = []
        case_objects = []

        now = datetime.now(timezone.utc)
        predictor = get_predictor()

        for i in range(5000):
            merchant = random.choice(merchants)
            customer = random.choice(cust_by_merchant[merchant.id])
            policy = policy_map.get(merchant.id)

            amount_minor = int(random.uniform(250, 15000) * 100)  # ₹250 to ₹15,000
            payment_method = random.choice(payment_methods)
            failure_reason = random.choice(failure_reasons)
            device = random.choice(devices)
            is_sub = random.random() < 0.35
            invoice_age = random.choice([0, 1, 2, 3, 5, 7, 14, 21])
            checkout_sec = random.randint(15, 180)
            days_since = random.randint(1, 90)
            tx_time = now - timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )

            tx_id = str(uuid.uuid4())
            tx = Transaction(
                id=tx_id,
                merchant_id=merchant.id,
                customer_id=customer.id,
                amount_minor=amount_minor,
                currency="INR",
                payment_method=payment_method,
                status="FAILED",
                failure_reason=failure_reason,
                is_subscription=is_sub,
                invoice_age_days=invoice_age,
                checkout_duration_sec=checkout_sec,
                device_type=device,
                days_since_last_payment=days_since,
                transaction_timestamp=tx_time,
                created_at=tx_time,
            )
            tx_objects.append(tx)

            case_status = random.choices(statuses, weights=status_weights, k=1)[0]
            case_priority = random.choices(priorities, weights=priority_weights, k=1)[0]
            retry_count = random.choice([0, 1, 2, 3]) if case_status != "NEW" else 0
            contact_count = 1 if case_status in ("ESCALATED", "IN_PROGRESS") and random.random() < 0.4 else 0

            recovered_amount = amount_minor if case_status == "RECOVERED" else 0
            escalation_reason = (
                "Multiple retry exhaustion with high ticket amount."
                if case_status == "ESCALATED"
                else None
            )

            case = RecoveryCase(
                id=str(uuid.uuid4()),
                transaction_id=tx_id,
                merchant_id=merchant.id,
                customer_id=customer.id,
                policy_id=policy.id if policy else None,
                policy_version="1.0.0",
                status=case_status,
                priority=case_priority,
                retry_count=retry_count,
                contact_count=contact_count,
                revenue_at_risk_minor=amount_minor,
                recovered_amount_minor=recovered_amount,
                currency="INR",
                escalation_reason=escalation_reason,
                created_at=tx_time,
                updated_at=tx_time,
            )
            case_objects.append(case)

        print("Saving transactions and cases in batches...")
        db.bulk_save_objects(tx_objects)
        db.bulk_save_objects(case_objects)
        db.commit()

        print("Generating ML predictions for initial cases...")
        seeded_cases = db.query(RecoveryCase).limit(400).all()
        predictions = []
        for c in seeded_cases:
            prob, importance, latency = predictor.predict(
                transaction=c.transaction,
                customer=c.customer,
                merchant=c.merchant,
                recovery_case=c,
            )
            pred = ModelPrediction(
                id=str(uuid.uuid4()),
                recovery_case_id=c.id,
                model_name=predictor.model_name,
                model_version=predictor.model_version,
                feature_version=predictor.feature_version,
                prediction=prob,
                feature_importance=importance,
                inference_latency_ms=latency,
                prediction_timestamp=c.created_at,
            )
            predictions.append(pred)

        db.bulk_save_objects(predictions)
        db.commit()

        print("Generating initial LLM explanations for a subset of cases...")
        sample_cases = db.query(RecoveryCase).limit(35).all()
        for sc in sample_cases:
            try:
                ReasoningService.generate_and_save_explanation(db, sc.id)
            except Exception as e:
                print(f"Error generating explanation for sample case {sc.id}: {e}")

        print("Database seed successfully completed!")
        print(f"  - Total Merchants: {len(merchants)}")
        print(f"  - Total Customers: {len(customers_list)}")
        print(f"  - Total Transactions: {len(tx_objects)}")
        print(f"  - Total Recovery Cases: {len(case_objects)}")
        print(f"  - Predictions generated: {len(predictions)}")
        print(f"  - Explanations generated: {db.query(LLMExplanation).count()}")

    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
