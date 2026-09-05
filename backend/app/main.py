import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text

from backend.app.config import settings
from backend.app.core.database import engine, init_db, SessionLocal
from backend.app.core.logging import CorrelationIdMiddleware, logger
from backend.app.api.v1.router import api_router
from backend.app.schemas.system import HealthResponse, ReadyResponse
from backend.app.llm.factory import get_llm_provider
from backend.app.ml.predictor import get_predictor


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    logger.info(f"Starting {settings.APP_NAME} in {settings.APP_ENV} mode...")
    init_db()
    predictor = get_predictor()
    if predictor.is_loaded():
        logger.info("ML model successfully loaded on startup.")
    else:
        logger.warning("ML model artifact not found. Will use heuristic fallback.")
    yield
    # Shutdown tasks
    logger.info(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title="RecoverAI Backend API",
    version="1.0.0",
    description="Intelligent Revenue Recovery Control Center API for Merchants",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Correlation ID Middleware
app.add_middleware(CorrelationIdMiddleware)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID"],
)


# Global Exception Handlers for safe error output
@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error processing {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# Health & Readiness Check Endpoints
@app.get("/health", response_model=HealthResponse, tags=["Health"], summary="Liveness probe")
@app.get("/api/health", response_model=HealthResponse, tags=["Health"], summary="Liveness probe under /api")
def health_check():
    """Liveness probe: verifies the API service process is active."""
    return HealthResponse(
        status="healthy",
        service="RecoverAI API",
        version="1.0.0",
    )


@app.get("/ready", response_model=ReadyResponse, tags=["Health"], summary="Readiness probe")
@app.get("/api/ready", response_model=ReadyResponse, tags=["Health"], summary="Readiness probe under /api")
def ready_check():
    """Readiness probe: verifies database connectivity, ML model availability, and LLM provider."""
    db_status = "connected"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Database readiness check failed: {e}")
        db_status = "unavailable"

    predictor = get_predictor()
    ml_status = "loaded" if predictor.is_loaded() else "fallback_active"

    provider = get_llm_provider()
    llm_status = provider.get_status().get("status", "operational")

    is_ready = db_status == "connected"
    status_str = "ready" if is_ready else "not_ready"

    return ReadyResponse(
        status=status_str,
        database=db_status,
        llm_provider=llm_status,
        ml_model=ml_status,
    )


# Mount main API routes under /api
app.include_router(api_router, prefix="/api")
