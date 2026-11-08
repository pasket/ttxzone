import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.api import api_router, build_public_router
from app.background import background_loops, runs_background_loops
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.i18n import get_locale, translate_error
from app.core.logging_conf import configure_logging
from app.core.middleware import ConcurrencyLimitMiddleware, SecurityHeadersMiddleware
from app.core.surface import SurfaceMiddleware
from app.middlewares.exception_mw import GlobalExceptionMiddleware
from app.services.avatar_service import ensure_avatar_dir
from app.services.organization_logo_service import ensure_org_logo_dir
from app.services.ttx_image_service import ensure_ttx_image_dir

_STATUS_CODE_SLUGS: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
}


def _error_response(
    status_code: int, code: str, message: str, ttx_id: str | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {"code": code, "message": message, "ttx_id": ttx_id},
        },
    )


def _locale(request: Request) -> str:
    """The client's language for an error message (the SPA sends its own)."""
    return get_locale(request.headers.get("accept-language"))


async def app_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppException)  # nosec B101 -- registered for AppException only
    logging.getLogger(exc.logger_name or __name__).log(
        exc.log_level,
        "AppException %s on %s %s: %s",
        exc.code,
        request.method,
        request.url.path,
        exc.message,
    )
    message = translate_error(exc.template, exc.params, _locale(request))
    return _error_response(exc.status_code, exc.code, message, exc.ttx_id)


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)  # nosec B101
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    message = translate_error("Invalid request data.", None, _locale(request))
    return _error_response(422, "VALIDATION_ERROR", message)


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)  # nosec B101
    code = _STATUS_CODE_SLUGS.get(exc.status_code, "HTTP_ERROR")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    level = logging.WARNING if exc.status_code < 500 else logging.ERROR
    logger.log(
        level,
        "HTTPException %s on %s %s: %s",
        exc.status_code,
        request.method,
        request.url.path,
        message,
    )
    return _error_response(exc.status_code, code, translate_error(message, None, _locale(request)))


logger = logging.getLogger(__name__)


def create_app(role: str = settings.APP_ROLE) -> FastAPI:
    """The HTTP application for one process role (APP_ROLE): "all" also
    runs the background loops, "api-internal" serves the API alone,
    "api-public" only the Players' part of it (app/api/exposure.py). The
    worker has no HTTP application (python -m app.worker)."""
    if role == "worker":
        raise ValueError('APP_ROLE "worker" runs `python -m app.worker`, not an HTTP server.')
    public = role == "api-public"

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging()
        if runs_background_loops(role):
            async with background_loops():
                yield
        else:
            yield

    # The public face publishes no API description (it would list routes
    # it doesn't even serve to the Internet's scanners).
    docs = {"docs_url": None, "redoc_url": None, "openapi_url": None} if public else {}
    app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan, **docs)
    app.state.role = role
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GlobalExceptionMiddleware)
    app.add_middleware(ConcurrencyLimitMiddleware, limit=settings.MAX_CONCURRENT_REQUESTS)
    # Outermost: every request of this app, and everything it reaches, knows
    # which face it came through (app.core.surface).
    app.add_middleware(SurfaceMiddleware, surface="public" if public else "internal")

    if public:
        # Only the Players' routes (app/api/exposure.py), each guarded.
        app.include_router(build_public_router(), prefix=settings.API_V1_PREFIX)
    else:
        app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    app.mount(
        settings.AVATAR_URL_PREFIX,
        StaticFiles(directory=ensure_avatar_dir()),
        name="avatars",
    )
    app.mount(
        settings.ORG_LOGO_URL_PREFIX,
        StaticFiles(directory=ensure_org_logo_dir()),
        name="org-logos",
    )
    app.mount(
        settings.TTX_IMAGE_URL_PREFIX,
        StaticFiles(directory=ensure_ttx_image_dir()),
        name="ttx-images",
    )
    return app


# What uvicorn serves (app.main:app) and the tests import. The worker role
# never imports an HTTP app: build "all" there instead of failing.
app = create_app(settings.APP_ROLE if settings.APP_ROLE != "worker" else "all")
