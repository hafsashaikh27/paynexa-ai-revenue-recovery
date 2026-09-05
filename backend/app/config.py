from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "RecoverAI Backend API"
    APP_ENV: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = "sqlite:///./recoverai.db"

    # Active LLM Provider Configuration (Google Gemini 3.7 Flash as sole active engine)
    LLM_PROVIDER_TYPE: str = "GEMINI"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.7-flash"

    # Optional legacy variables (never mandatory)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    LLM_TIMEOUT_SECONDS: float = 3.0

    ML_MODEL_NAME: str = "recovery_probability_model"
    MODEL_NAME: str = "recovery_probability_model"
    MODEL_VERSION: str = "1.0.0"
    FEATURE_VERSION: str = "1.0.0"

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]


settings = Settings()
