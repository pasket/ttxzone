"""Which face of the deployment a request came through (docs/deployment.md,
section 8): "internal" (APP_ROLE all or api-internal -- everything) or
"public" (api-public -- the Players' surface, reachable from the Internet).

The public app sets it for each request (SurfaceMiddleware) in a context
variable the services read (`current()`), so a Player view is enforced
deep in them too, not only by which routes exist: a person who is both a
Controller and a Player only ever gets the Player's view there."""

from contextvars import ContextVar
from typing import Literal

from starlette.types import ASGIApp, Receive, Scope, Send

Surface = Literal["internal", "public"]

_surface: ContextVar[Surface] = ContextVar("surface", default="internal")


def current() -> Surface:
    return _surface.get()


def is_public() -> bool:
    return _surface.get() == "public"


class SurfaceMiddleware:
    """Marks every request of an app as coming through `surface`. Pure ASGI,
    so the value is in the request's context before any dependency or
    endpoint runs (both copy it into the thread pool)."""

    def __init__(self, app: ASGIApp, surface: Surface) -> None:
        self.app = app
        self.surface = surface

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        token = _surface.set(self.surface)
        try:
            await self.app(scope, receive, send)
        finally:
            _surface.reset(token)
