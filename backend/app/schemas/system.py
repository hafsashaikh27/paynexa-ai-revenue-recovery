from typing import Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "RecoverAI API"
    version: str = "1.0.0"


class ReadyResponse(BaseModel):
    status: str
    database: str
    llm_provider: str
    ml_model: str


class LLMStatusResponse(BaseModel):
    provider: str
    status: str
    mode: str
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    feature_version: Optional[str] = None
