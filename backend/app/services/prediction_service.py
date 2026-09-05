import logging
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from backend.app.models.entities import (
    RecoveryCase,
    ModelPrediction,
)
from backend.app.ml.predictor import get_predictor

logger = logging.getLogger(__name__)


class PredictionService:
    @staticmethod
    def predict_for_case(db: Session, case_id: str) -> ModelPrediction:
        """
        Runs ML model inference for a RecoveryCase and saves a ModelPrediction record.
        Strictly preserves immutability of RecoveryCase (does NOT alter status, priority, or amounts).
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

        transaction = recovery_case.transaction
        customer = recovery_case.customer
        merchant = recovery_case.merchant

        predictor = get_predictor()
        probability, feature_importance, latency_ms = predictor.predict(
            transaction=transaction,
            customer=customer,
            merchant=merchant,
            recovery_case=recovery_case,
        )

        prediction_record = ModelPrediction(
            recovery_case_id=recovery_case.id,
            model_name=predictor.model_name,
            model_version=predictor.model_version,
            feature_version=predictor.feature_version,
            prediction=probability,
            feature_importance=feature_importance,
            inference_latency_ms=latency_ms,
        )

        db.add(prediction_record)
        db.commit()
        db.refresh(prediction_record)

        logger.info(
            f"Generated prediction {probability:.4f} for case {case_id} "
            f"in {latency_ms}ms"
        )
        return prediction_record
