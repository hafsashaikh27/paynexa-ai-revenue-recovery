import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.api.deps import get_db
from backend.app.models.entities import (
    RecoveryCase,
    ModelPrediction,
    LLMExplanation,
)
from backend.app.schemas.recovery_case import (
    RecoveryCaseListItem,
    RecoveryCaseDetail,
    RecoveryCaseListResponse,
    TransactionResponse,
    CustomerResponse,
    RecoveryPolicyResponse,
)
from backend.app.schemas.prediction import PredictionResponse
from backend.app.schemas.explanation import ExplanationResponse
from backend.app.services.prediction_service import PredictionService
from backend.app.services.reasoning_service import ReasoningService

router = APIRouter()
logger = logging.getLogger(__name__)


def validate_uuid(value: str) -> None:
    try:
        uuid.UUID(value)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid UUID format: {value}",
        )


@router.get("", response_model=RecoveryCaseListResponse, summary="List recovery cases with pagination and filters")
def list_recovery_cases(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    failure_reason: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(RecoveryCase)

    if status:
        query = query.filter(RecoveryCase.status == status.upper())
    if priority:
        query = query.filter(RecoveryCase.priority == priority.upper())
    if failure_reason:
        query = query.join(RecoveryCase.transaction).filter(
            RecoveryCase.transaction.has(failure_reason=failure_reason.upper())
        )
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                RecoveryCase.id.ilike(search_term),
                RecoveryCase.transaction_id.ilike(search_term),
                RecoveryCase.customer_id.ilike(search_term),
            )
        )

    total = query.count()
    cases = (
        query.order_by(RecoveryCase.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for c in cases:
        latest_pred = c.predictions[0].prediction if c.predictions else None
        item = RecoveryCaseListItem(
            id=c.id,
            transaction_id=c.transaction_id,
            merchant_id=c.merchant_id,
            customer_id=c.customer_id,
            policy_id=c.policy_id,
            policy_version=c.policy_version,
            status=c.status,
            priority=c.priority,
            retry_count=c.retry_count,
            contact_count=c.contact_count,
            revenue_at_risk_minor=c.revenue_at_risk_minor,
            recovered_amount_minor=c.recovered_amount_minor,
            currency=c.currency,
            escalation_reason=c.escalation_reason,
            created_at=c.created_at,
            updated_at=c.updated_at,
            payment_method=c.transaction.payment_method if c.transaction else None,
            failure_reason=c.transaction.failure_reason if c.transaction else None,
            latest_prediction=latest_pred,
        )
        items.append(item)

    return RecoveryCaseListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{case_id}", response_model=RecoveryCaseDetail, summary="Get full details for a recovery case")
def get_recovery_case(
    case_id: str,
    db: Session = Depends(get_db),
):
    validate_uuid(case_id)
    case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recovery case '{case_id}' not found",
        )

    predictions_data = [
        {
            "id": p.id,
            "model_name": p.model_name,
            "model_version": p.model_version,
            "feature_version": p.feature_version,
            "prediction": p.prediction,
            "feature_importance": p.feature_importance,
            "inference_latency_ms": p.inference_latency_ms,
            "prediction_timestamp": p.prediction_timestamp.isoformat(),
        }
        for p in case.predictions
    ]

    explanations_data = [
        {
            "id": e.id,
            "model_prediction_id": e.model_prediction_id,
            "summary": e.summary,
            "risk_level": e.risk_level,
            "recovery_likelihood": e.recovery_likelihood,
            "key_factors": e.key_factors,
            "recommended_next_step": e.recommended_next_step,
            "confidence": e.confidence,
            "model_version": e.model_version,
            "feature_version": e.feature_version,
            "created_at": e.created_at.isoformat(),
        }
        for e in case.explanations
    ]

    tx_resp = None
    if case.transaction:
        tx = case.transaction
        tx_resp = TransactionResponse(
            id=tx.id,
            amount_minor=tx.amount_minor,
            currency=tx.currency,
            payment_method=tx.payment_method,
            status=tx.status,
            failure_reason=tx.failure_reason,
            is_subscription=tx.is_subscription,
            invoice_age_days=tx.invoice_age_days,
            checkout_duration_sec=tx.checkout_duration_sec,
            device_type=tx.device_type,
            days_since_last_payment=tx.days_since_last_payment,
            transaction_timestamp=tx.transaction_timestamp,
            created_at=tx.created_at,
        )

    cust_resp = None
    if case.customer:
        cust = case.customer
        cust_resp = CustomerResponse(
            id=cust.id,
            external_customer_id=cust.external_customer_id,
            email=cust.email,
            lifetime_value_minor=cust.lifetime_value_minor,
            successful_payments_count=cust.successful_payments_count,
            failed_payments_count=cust.failed_payments_count,
            has_opted_out=cust.has_opted_out,
            created_at=cust.created_at,
            updated_at=cust.updated_at,
        )

    pol_resp = None
    if case.policy:
        pol = case.policy
        pol_resp = RecoveryPolicyResponse(
            id=pol.id,
            name=pol.name,
            version=pol.version,
            created_at=pol.created_at,
            updated_at=pol.updated_at,
        )

    return RecoveryCaseDetail(
        id=case.id,
        transaction_id=case.transaction_id,
        merchant_id=case.merchant_id,
        customer_id=case.customer_id,
        policy_id=case.policy_id,
        policy_version=case.policy_version,
        status=case.status,
        priority=case.priority,
        retry_count=case.retry_count,
        contact_count=case.contact_count,
        revenue_at_risk_minor=case.revenue_at_risk_minor,
        recovered_amount_minor=case.recovered_amount_minor,
        currency=case.currency,
        escalation_reason=case.escalation_reason,
        created_at=case.created_at,
        updated_at=case.updated_at,
        transaction=tx_resp,
        customer=cust_resp,
        policy=pol_resp,
        predictions=predictions_data,
        explanations=explanations_data,
    )


@router.post("/{case_id}/predict", response_model=PredictionResponse, summary="Trigger ML recovery prediction for a case")
def trigger_prediction(
    case_id: str,
    db: Session = Depends(get_db),
):
    validate_uuid(case_id)
    prediction = PredictionService.predict_for_case(db, case_id)
    return PredictionResponse(
        id=prediction.id,
        recovery_case_id=prediction.recovery_case_id,
        model_name=prediction.model_name,
        model_version=prediction.model_version,
        feature_version=prediction.feature_version,
        prediction=prediction.prediction,
        feature_importance=prediction.feature_importance,
        inference_latency_ms=prediction.inference_latency_ms,
        prediction_timestamp=prediction.prediction_timestamp,
    )


@router.post("/{case_id}/explain", response_model=ExplanationResponse, summary="Generate structured LLM reasoning explanation")
def trigger_explanation(
    case_id: str,
    db: Session = Depends(get_db),
):
    validate_uuid(case_id)
    explanation = ReasoningService.generate_and_save_explanation(db, case_id)
    return ExplanationResponse(
        id=explanation.id,
        recovery_case_id=explanation.recovery_case_id,
        model_prediction_id=explanation.model_prediction_id,
        summary=explanation.summary,
        risk_level=explanation.risk_level,
        recovery_likelihood=explanation.recovery_likelihood,
        key_factors=explanation.key_factors,
        recommended_next_step=explanation.recommended_next_step,
        confidence=explanation.confidence,
        model_version=explanation.model_version,
        feature_version=explanation.feature_version,
        created_at=explanation.created_at,
    )


@router.get("/{case_id}/explanations", response_model=List[ExplanationResponse], summary="Get chronological explanation history")
def get_case_explanations(
    case_id: str,
    db: Session = Depends(get_db),
):
    validate_uuid(case_id)
    explanations = ReasoningService.get_explanations_history(db, case_id)
    return [
        ExplanationResponse(
            id=e.id,
            recovery_case_id=e.recovery_case_id,
            model_prediction_id=e.model_prediction_id,
            summary=e.summary,
            risk_level=e.risk_level,
            recovery_likelihood=e.recovery_likelihood,
            key_factors=e.key_factors,
            recommended_next_step=e.recommended_next_step,
            confidence=e.confidence,
            model_version=e.model_version,
            feature_version=e.feature_version,
            created_at=e.created_at,
        )
        for e in explanations
    ]
