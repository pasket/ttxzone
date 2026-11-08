"""Authentication events of any account -- sign-ins and their failures,
sign-outs, sign-ups and changes to how an account signs in. Each one is a
line in auth.log (kept and rotated on the server) and an event in
Platform's activity log, which queues it for the SIEM in the same commit
(platform_audit_service.record)."""

import json
import logging
from typing import Any

from sqlmodel import Session

from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import User
from app.services.platform_audit_service import AuditAction, record

auth_logger = logging.getLogger(AUTH_LOGGER_NAME)


def auth_event(
    session: Session,
    action: AuditAction,
    user: User | None = None,
    *,
    email: str | None = None,
    details: dict[str, Any] | None = None,
    level: int = logging.INFO,
) -> None:
    """`user` acted, or `email` tried to (no such account). Commits."""
    label = user.email if user is not None else (email or "").lower()
    auth_logger.log(
        level,
        "%s user=%s account=%s%s",
        action,
        user.id if user is not None else "-",
        label,
        f" details={json.dumps(details, sort_keys=True)}" if details else "",
    )
    record(
        session,
        user,
        action,
        "account",
        target_id=user.id if user is not None else None,
        target_label=label,
        details=details,
        actor_label=label,
    )
