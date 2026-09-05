from typing import Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class PredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recovery_case_id: str
    model_name: str
    model_version: str
    feature_version: str
    prediction: float = Field(..., ge=0.0, le=1.0)
    feature_importance: Dict[str, Any]
    inference_latency_ms: float
    prediction_timestamp: datetime
