"""The simulated actor library, organization level: actors every exercise
of the organization can copy into its cast. Managed by the organization's
Program Managers from Admin -> Library (like every other organization
library -- tags, injects); Exercise Planners list it to copy from it.

Exercises only ever hold copies (MselSimulatedActor with an origin), so
editing or deleting a library actor never changes an exercise."""

import logging
import uuid
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.core.security import is_program_manager, require_planner, require_program_manager
from app.data.actor_catalog import ACTOR_CATALOG_BY_ID
from app.models import ActorOrigin, OrganizationActor, User
from app.schemas.actor_library import ActorFields

logger = logging.getLogger(__name__)


def require_library_reader(session: Session, user: User, organization_id: uuid.UUID) -> None:
    """Who may list the organization's library: a Program Manager or an
    (org-scoped) Exercise Planner, who copies its items into their
    exercises -- each check applies its own mandatory-TOTP rule."""
    if is_program_manager(session, user, organization_id):
        require_program_manager(session, user, organization_id)
    else:
        require_planner(session, user, organization_id)


def require_library_manager(session: Session, user: User, organization_id: uuid.UUID) -> None:
    """Who may change the organization's library (create, edit, duplicate
    into it, delete, re-enable, upgrade): its Program Managers only."""
    require_program_manager(session, user, organization_id)


def _check_origin(origin: ActorOrigin | None, origin_id: str | None) -> None:
    if origin == ActorOrigin.SYSTEM and origin_id not in ACTOR_CATALOG_BY_ID:
        raise AppException(
            "UNKNOWN_SYSTEM_ACTOR",
            "That TTX-Zone actor doesn't exist.",
            422,
            log_level=logging.WARNING,
        )


def _get(session: Session, organization_id: uuid.UUID, actor_id: uuid.UUID) -> OrganizationActor:
    actor = session.get(OrganizationActor, actor_id)
    if actor is None or actor.organization_id != organization_id:
        raise AppException("ACTOR_NOT_FOUND", "That actor isn't in this library.", 404)
    return actor


def _write(actor: OrganizationActor, payload: ActorFields) -> None:
    _check_origin(payload.origin, payload.origin_id)
    actor.name = payload.name.strip()
    actor.type = payload.type
    actor.description = payload.description
    actor.channel = payload.channel.value if payload.channel else None
    actor.origin = payload.origin
    actor.origin_id = payload.origin_id if payload.origin else None


def list_actors(session: Session, organization_id: uuid.UUID) -> list[OrganizationActor]:
    return list(
        session.exec(
            select(OrganizationActor)
            .where(OrganizationActor.organization_id == organization_id)
            .order_by(OrganizationActor.name)
        )
    )


def create_actor(
    session: Session, organization_id: uuid.UUID, payload: ActorFields, user: User
) -> OrganizationActor:
    actor = OrganizationActor(organization_id=organization_id, name="", created_by_id=user.id)
    _write(actor, payload)
    session.add(actor)
    session.commit()
    session.refresh(actor)
    logger.info(
        "Library actor %s created in org %s by user %s.", actor.id, organization_id, user.id
    )
    return actor


def update_actor(
    session: Session,
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    payload: ActorFields,
    user: User,
) -> OrganizationActor:
    actor = _get(session, organization_id, actor_id)
    _write(actor, payload)
    actor.updated_at = datetime.now(UTC)
    session.add(actor)
    session.commit()
    session.refresh(actor)
    return actor


def delete_actor(
    session: Session, organization_id: uuid.UUID, actor_id: uuid.UUID, user: User
) -> None:
    """Exercises that copied it keep their copy."""
    actor = _get(session, organization_id, actor_id)
    session.delete(actor)
    session.commit()
    logger.info(
        "Library actor %s deleted from org %s by user %s.", actor_id, organization_id, user.id
    )
