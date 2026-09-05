import logging
from backend.app.config import settings
from backend.app.llm.providers import (
    LLMProvider,
    MockLLMProvider,
    GeminiLLMProvider,
    OpenAILLMProvider,
)

logger = logging.getLogger(__name__)


def get_llm_provider() -> LLMProvider:
    """
    Factory function returning the configured LLMProvider instance.
    Defaults to GeminiLLMProvider when configured or MockLLMProvider for offline tests.
    """
    provider_type = (settings.LLM_PROVIDER_TYPE or "GEMINI").upper().strip()

    if provider_type == "MOCK":
        return MockLLMProvider()

    if provider_type in ("GEMINI", "GOOGLE"):
        return GeminiLLMProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
        )

    # Optional legacy fallback if explicitly set to OPENAI
    if provider_type == "OPENAI" and settings.OPENAI_API_KEY:
        return OpenAILLMProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
        )

    # If GEMINI_API_KEY is available, use GeminiLLMProvider
    if settings.GEMINI_API_KEY:
        return GeminiLLMProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
        )

    return MockLLMProvider()
