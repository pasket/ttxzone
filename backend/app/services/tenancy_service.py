"""The deployment's tenancy rules: who may found organizations, and how
many may exist. The environment (Settings.TENANCY_MODE) wins over the
instance administrator's choice from the web (InstanceSettings)."""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import func, text
from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import INSTANCE_SETTINGS_ID, InstanceSettings, Organization, User

TenancyMode = Literal["open", "single", "managed"]

module_logger = logging.getLogger(__name__)

# Serializes founding while a cap applies, so two concurrent signups can't
# both see room for the last organization (held until the commit).
_FOUNDING_LOCK_KEY = 7_031_001


@dataclass(frozen=True)
class TenancyPolicy:
    mode: TenancyMode
    max_organizations: int | None
    # Set from the deployment's environment: the web can't change it.
    pinned_by_env: bool


# A fresh deployment, before anyone sets a rule: one organization, created
# by the instance administrator from Platform.
DEFAULT_POLICY = TenancyPolicy("managed", 1, False)


def effective_policy(session: Session) -> TenancyPolicy:
    if settings.TENANCY_MODE is not None:
        return TenancyPolicy(settings.TENANCY_MODE, settings.TENANCY_MAX_ORGANIZATIONS, True)
    stored = session.get(InstanceSettings, INSTANCE_SETTINGS_ID)
    if stored is None:
        return DEFAULT_POLICY
    return TenancyPolicy(stored.tenancy_mode, stored.max_organizations, False)  # type: ignore[arg-type]


def is_last_instance_admin(session: Session, user: User) -> bool:
    """Deleting this account would leave the deployment with nobody to run
    Platform (only the server's console can grant another)."""
    if not user.is_instance_admin:
        return False
    admins = session.exec(
        select(func.count())
        .select_from(User)
        .where(
            User.is_instance_admin.is_(True),  # type: ignore[attr-defined]
            User.is_active.is_(True),  # type: ignore[attr-defined]
            User.suspended_at.is_(None),  # type: ignore[union-attr]
        )
    ).one()
    return admins <= 1


def organization_count(session: Session) -> int:
    return session.exec(select(func.count()).select_from(Organization)).one()


def _capacity_left(session: Session, policy: TenancyPolicy) -> bool:
    if policy.mode == "single" or policy.max_organizations is not None:
        session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _FOUNDING_LOCK_KEY})
    count = organization_count(session)
    if policy.mode == "single":
        return count == 0
    return policy.max_organizations is None or count < policy.max_organizations


def self_service_founding_allowed(session: Session) -> bool:
    """Whether an account may found an organization on its own (signup's
    "Set up my organization", the avatar menu's Create organization).
    "single" lets the first one through -- the deployment's bootstrap --
    then closes; "managed" never does."""
    policy = effective_policy(session)
    if policy.mode == "managed":
        return False
    return _capacity_left(session, policy)


def require_self_service_founding(session: Session) -> None:
    policy = effective_policy(session)
    if policy.mode == "managed":
        raise AppException(
            "TENANCY_MANAGED_ONLY",
            "Organizations in this deployment are created by its administrator.",
            403,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )
    if not _capacity_left(session, policy):
        raise AppException(
            "TENANCY_SINGLE_EXISTS" if policy.mode == "single" else "TENANCY_ORG_LIMIT",
            "This deployment doesn't allow more organizations.",
            403,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )


def require_instance_founding(session: Session) -> None:
    """An instance administrator creating an organization from Platform:
    any mode, within the deployment's cap ("single": the one)."""
    policy = effective_policy(session)
    if not _capacity_left(session, policy):
        raise AppException(
            "TENANCY_SINGLE_EXISTS" if policy.mode == "single" else "TENANCY_ORG_LIMIT",
            "This deployment doesn't allow more organizations.",
            409,
            log_level=logging.WARNING,
        )


def update_instance_settings(
    session: Session, user: User, mode: TenancyMode, max_organizations: int | None
) -> TenancyPolicy:
    """Never deletes anything: a stricter mode (or a cap below today's
    count) only stops new organizations."""
    if settings.TENANCY_MODE is not None:
        raise AppException(
            "TENANCY_PINNED_BY_ENV",
            "This deployment sets its tenancy rules in its configuration.",
            409,
            log_level=logging.WARNING,
        )
    stored = session.get(InstanceSettings, INSTANCE_SETTINGS_ID)
    if stored is None:
        stored = InstanceSettings(id=INSTANCE_SETTINGS_ID)
    stored.tenancy_mode = mode
    stored.max_organizations = max_organizations
    stored.updated_at = datetime.now(UTC)
    stored.updated_by_user_id = user.id
    session.add(stored)
    session.commit()
    module_logger.info(
        "Instance tenancy set to %s (max %s) by %s.", mode, max_organizations, user.id
    )
    return effective_policy(session)
