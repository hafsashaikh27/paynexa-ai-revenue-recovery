import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.api.deps import get_db
from backend.app.models.entities import (
    RecoveryCase,
    ModelPrediction,
    LLMExplanation,
)
from backend.app.schemas.dashboard import DashboardSummary

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/summary", response_model=DashboardSummary, summary="Get aggregated live dashboard metrics")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Computes real metrics directly from the database:
    - total_cases: count of RecoveryCase records
    - revenue_at_risk_minor: sum of revenue_at_risk_minor
    - revenue_at_risk_inr: revenue_at_risk_minor / 100
    - average_recovery_probability: average of latest ModelPrediction.prediction
    - high_risk_cases: count of cases with priority HIGH or CRITICAL
    - explanations_generated: count of LLMExplanation records
    """
    total_cases = db.query(func.count(RecoveryCase.id)).scalar() or 0

    revenue_at_risk_minor = (
        db.query(func.sum(RecoveryCase.revenue_at_risk_minor))
        .filter(RecoveryCase.status.in_(["NEW", "IN_PROGRESS", "ESCALATED"]))
        .scalar()
        or 0
    )
    # If no pending, sum all
    if revenue_at_risk_minor == 0 and total_cases > 0:
        revenue_at_risk_minor = db.query(func.sum(RecoveryCase.revenue_at_risk_minor)).scalar() or 0

    revenue_at_risk_inr = round(float(revenue_at_risk_minor) / 100.0, 2)

    avg_prob = db.query(func.avg(ModelPrediction.prediction)).scalar()
    average_recovery_probability = round(float(avg_prob), 4) if avg_prob is not None else 0.0

    high_risk_cases = (
        db.query(func.count(RecoveryCase.id))
        .filter(RecoveryCase.priority.in_(["HIGH", "CRITICAL"]))
        .scalar()
        or 0
    )

    explanations_generated = db.query(func.count(LLMExplanation.id)).scalar() or 0

    return DashboardSummary(
        total_cases=total_cases,
        revenue_at_risk_minor=revenue_at_risk_minor,
        revenue_at_risk_inr=revenue_at_risk_inr,
        average_recovery_probability=average_recovery_probability,
        high_risk_cases=high_risk_cases,
        explanations_generated=explanations_generated,
    )
