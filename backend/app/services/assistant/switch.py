"""The instance switch for the AI assistant, and the responsible-use
notice its users acknowledge."""

import logging

from sqlmodel import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import INSTANCE_SETTINGS_ID, InstanceSettings, User
from app.services import platform_audit_service

# The notice a person acknowledges when creating a token (its text lives in
# the frontend's locales). Raise it when the text changes in substance:
# tokens created from then on record the new version.
ASSISTANT_DISCLAIMER_VERSION = "2"
# The first version that names a session's records: an older token keeps its
# other tools but doesn't reach them (a new one has to be created).
SESSION_DATA_NOTICE = 2


def pinned_by_env() -> bool:
    return settings.ASSISTANT_ENABLED is not None


def effective_enabled(session: Session) -> bool:
    """The environment's pin wins over Platform's setting; off by default."""
    if settings.ASSISTANT_ENABLED is not None:
        return settings.ASSISTANT_ENABLED
    row = session.get(InstanceSettings, INSTANCE_SETTINGS_ID)
    return row.assistant_enabled if row is not None else False


def save_enabled(session: Session, actor: User, enabled: bool) -> None:
    if pinned_by_env():
        raise AppException(
            "ASSISTANT_PINNED_BY_ENV",
            "The server's configuration turns the AI assistant on or off.",
            409,
            log_level=logging.WARNING,
        )
    row = session.get(InstanceSettings, INSTANCE_SETTINGS_ID)
    if row is None:
        row = InstanceSettings(id=INSTANCE_SETTINGS_ID)
    before = row.assistant_enabled
    row.assistant_enabled = enabled
    session.add(row)
    session.commit()
    platform_audit_service.record(
        session,
        actor,
        "assistant.settings_update",
        "instance",
        details={"before": before, "after": enabled},
    )


def require_enabled(session: Session) -> None:
    if not effective_enabled(session):
        raise AppException(
            "ASSISTANT_DISABLED",
            "The AI assistant is turned off on this server.",
            409,
            log_level=logging.WARNING,
        )
