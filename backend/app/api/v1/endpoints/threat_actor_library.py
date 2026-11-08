"""The threat actor library: TTX-Zone's catalog (MITRE ATT&CK's groups)
and each organization's own threat actors (Library -> Threat actors)."""

import logging
import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    verify_csrf,
)
from app.data.attack_catalog import is_shipped
from app.models import TTX, RoleEnum, User
from app.schemas.library_usage import LibraryDeleteResult, LibraryUsage
from app.schemas.threat_actor_library import (
    OrganizationThreatActorListResponse,
    OrganizationThreatActorRead,
    SystemThreatActorListResponse,
    ThreatActorFields,
    ThreatActorProfile,
)
from app.schemas.ttx_msel import (
    ExerciseThreatActorAddedRead,
    LibraryAttackUpgradeRead,
    ThreatActorProfileRead,
)
from app.services.actor_library_service import require_library_manager, require_library_reader
from app.services.attack_conversion import ConversionReport, convert_profile
from app.services.library_usage_service import (
    delete_or_disable,
    enable,
    get_item,
    usage,
    usage_counts,
)
from app.services.threat_actor_library_service import (
    create_threat_actor,
    delete_threat_actor,
    list_threat_actors,
    read,
    system_catalog,
    technique_read,
    update_threat_actor,
    upgrade_library,
)
from app.services.ttx_msel_service import (
    add_exercise_threat_actor,
    find_msel,
    remove_exercise_threat_actor,
    threat_actor_read,
)

router = APIRouter(tags=["threat-actor-library"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/threat-actor-catalog", response_model=SystemThreatActorListResponse)
def threat_actor_catalog_endpoint(
    _user: User = Depends(get_current_user),
) -> SystemThreatActorListResponse:
    """MITRE ATT&CK's groups, latest shipped release: read-only, duplicable."""
    return system_catalog()


@router.get(
    "/organizations/{organization_id}/threat-actors",
    response_model=OrganizationThreatActorListResponse,
)
def list_org_threat_actors_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationThreatActorListResponse:
    """The organization's library of threat actors."""
    require_library_reader(session, user, organization_id)
    counts = usage_counts(session, "threat_actor", organization_id)
    return OrganizationThreatActorListResponse(
        items=[
            read(a).model_copy(update={"usage_count": counts.get(str(a.id), 0)})
            for a in list_threat_actors(session, organization_id)
        ]
    )


@router.post(
    "/organizations/{organization_id}/threat-actors",
    response_model=OrganizationThreatActorRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_org_threat_actor_endpoint(
    organization_id: uuid.UUID,
    payload: ThreatActorFields,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationThreatActorRead:
    """Add a threat actor to the organization's library."""
    require_library_manager(session, user, organization_id)
    return read(create_threat_actor(session, organization_id, payload, user))


@router.patch(
    "/organizations/{organization_id}/threat-actors/{actor_id}",
    response_model=OrganizationThreatActorRead,
    dependencies=[Depends(verify_csrf)],
)
def update_org_threat_actor_endpoint(
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    payload: ThreatActorFields,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationThreatActorRead:
    """Change a threat actor of the organization's library."""
    require_library_manager(session, user, organization_id)
    return read(update_threat_actor(session, organization_id, actor_id, payload, user))


@router.delete(
    "/organizations/{organization_id}/threat-actors/{actor_id}",
    response_model=LibraryDeleteResult,
    dependencies=[Depends(verify_csrf)],
)
def delete_org_threat_actor_endpoint(
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryDeleteResult:
    """Delete it for good when nothing uses it (after a recent sign-in);
    otherwise disable it and say what uses it."""
    require_library_manager(session, user, organization_id)
    item = get_item(session, "threat_actor", organization_id, actor_id)
    return delete_or_disable(
        session,
        "threat_actor",
        item,
        user,
        lambda: delete_threat_actor(session, organization_id, actor_id, user),
    )


@router.get(
    "/organizations/{organization_id}/threat-actors/{actor_id}/usage", response_model=LibraryUsage
)
def org_threat_actor_usage_endpoint(
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryUsage:
    """What deleting it would affect (asked before confirming)."""
    require_library_manager(session, user, organization_id)
    return usage(
        session, "threat_actor", get_item(session, "threat_actor", organization_id, actor_id)
    )


@router.post(
    "/organizations/{organization_id}/threat-actors/{actor_id}/enable",
    response_model=OrganizationThreatActorRead,
    dependencies=[Depends(verify_csrf)],
)
def enable_org_threat_actor_endpoint(
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationThreatActorRead:
    """Undo a disable: it can be copied into exercises again."""
    require_library_manager(session, user, organization_id)
    item = get_item(session, "threat_actor", organization_id, actor_id)
    enable(session, item)
    return read(item)


# -- the exercise's scenario ----------------------------------------------------------


@router.post(
    "/ttx/{ttx_id}/msel/threat-actors",
    response_model=ExerciseThreatActorAddedRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def add_exercise_threat_actor_endpoint(
    payload: ThreatActorFields,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExerciseThreatActorAddedRead:
    """A copy of a library threat actor added to the scenario, moved onto
    the MSEL's ATT&CK release; answers what the move changed."""
    actor, report = add_exercise_threat_actor(session, ttx, payload, user)
    return ExerciseThreatActorAddedRead(
        actor=threat_actor_read(actor, find_msel(session, ttx.id).attack_version),
        conversion=report.read(),
    )


@router.delete(
    "/ttx/{ttx_id}/msel/threat-actors/{actor_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def remove_exercise_threat_actor_endpoint(
    actor_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Remove a threat actor from the exercise."""
    remove_exercise_threat_actor(session, ttx, actor_id, user)


@router.post(
    "/organizations/{organization_id}/threat-actors/attack-upgrade",
    response_model=LibraryAttackUpgradeRead,
    dependencies=[Depends(verify_csrf)],
)
def upgrade_org_threat_actors_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryAttackUpgradeRead:
    """Move the organization's threat actors onto the latest ATT&CK release."""
    require_library_manager(session, user, organization_id)
    version, upgraded, report = upgrade_library(session, organization_id, user)
    return LibraryAttackUpgradeRead(
        attack_version=version, upgraded=upgraded, conversion=report.read()
    )


@router.post(
    "/attack/{version}/threat-actor",
    response_model=ThreatActorProfileRead,
    dependencies=[Depends(verify_csrf)],
)
def convert_threat_actor_endpoint(
    version: str,
    payload: ThreatActorProfile,
    _user: User = Depends(get_current_user),
) -> ThreatActorProfileRead:
    """A threat actor's group and profile moved onto `version`, saving
    nothing: how the MSEL page adds a library actor to its draft."""
    if not is_shipped(version):
        raise AppException(
            "UNKNOWN_ATTACK_VERSION",
            "No ATT&CK v{version} in this build.",
            404,
            log_level=logging.WARNING,
            params={"version": version},
        )
    report = ConversionReport()
    group_id, pairs = convert_profile(
        payload.mitre_group_id, [t.key() for t in payload.techniques], version, report
    )
    return ThreatActorProfileRead(
        mitre_group_id=group_id,
        techniques=[technique_read(version, d, t) for d, t in pairs],
        conversion=report.read(),
    )
