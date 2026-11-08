"""The threat actor library.

TTX-Zone level: MITRE ATT&CK's groups of the latest shipped release,
read-only (app/data/attack_catalog.py). Organization level: threat actors
every exercise of the organization can copy into its scenario -- a MITRE
group copied and perhaps narrowed, or a profile of the organization's own
(no MITRE id, with or without techniques). Managed by the organization's
Program Managers, like its other libraries; Exercise Planners copy from it.

Every use is a copy: editing or deleting a library threat actor never
changes an exercise."""

import logging
import uuid
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.data.attack_catalog import (
    DOMAINS,
    LATEST_ATTACK_VERSION,
    is_live_technique,
    is_shipped,
    latest_attack_version,
    load_domain,
    load_groups,
)
from app.models import ActorOrigin, OrganizationThreatActor, User
from app.schemas.threat_actor_library import (
    OrganizationThreatActorRead,
    SystemThreatActorListResponse,
    SystemThreatActorRead,
    ThreatActorFields,
    ThreatActorTechnique,
    ThreatActorTechniqueRead,
)
from app.services.attack_conversion import ConversionReport, convert_profile

logger = logging.getLogger(__name__)


def _reject(
    code: str, message: str, status_code: int = 422, params: dict | None = None
) -> AppException:
    return AppException(code, message, status_code, log_level=logging.WARNING, params=params)


def system_catalog() -> SystemThreatActorListResponse:
    """MITRE's live groups in the latest release."""
    catalog = load_domain(LATEST_ATTACK_VERSION, DOMAINS[0])
    return SystemThreatActorListResponse(
        attack_version=LATEST_ATTACK_VERSION,
        released=catalog.released,
        copyright=catalog.copyright,
        items=[
            SystemThreatActorRead(
                id=group.id,
                name=group.name,
                aliases=list(group.aliases),
                techniques=[
                    ThreatActorTechnique(domain=domain, technique_id=technique_id)
                    for domain, technique_id in group.techniques
                ],
            )
            for group in load_groups(LATEST_ATTACK_VERSION).values()
            if not group.deprecated
        ],
    )


def technique_read(version: str, domain: str, technique_id: str) -> ThreatActorTechniqueRead:
    """A technique with its name ("Parent: Sub") and tactics in `version`;
    the id itself for one the release doesn't know, so a read never fails."""
    try:
        catalog = load_domain(version, domain)
    except KeyError:
        catalog = None
    technique = catalog.techniques.get(technique_id) if catalog else None
    name = technique.name if technique else technique_id
    if technique and technique.parent in catalog.techniques:
        name = f"{catalog.techniques[technique.parent].name}: {name}"
    return ThreatActorTechniqueRead(
        domain=domain,
        technique_id=technique_id,
        technique_name=name,
        tactic_ids=list(technique.tactics) if technique else [],
    )


def check_threat_actor(payload: ThreatActorFields) -> None:
    """What a threat actor may reference: a shipped release, a live MITRE
    group of it, live techniques of it."""
    version = payload.attack_version
    if not is_shipped(version):
        raise _reject(
            "UNKNOWN_ATTACK_VERSION",
            "ATT&CK v{version} isn't available.",
            params={"version": version},
        )
    groups = load_groups(version)
    group = groups.get(payload.mitre_group_id) if payload.mitre_group_id else None
    if payload.mitre_group_id and (group is None or group.deprecated):
        raise _reject(
            "UNKNOWN_ATTACK_GROUP",
            "{group} isn't a group of ATT&CK v{version}.",
            params={"group": payload.mitre_group_id, "version": version},
        )
    if payload.origin == ActorOrigin.SYSTEM and payload.origin_id not in groups:
        raise _reject("UNKNOWN_ATTACK_GROUP", "That MITRE ATT&CK group doesn't exist.")
    unknown = [
        t.technique_id for t in payload.techniques if not is_live_technique(version, *t.key())
    ]
    if unknown:
        raise _reject(
            "UNKNOWN_ATTACK_TECHNIQUE",
            "Not a technique of ATT&CK v{version}: {techniques}.",
            params={"version": version, "techniques": ", ".join(unknown)},
        )


def read(actor: OrganizationThreatActor) -> OrganizationThreatActorRead:
    return OrganizationThreatActorRead(
        **actor.model_dump(exclude={"techniques", "organization_id", "created_by_id"}),
        techniques=[
            technique_read(actor.attack_version, t["domain"], t["technique_id"])
            for t in actor.techniques
        ],
    )


def _get(
    session: Session, organization_id: uuid.UUID, actor_id: uuid.UUID
) -> OrganizationThreatActor:
    actor = session.get(OrganizationThreatActor, actor_id)
    if actor is None or actor.organization_id != organization_id:
        raise AppException(
            "THREAT_ACTOR_NOT_FOUND", "That threat actor isn't in this library.", 404
        )
    return actor


def _write(actor: OrganizationThreatActor, payload: ThreatActorFields) -> None:
    check_threat_actor(payload)
    actor.name = payload.name.strip()
    actor.mitre_group_id = payload.mitre_group_id
    actor.aliases = payload.aliases
    actor.description = payload.description
    actor.attack_version = payload.attack_version
    actor.techniques = [t.model_dump() for t in payload.techniques]
    actor.origin = payload.origin
    actor.origin_id = payload.origin_id if payload.origin else None
    actor.origin_name = payload.origin_name if payload.origin else None


def list_threat_actors(
    session: Session, organization_id: uuid.UUID
) -> list[OrganizationThreatActor]:
    return list(
        session.exec(
            select(OrganizationThreatActor)
            .where(OrganizationThreatActor.organization_id == organization_id)
            .order_by(OrganizationThreatActor.name)
        )
    )


def create_threat_actor(
    session: Session, organization_id: uuid.UUID, payload: ThreatActorFields, user: User
) -> OrganizationThreatActor:
    actor = OrganizationThreatActor(
        organization_id=organization_id, name="", attack_version="", created_by_id=user.id
    )
    _write(actor, payload)
    session.add(actor)
    session.commit()
    session.refresh(actor)
    logger.info(
        "Library threat actor %s created in org %s by user %s.",
        actor.id,
        organization_id,
        user.id,
    )
    return actor


def update_threat_actor(
    session: Session,
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    payload: ThreatActorFields,
    user: User,
) -> OrganizationThreatActor:
    actor = _get(session, organization_id, actor_id)
    _write(actor, payload)
    actor.updated_at = datetime.now(UTC)
    session.add(actor)
    session.commit()
    session.refresh(actor)
    return actor


def delete_threat_actor(
    session: Session, organization_id: uuid.UUID, actor_id: uuid.UUID, user: User
) -> None:
    """Exercises that copied it keep their copy."""
    actor = _get(session, organization_id, actor_id)
    session.delete(actor)
    session.commit()
    logger.info(
        "Library threat actor %s deleted from org %s by user %s.",
        actor_id,
        organization_id,
        user.id,
    )


def upgrade_library(session: Session, organization_id: uuid.UUID, user: User):
    """Move every threat actor of the organization's library onto the
    latest ATT&CK release (see attack_conversion): (how many moved, the
    report). Exercises keep their own copies as they are."""
    to_version = latest_attack_version()
    report = ConversionReport()
    upgraded = 0
    for actor in list_threat_actors(session, organization_id):
        if actor.attack_version == to_version:
            continue
        actor.mitre_group_id, pairs = convert_profile(
            actor.mitre_group_id,
            [(t["domain"], t["technique_id"]) for t in actor.techniques],
            to_version,
            report,
        )
        actor.techniques = [{"domain": d, "technique_id": t} for d, t in pairs]
        actor.attack_version = to_version
        actor.updated_at = datetime.now(UTC)
        session.add(actor)
        upgraded += 1
    session.commit()
    logger.info(
        "%s library threat actor(s) of org %s moved to ATT&CK v%s by user %s.",
        upgraded,
        organization_id,
        to_version,
        user.id,
    )
    return to_version, upgraded, report
