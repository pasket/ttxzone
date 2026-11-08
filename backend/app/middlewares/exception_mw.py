"""Global last-resort exception-handling middleware.

FastAPI's own exception-handler machinery (registered in app.main for
AppException, RequestValidationError, and the base Starlette
HTTPException) runs inside Starlette's built-in ExceptionMiddleware,
which sits closer to the router than any BaseHTTPMiddleware. By the time
an exception reaches this middleware it has already escaped every
handler we know how to route -- a genuinely unanticipated failure. This
is the true safety net: log it with full context and never leak
internals to the client (OWASP-aligned).
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.i18n import get_locale, translate_error

logger = logging.getLogger(__name__)


class GlobalExceptionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        try:
            return await call_next(request)
        except Exception:
            # An unhandled error carries no exercise context: the body
            # keeps the contract's `ttx_id` key, always None here.
            logger.exception(
                "Unhandled exception while processing %s %s",
                request.method,
                request.url.path,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": translate_error(
                            "An unexpected error occurred. Please try again later.",
                            None,
                            get_locale(request.headers.get("accept-language")),
                        ),
                        "ttx_id": None,
                    },
                },
            )
