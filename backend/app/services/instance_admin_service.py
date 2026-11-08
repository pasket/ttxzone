"""Who runs Platform: granting and revoking instance administrator, from
the web (Platform -> Accounts / Administrators, unless the deployment's
configuration leaves it to the console: INSTANCE_ADMIN_WEB_GRANTS) or from
the server's console (scripts.instance_admin, the way back when nobody can
sign in). Both are recorded in Platform's activity log. The deployment is
never left without an active one."""

import logging

from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import User
from app.services import platform_audit_service

logger = logging.getLogger(__name__)


def require_web_grants() -> None:
    if not settings.INSTANCE_ADMIN_WEB_GRANTS:
        raise AppException(
            "INSTANCE_ADMIN_WEB_GRANTS_DISABLED",
            "This deployment grants instance administrator from the server's console only.",
            409,
            log_level=logging.WARNING,
        )


def list_instance_admins(session: Session) -> list[User]:
    """Active accounts holding the grant, suspended ones included (marked)."""
    return list(
        session.exec(
            select(User)
            .where(User.is_instance_admin.is_(True), User.is_active.is_(True))
            .order_by(User.full_name, User.email)
        )
    )


def grant_instance_admin(session: Session, user: User, actor: User | None) -> None:
    """`actor` None: from the console. `user` must be an active account
    (account_suspension_service.get_account); it enrolls TOTP before
    Platform opens for it (require_instance_admin)."""
    if user.is_instance_admin:
        raise AppException(
            "ALREADY_INSTANCE_ADMIN",
            "This account is already an instance administrator.",
            409,
            log_level=logging.WARNING,
        )
    if user.suspended_at is not None:
        raise AppException(
            "ACCOUNT_SUSPENDED", "This account is suspended.", 409, log_level=logging.WARNING
        )
    user.is_instance_admin = True
    session.add(user)
    session.commit()
    logger.warning(
        "Instance administrator granted to %s by %s.", user.id, actor.id if actor else "the console"
    )
    platform_audit_service.record(
        session, actor, "instance_admin.grant", "account", user.id, user.email
    )


def revoke_instance_admin(session: Session, user: User, actor: User | None) -> None:
    """Yourself included, while another active one remains. Takes effect
    on the next request: require_instance_admin reads the grant each time."""
    if not user.is_instance_admin:
        raise AppException(
            "NOT_INSTANCE_ADMIN",
            "This account isn't an instance administrator.",
            409,
            log_level=logging.WARNING,
        )
    # Lock the active administrators before counting them, so two revokes
    # at once can't both leave the other as "not the last".
    active = list(
        session.exec(
            select(User.id)
            .where(
                User.is_instance_admin.is_(True),
                User.is_active.is_(True),
                User.suspended_at.is_(None),
            )
            .with_for_update()
        )
    )
    if user.suspended_at is None and set(active) <= {user.id}:
        session.rollback()
        raise AppException(
            "LAST_INSTANCE_ADMIN",
            "This is the last instance administrator: grant another one first.",
            409,
            log_level=logging.WARNING,
        )
    user.is_instance_admin = False
    session.add(user)
    session.commit()
    logger.warning(
        "Instance administrator revoked from %s by %s.",
        user.id,
        actor.id if actor else "the console",
    )
    platform_audit_service.record(
        session, actor, "instance_admin.revoke", "account", user.id, user.email
    )
