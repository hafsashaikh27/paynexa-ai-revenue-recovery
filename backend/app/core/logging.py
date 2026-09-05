import logging
import uuid
from contextvars import ContextVar
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variable for correlation ID
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


class SafeCorrelationFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        if not hasattr(record, "correlation_id") or not record.correlation_id:
            record.correlation_id = correlation_id_ctx.get() or "none"
        return super().format(record)


class CorrelationIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_ctx.get() or "none"
        return True


# Configure root logger with safe correlation formatting
root_logger = logging.getLogger()
root_formatter = SafeCorrelationFormatter(
    "%(asctime)s [%(levelname)s] [%(name)s] [CorrID: %(correlation_id)s] %(message)s"
)
if root_logger.handlers:
    for h in root_logger.handlers:
        h.setFormatter(root_formatter)
        h.addFilter(CorrelationIdFilter())
else:
    handler = logging.StreamHandler()
    handler.setFormatter(root_formatter)
    handler.addFilter(CorrelationIdFilter())
    root_logger.addHandler(handler)

root_logger.setLevel(logging.INFO)

logger = logging.getLogger("recoverai")
logger.addFilter(CorrelationIdFilter())


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        corr_id = request.headers.get("X-Correlation-ID")
        if not corr_id:
            corr_id = str(uuid.uuid4())

        token = correlation_id_ctx.set(corr_id)
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = corr_id
            return response
        finally:
            correlation_id_ctx.reset(token)
