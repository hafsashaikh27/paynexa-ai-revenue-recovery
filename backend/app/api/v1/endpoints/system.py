import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.api.deps import get_db
from backend.app.llm.factory import get_llm_provider
from backend.app.ml.predictor import get_predictor
from backend.app.schemas.system import LLMStatusResponse, ReadyResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/llm-status", response_model=LLMStatusResponse, summary="Get LLM provider configuration status")
def get_system_llm_status():
    """
    Returns sanitized status of the active LLM provider.
    Guaranteed NEVER to return API keys, passwords, or tokens.
    """
    provider = get_llm_provider()
    status_info = provider.get_status()
    return LLMStatusResponse(
        provider=status_info.get("provider", "MOCK"),
        status=status_info.get("status", "operational"),
        mode=status_info.get("mode", "offline"),
        model_name=status_info.get("model_name"),
        model_version=status_info.get("model_version"),
        feature_version=status_info.get("feature_version"),
    )
