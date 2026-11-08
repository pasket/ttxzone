"""The inject library, organization level: inject templates every exercise
of the organization can copy into its MSEL. Managed by the organization's
Program Managers, like its actor library; Exercise Planners copy from it.

Exercises only ever hold copies (MSEL injects with an origin), so editing
or deleting a library inject never changes an exercise."""

import logging
import uuid
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.data.actor_catalog import ACTOR_CATALOG_BY_ID
from app.data.attack_catalog import is_selectable, latest_attack_version, names
from app.data.inject_catalog import load_inject_catalog
from app.models import ActorOrigin, OrganizationInject, User
from app.schemas.inject_library import OrganizationInjectFields, OrganizationInjectRead
from app.schemas.ttx_msel import AttackRefRead
from app.services.attack_conversion import ConversionReport, convert_refs

logger = logging.getLogger(__name__)


def _invalid(code: str, message: str, params: dict | None = None) -> AppException:
    return AppException(code, message, 422, log_level=logging.WARNING, params=params)


def _check(payload: OrganizationInjectFields) -> None:
    if payload.origin == ActorOrigin.SYSTEM and payload.origin_id not in {
        inject.id for inject in load_inject_catalog().injects
    }:
        raise _invalid("UNKNOWN_SYSTEM_INJECT", "That TTX-Zone inject doesn't exist.")
    if payload.actor_origin == ActorOrigin.SYSTEM and (
        payload.actor_origin_id not in ACTOR_CATALOG_BY_ID
    ):
        raise _invalid("UNKNOWN_SYSTEM_ACTOR", "That TTX-Zone actor doesn't exist.")
    for ref in payload.attack:
        if not is_selectable(payload.attack_version, *ref.key()):
            raise _invalid(
                "UNKNOWN_ATTACK_TECHNIQUE",
                "{technique} isn't a technique of {tactic} in ATT&CK v{version}.",
                {
                    "technique": ref.technique_id,
                    "tactic": ref.tactic_id,
                    "version": payload.attack_version,
                },
            )


def _write(inject: OrganizationInject, payload: OrganizationInjectFields) -> None:
    _check(payload)
    data = payload.model_dump(mode="json")
    data["title"] = payload.title.strip()
    data["origin_id"] = payload.origin_id if payload.origin else None
    data["origin_name"] = payload.origin_name if payload.origin else None
    data["actor_origin_id"] = payload.actor_origin_id if payload.actor_origin else None
    for field, value in data.items():
        setattr(inject, field, value)
    # Enum columns take the enums, not their JSON values.
    inject.kind = payload.kind
    inject.format = payload.format
    inject.actor_type = payload.actor_type
    inject.actor_origin = payload.actor_origin
    inject.delivery_method = payload.delivery_method
    inject.origin = payload.origin


def inject_read(inject: OrganizationInject) -> OrganizationInjectRead:
    attack = []
    for ref in inject.attack:
        tactic_name, technique_name = names(
            inject.attack_version, ref["domain"], ref["tactic_id"], ref["technique_id"]
        )
        attack.append(AttackRefRead(**ref, tactic_name=tactic_name, technique_name=technique_name))
    data = inject.model_dump(exclude={"attack", "organization_id", "created_by_id"})
    return OrganizationInjectRead(**data, attack=attack)


def _get(session: Session, organization_id: uuid.UUID, inject_id: uuid.UUID) -> OrganizationInject:
    inject = session.get(OrganizationInject, inject_id)
    if inject is None or inject.organization_id != organization_id:
        raise AppException("INJECT_NOT_FOUND", "That inject isn't in this library.", 404)
    return inject


def list_injects(session: Session, organization_id: uuid.UUID) -> list[OrganizationInject]:
    return list(
        session.exec(
            select(OrganizationInject)
            .where(OrganizationInject.organization_id == organization_id)
            .order_by(OrganizationInject.title)
        )
    )


def create_inject(
    session: Session, organization_id: uuid.UUID, payload: OrganizationInjectFields, user: User
) -> OrganizationInject:
    inject = OrganizationInject(organization_id=organization_id, title="", created_by_id=user.id)
    _write(inject, payload)
    session.add(inject)
    session.commit()
    session.refresh(inject)
    logger.info(
        "Library inject %s created in org %s by user %s.", inject.id, organization_id, user.id
    )
    return inject


def update_inject(
    session: Session,
    organization_id: uuid.UUID,
    inject_id: uuid.UUID,
    payload: OrganizationInjectFields,
    user: User,
) -> OrganizationInject:
    inject = _get(session, organization_id, inject_id)
    _write(inject, payload)
    inject.updated_at = datetime.now(UTC)
    session.add(inject)
    session.commit()
    session.refresh(inject)
    return inject


def delete_inject(
    session: Session, organization_id: uuid.UUID, inject_id: uuid.UUID, user: User
) -> None:
    """Exercises that copied it keep their copy."""
    inject = _get(session, organization_id, inject_id)
    session.delete(inject)
    session.commit()
    logger.info(
        "Library inject %s deleted from org %s by user %s.", inject_id, organization_id, user.id
    )


def upgrade_library(session: Session, organization_id: uuid.UUID, user: User):
    """Move every inject of the organization's library onto the latest
    ATT&CK release (see attack_conversion): (release, how many moved, the
    report). Exercises keep their own copies as they are."""
    to_version = latest_attack_version()
    report = ConversionReport()
    upgraded = 0
    for inject in list_injects(session, organization_id):
        if inject.attack_version == to_version:
            continue
        triples = convert_refs(
            [(r["domain"], r["tactic_id"], r["technique_id"]) for r in inject.attack],
            to_version,
            report,
        )
        inject.attack = [
            {"domain": d, "tactic_id": ta, "technique_id": te} for d, ta, te in triples
        ]
        inject.attack_version = to_version
        inject.updated_at = datetime.now(UTC)
        session.add(inject)
        upgraded += 1
    session.commit()
    logger.info(
        "%s library inject(s) of org %s moved to ATT&CK v%s by user %s.",
        upgraded,
        organization_id,
        to_version,
        user.id,
    )
    return to_version, upgraded, report
