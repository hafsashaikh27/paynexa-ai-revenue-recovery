from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    amount_minor: int
    currency: str
    payment_method: str
    status: str
    failure_reason: str
    is_subscription: bool
    invoice_age_days: int
    checkout_duration_sec: int
    device_type: str
    days_since_last_payment: int
    transaction_timestamp: datetime
    created_at: datetime


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    external_customer_id: str
    email: str
    lifetime_value_minor: int
    successful_payments_count: int
    failed_payments_count: int
    has_opted_out: bool
    created_at: datetime
    updated_at: datetime


class RecoveryPolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    version: str
    created_at: datetime
    updated_at: datetime


class RecoveryCaseListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_id: str
    merchant_id: str
    customer_id: str
    policy_id: Optional[str] = None
    policy_version: str
    status: str
    priority: str
    retry_count: int
    contact_count: int
    revenue_at_risk_minor: int
    recovered_amount_minor: int
    currency: str
    escalation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Associated preview info
    payment_method: Optional[str] = None
    failure_reason: Optional[str] = None
    latest_prediction: Optional[float] = None


class RecoveryCaseDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_id: str
    merchant_id: str
    customer_id: str
    policy_id: Optional[str] = None
    policy_version: str
    status: str
    priority: str
    retry_count: int
    contact_count: int
    revenue_at_risk_minor: int
    recovered_amount_minor: int
    currency: str
    escalation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    transaction: Optional[TransactionResponse] = None
    customer: Optional[CustomerResponse] = None
    policy: Optional[RecoveryPolicyResponse] = None
    predictions: List[Dict[str, Any]] = []
    explanations: List[Dict[str, Any]] = []


class RecoveryCaseListResponse(BaseModel):
    items: List[RecoveryCaseListItem]
    total: int
    limit: int
    offset: int
