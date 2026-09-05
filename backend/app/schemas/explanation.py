from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from backend.app.constants import RiskLevel, RecoveryLikelihood, ImpactLevel


class KeyFactor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    feature: str
    impact: str  # POSITIVE, NEGATIVE, NEUTRAL
    explanation: str


class ExplanationRequest(BaseModel):
    pass


class ExplanationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recovery_case_id: str
    model_prediction_id: Optional[str] = None
    summary: str = Field(..., min_length=10, max_length=500)
    risk_level: str
    recovery_likelihood: str
    key_factors: List[KeyFactor] = Field(default_factory=list)
    recommended_next_step: str = Field(..., min_length=5, max_length=500)
    confidence: float = Field(..., ge=0.0, le=1.0)
    model_version: str
    feature_version: str
    created_at: datetime
