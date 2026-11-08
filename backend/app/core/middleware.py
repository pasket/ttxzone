import asyncio

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Everything this server returns is JSON, a file download or an uploaded
# image (avatars, logos, exercise images under /media): none of it is a
# page that runs scripts or loads anything. So the policy denies it all --
# which also defuses an uploaded file opened directly in the browser (an
# SVG with a script can't run one). The single-page app's own policy lives
# with the frontend (vite.config.ts), which serves the HTML.
API_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
)

# FastAPI's interactive docs are a real page (Swagger UI / ReDoc from a CDN,
# inline scripts): they keep working without the API policy.
_DOCS_PATHS = ("/docs", "/redoc")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if not request.url.path.startswith(_DOCS_PATHS):
            response.headers["Content-Security-Policy"] = API_CONTENT_SECURITY_POLICY
        return response


class ConcurrencyLimitMiddleware:
    """At most `limit` requests handled at once; the rest wait here, in
    the event loop, holding no thread and no database connection.

    Why: a request resolves its (synchronous) dependencies and endpoint in
    several trips to the thread pool and keeps its database connection
    between them. With more requests in flight than pooled connections,
    the ones without a connection fill every thread waiting for one, the
    ones with a connection wait for a thread, and nothing moves until the
    pool times out (found by the load test with a hundred Players). Keep
    `limit` below both DB_POOL_SIZE + DB_MAX_OVERFLOW and the thread pool.

    The Playground's streams are exempt: they last minutes, and their
    reads take one trip each with a session of their own."""

    def __init__(self, app, limit: int) -> None:
        self.app = app
        self.limit = limit
        # One per event loop (a server has one; tests may start several).
        self._semaphores: dict[int, asyncio.Semaphore] = {}

    def _semaphore(self) -> asyncio.Semaphore:
        loop = id(asyncio.get_running_loop())
        if loop not in self._semaphores:
            self._semaphores = {loop: asyncio.Semaphore(self.limit)}
        return self._semaphores[loop]

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or scope["path"].endswith("/run/stream"):
            await self.app(scope, receive, send)
            return
        async with self._semaphore():
            await self.app(scope, receive, send)
