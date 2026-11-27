"""The instance switch for the AI assistant, each organization's own
switch per role inside it, and the responsible-use notice its users
acknowledge."""

import logging
import uuid

from sqlmodel import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import INSTANCE_SETTINGS_ID, InstanceSettings, Organization, User
from app.services import platform_audit_service

# The notice a person acknowledges when creating a token (its text lives in
# the frontend's locales). Raise it when the text changes in substance:
# tokens created from then on record the new version.
ASSISTANT_DISCLAIMER_VERSION = "2"
# The first version that names a session's records: an older token keeps its
# other tools but doesn't reach them (a new one has to be created).
SESSION_DATA_NOTICE = 2

# The roles an organization turns the assistant on or off for. A
# Facilitator goes with the Controller (the flag needs it); Observers and
# Players never use the assistant.
ASSISTANT_ROLES = ("program_manager", "planner", "controller", "evaluator")


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


def organization_roles(session: Session, organization_id: uuid.UUID) -> set[str]:
    """The roles the organization leaves the assistant on for."""
    organization = session.get(Organization, organization_id)
    if organization is None:
        return set()
    return set(organization.assistant_roles) & set(ASSISTANT_ROLES)


def require_role(session: Session, organization_id: uuid.UUID, *held: str) -> None:
    """The person acts in `held` roles here: one of them has to be on."""
    if not organization_roles(session, organization_id) & set(held):
        raise AppException(
            "ASSISTANT_ROLE_DISABLED",
            "This organization has the AI assistant turned off for your role.",
            403,
            log_level=logging.WARNING,
        )


def save_organization_roles(
    session: Session, actor: User, organization: Organization, roles: list[str]
) -> list[str]:
    before = sorted(set(organization.assistant_roles) & set(ASSISTANT_ROLES))
    after = [role for role in ASSISTANT_ROLES if role in roles]
    organization.assistant_roles = after
    session.add(organization)
    session.commit()
    platform_audit_service.record(
        session,
        actor,
        "assistant.organization_roles_update",
        "organization",
        target_id=organization.id,
        target_label=organization.name,
        details={"before": before, "after": after},
    )
    return after
