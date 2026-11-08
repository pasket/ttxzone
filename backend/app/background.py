"""The background loops a process may run (APP_ROLE): outgoing email and
Platform's activity log. Shared by the HTTP app (role "all") and the
worker (app.worker), which must not need the HTTP app."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from app.services import email_service, platform_audit_service


def runs_background_loops(role: str) -> bool:
    """The roles whose process drains the outbox and forwards the activity
    log: one process per deployment should (the worker), or the only one."""
    return role in ("all", "worker")


@asynccontextmanager
async def background_loops() -> AsyncIterator[None]:
    """Outgoing email (the outbox, drained while email is configured) and
    Platform's activity log (forwarded to the SIEM while a webhook is set,
    pruned past its retention period), for as long as the block runs."""
    forwarding = asyncio.create_task(platform_audit_service.forward_forever())
    mailing = asyncio.create_task(email_service.deliver_forever())
    try:
        yield
    finally:
        for task in (forwarding, mailing):
            task.cancel()
        for task in (forwarding, mailing):
            with suppress(asyncio.CancelledError):
                await task
