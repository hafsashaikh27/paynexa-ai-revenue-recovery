from fastapi import APIRouter
from backend.app.api.v1.endpoints import recovery_cases, dashboard, system

api_router = APIRouter()

api_router.include_router(
    recovery_cases.router,
    prefix="/recovery-cases",
    tags=["Recovery Cases"],
)

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard"],
)

api_router.include_router(
    system.router,
    prefix="/system",
    tags=["System"],
)
