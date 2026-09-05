import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Index,
    Text,
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    category = Column(String(100), nullable=False, default="E-commerce")
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    customers = relationship("Customer", back_populates="merchant", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="merchant", cascade="all, delete-orphan")
    policies = relationship("RecoveryPolicy", back_populates="merchant", cascade="all, delete-orphan")
    recovery_cases = relationship("RecoveryCase", back_populates="merchant", cascade="all, delete-orphan")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    merchant_id = Column(String(36), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    external_customer_id = Column(String(100), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    lifetime_value_minor = Column(Integer, default=0, nullable=False)
    successful_payments_count = Column(Integer, default=0, nullable=False)
    failed_payments_count = Column(Integer, default=0, nullable=False)
    has_opted_out = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    merchant = relationship("Merchant", back_populates="customers")
    transactions = relationship("Transaction", back_populates="customer", cascade="all, delete-orphan")
    recovery_cases = relationship("RecoveryCase", back_populates="customer", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    merchant_id = Column(String(36), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_minor = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_method = Column(String(50), nullable=False, index=True)
    status = Column(String(50), nullable=False, index=True)
    failure_reason = Column(String(100), nullable=False, index=True)
    is_subscription = Column(Boolean, default=False, nullable=False)
    invoice_age_days = Column(Integer, default=0, nullable=False)
    checkout_duration_sec = Column(Integer, default=0, nullable=False)
    device_type = Column(String(50), default="mobile", nullable=False)
    days_since_last_payment = Column(Integer, default=0, nullable=False)
    transaction_timestamp = Column(DateTime, default=get_utc_now, nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    merchant = relationship("Merchant", back_populates="transactions")
    customer = relationship("Customer", back_populates="transactions")
    recovery_case = relationship("RecoveryCase", back_populates="transaction", uselist=False)


class RecoveryPolicy(Base):
    __tablename__ = "recovery_policies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    merchant_id = Column(String(36), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False, default="1.0.0")
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    merchant = relationship("Merchant", back_populates="policies")
    recovery_cases = relationship("RecoveryCase", back_populates="policy")


class RecoveryCase(Base):
    __tablename__ = "recovery_cases"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    merchant_id = Column(String(36), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(String(36), ForeignKey("recovery_policies.id", ondelete="SET NULL"), nullable=True, index=True)
    policy_version = Column(String(50), default="1.0.0", nullable=False)
    status = Column(String(50), default="NEW", nullable=False, index=True)
    priority = Column(String(50), default="MEDIUM", nullable=False, index=True)
    retry_count = Column(Integer, default=0, nullable=False)
    contact_count = Column(Integer, default=0, nullable=False)
    revenue_at_risk_minor = Column(Integer, default=0, nullable=False)
    recovered_amount_minor = Column(Integer, default=0, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    escalation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False, index=True)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    transaction = relationship("Transaction", back_populates="recovery_case")
    merchant = relationship("Merchant", back_populates="recovery_cases")
    customer = relationship("Customer", back_populates="recovery_cases")
    policy = relationship("RecoveryPolicy", back_populates="recovery_cases")
    predictions = relationship(
        "ModelPrediction",
        back_populates="recovery_case",
        cascade="all, delete-orphan",
        order_by="desc(ModelPrediction.prediction_timestamp)",
    )
    explanations = relationship(
        "LLMExplanation",
        back_populates="recovery_case",
        cascade="all, delete-orphan",
        order_by="desc(LLMExplanation.created_at)",
    )


class ModelPrediction(Base):
    __tablename__ = "model_predictions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    recovery_case_id = Column(String(36), ForeignKey("recovery_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=False)
    feature_version = Column(String(50), nullable=False)
    prediction = Column(Float, nullable=False)
    feature_importance = Column(JSON, nullable=False, default=dict)
    inference_latency_ms = Column(Float, default=0.0, nullable=False)
    prediction_timestamp = Column(DateTime, default=get_utc_now, nullable=False, index=True)

    recovery_case = relationship("RecoveryCase", back_populates="predictions")
    explanations = relationship("LLMExplanation", back_populates="model_prediction")


class LLMExplanation(Base):
    __tablename__ = "llm_explanations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    recovery_case_id = Column(String(36), ForeignKey("recovery_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    model_prediction_id = Column(String(36), ForeignKey("model_predictions.id", ondelete="SET NULL"), nullable=True, index=True)
    summary = Column(Text, nullable=False)
    risk_level = Column(String(50), nullable=False)
    recovery_likelihood = Column(String(50), nullable=False)
    key_factors = Column(JSON, nullable=False, default=list)
    recommended_next_step = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)
    model_version = Column(String(50), nullable=False)
    feature_version = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False, index=True)

    recovery_case = relationship("RecoveryCase", back_populates="explanations")
    model_prediction = relationship("ModelPrediction", back_populates="explanations")


Index("ix_recovery_cases_status_priority", RecoveryCase.status, RecoveryCase.priority)
