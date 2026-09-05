import logging
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from pydantic import ValidationError
from backend.app.models.entities import (
    RecoveryCase,
    ModelPrediction,
    LLMExplanation,
)
from backend.app.schemas.explanation import ExplanationResponse
from backend.app.services.prediction_service import PredictionService
from backend.app.llm.prompt_builder import sanitize_context, build_explanation_prompt
from backend.app.llm.factory import get_llm_provider
from backend.app.config import settings

logger = logging.getLogger(__name__)


class ReasoningService:
    @staticmethod
    def generate_and_save_explanation(db: Session, case_id: str) -> LLMExplanation:
        """
        Generates and saves a new LLMExplanation for a RecoveryCase.
        Ensures append-only storage and guarantees that neither RecoveryCase
        nor existing ModelPrediction records are mutated.
        """
        recovery_case = (
            db.query(RecoveryCase)
            .filter(RecoveryCase.id == case_id)
            .first()
        )
        if not recovery_case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recovery case '{case_id}' not found",
            )

        # Get latest prediction, or trigger prediction if none exists
        latest_prediction = (
            db.query(ModelPrediction)
            .filter(ModelPrediction.recovery_case_id == case_id)
            .order_by(ModelPrediction.prediction_timestamp.desc())
            .first()
        )
        if not latest_prediction:
            latest_prediction = PredictionService.predict_for_case(db, case_id)

        # Build raw context from related entities
        transaction = recovery_case.transaction
        customer = recovery_case.customer
        merchant = recovery_case.merchant

        raw_context: Dict[str, Any] = {
            "amount_minor": transaction.amount_minor if transaction else 0,
            "payment_method": transaction.payment_method if transaction else "UNKNOWN",
            "failure_reason": transaction.failure_reason if transaction else "UNKNOWN",
            "is_subscription": transaction.is_subscription if transaction else False,
            "invoice_age_days": transaction.invoice_age_days if transaction else 0,
            "lifetime_value_minor": customer.lifetime_value_minor if customer else 0,
            "successful_payments_count": customer.successful_payments_count if customer else 0,
            "failed_payments_count": customer.failed_payments_count if customer else 0,
            "has_opted_out": customer.has_opted_out if customer else False,
            "retry_count": recovery_case.retry_count,
            "merchant_category": merchant.category if merchant else "E-commerce",
            "model_name": latest_prediction.model_name,
            "model_version": latest_prediction.model_version,
            "feature_version": latest_prediction.feature_version,
            "prediction": latest_prediction.prediction,
            "feature_importance": latest_prediction.feature_importance,
        }

        # Sanitize context and build safe prompt
        sanitized = sanitize_context(raw_context)
        prompt = build_explanation_prompt(sanitized)

        # Obtain LLM provider
        provider = get_llm_provider()

        try:
            raw_explanation = provider.generate_structured_explanation(prompt, sanitized)
        except Exception as e:
            logger.error(f"LLM explanation generation error: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LLM explanation service encountered an error: {str(e)}",
            )

        # Validate structured fields
        summary = str(raw_explanation.get("summary", "")).strip()
        if len(summary) < 10:
            summary = f"The ML model predicts a {latest_prediction.prediction * 100:.1f}% recovery probability based on transaction failure reason and history."
        summary = summary[:500]

        recommended_next_step = str(raw_explanation.get("recommended_next_step", "")).strip()
        if len(recommended_next_step) < 5:
            recommended_next_step = "Recommend review by operations specialist prior to scheduling subsequent retry."
        recommended_next_step = recommended_next_step[:500]

        risk_level = str(raw_explanation.get("risk_level", "MEDIUM")).upper()
        if risk_level not in ("LOW", "MEDIUM", "HIGH"):
            risk_level = "MEDIUM"

        recovery_likelihood = str(raw_explanation.get("recovery_likelihood", "MEDIUM")).upper()
        if recovery_likelihood not in ("LOW", "MEDIUM", "HIGH"):
            recovery_likelihood = "MEDIUM"

        try:
            confidence = float(raw_explanation.get("confidence", 0.85))
            confidence = max(0.0, min(1.0, confidence))
        except (ValueError, TypeError):
            confidence = 0.85

        key_factors = raw_explanation.get("key_factors", [])
        if not isinstance(key_factors, list):
            key_factors = []

        # Construct append-only explanation entity
        explanation_entity = LLMExplanation(
            recovery_case_id=recovery_case.id,
            model_prediction_id=latest_prediction.id,
            summary=summary,
            risk_level=risk_level,
            recovery_likelihood=recovery_likelihood,
            key_factors=key_factors,
            recommended_next_step=recommended_next_step,
            confidence=confidence,
            model_version=latest_prediction.model_version,
            feature_version=latest_prediction.feature_version,
        )

        db.add(explanation_entity)
        db.commit()
        db.refresh(explanation_entity)

        logger.info(f"Appended explanation {explanation_entity.id} for case {case_id}")
        return explanation_entity

    @staticmethod
    def get_explanations_history(db: Session, case_id: str) -> List[LLMExplanation]:
        """
        Fetches chronological history of explanations generated for a case.
        """
        recovery_case = (
            db.query(RecoveryCase)
            .filter(RecoveryCase.id == case_id)
            .first()
        )
        if not recovery_case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recovery case '{case_id}' not found",
            )

        return (
            db.query(LLMExplanation)
            .filter(LLMExplanation.recovery_case_id == case_id)
            .order_by(LLMExplanation.created_at.desc())
            .all()
        )
