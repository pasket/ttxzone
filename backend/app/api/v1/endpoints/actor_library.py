"""The simulated actor library: TTX-Zone's read-only catalog, each
organization's own actors, and single-row writes to an exercise's cast
(Library -> Simulated actors; the MSEL page saves the cast whole)."""

import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.i18n import get_locale
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    verify_csrf,
)
from app.data.actor_catalog import ACTOR_CATALOG
from app.models import TTX, OrganizationActor, RoleEnum, User
from app.schemas.actor_library import (
    ActorFields,
    ExerciseActorInput,
    ExerciseActorListResponse,
    ExerciseActorRead,
    OrganizationActorListResponse,
    OrganizationActorRead,
    SystemActorListResponse,
    SystemActorRead,
)
from app.schemas.library_usage import LibraryDeleteResult, LibraryUsage
from app.schemas.ttx_msel import ActorRead
from app.services.actor_library_service import (
    create_actor,
    delete_actor,
    list_actors,
    require_library_manager,
    require_library_reader,
    update_actor,
)
from app.services.library_usage_service import (
    delete_or_disable,
    enable,
    get_item,
    usage,
    usage_counts,
)
from app.services.ttx_msel_service import (
    actor_read,
    add_exercise_actor,
    list_cast,
    remove_exercise_actor,
    update_exercise_actor,
)

router = APIRouter(tags=["actor-library"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


def _read(actor: OrganizationActor, usage_count: int = 0) -> OrganizationActorRead:
    read = OrganizationActorRead.model_validate(actor, from_attributes=True)
    read.usage_count = usage_count
    return read


@router.get("/actor-catalog", response_model=SystemActorListResponse)
def actor_catalog_endpoint(_user: User = Depends(get_current_user)) -> SystemActorListResponse:
    """TTX-Zone's own actors, both languages: read-only, duplicable."""
    return SystemActorListResponse(
        items=[
            SystemActorRead(
                id=a.id,
                type=a.type,
                name_en=a.name_en,
                name_es=a.name_es,
                description_en=a.description_en,
                description_es=a.description_es,
                channel=a.channel,
                default=a.default,
            )
            for a in ACTOR_CATALOG
        ]
    )


@router.get("/organizations/{organization_id}/actors", response_model=OrganizationActorListResponse)
def list_org_actors_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationActorListResponse:
    """The organization's library of simulated actors."""
    require_library_reader(session, user, organization_id)
    counts = usage_counts(session, "actor", organization_id)
    return OrganizationActorListResponse(
        items=[_read(a, counts.get(str(a.id), 0)) for a in list_actors(session, organization_id)]
    )


@router.post(
    "/organizations/{organization_id}/actors",
    response_model=OrganizationActorRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_org_actor_endpoint(
    organization_id: uuid.UUID,
    payload: ActorFields,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationActorRead:
    """Add a simulated actor to the organization's library."""
    require_library_manager(session, user, organization_id)
    return _read(create_actor(session, organization_id, payload, user))


@router.patch(
    "/organizations/{organization_id}/actors/{actor_id}",
    response_model=OrganizationActorRead,
    dependencies=[Depends(verify_csrf)],
)
def update_org_actor_endpoint(
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    payload: ActorFields,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationActorRead:
    """Change a simulated actor of the organization's library."""
    require_library_manager(session, user, organization_id)
    return _read(update_actor(session, organization_id, actor_id, payload, user))


@router.delete(
    "/organizations/{organization_id}/actors/{actor_id}",
    response_model=LibraryDeleteResult,
    dependencies=[Depends(verify_csrf)],
)
def delete_org_actor_endpoint(
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryDeleteResult:
    """Delete it for good when nothing uses it (after a recent sign-in);
    otherwise disable it and say what uses it."""
    require_library_manager(session, user, organization_id)
    item = get_item(session, "actor", organization_id, actor_id)
    return delete_or_disable(
        session,
        "actor",
        item,
        user,
        lambda: delete_actor(session, organization_id, actor_id, user),
    )


@router.get("/organizations/{organization_id}/actors/{actor_id}/usage", response_model=LibraryUsage)
def org_actor_usage_endpoint(
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryUsage:
    """What deleting it would affect (asked before confirming)."""
    require_library_manager(session, user, organization_id)
    return usage(session, "actor", get_item(session, "actor", organization_id, actor_id))


@router.post(
    "/organizations/{organization_id}/actors/{actor_id}/enable",
    response_model=OrganizationActorRead,
    dependencies=[Depends(verify_csrf)],
)
def enable_org_actor_endpoint(
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationActorRead:
    """Undo a disable: it can be copied into exercises again."""
    require_library_manager(session, user, organization_id)
    item = get_item(session, "actor", organization_id, actor_id)
    enable(session, item)
    return _read(item)


@router.get("/ttx/{ttx_id}/actors", response_model=ExerciseActorListResponse)
def list_exercise_actors_endpoint(
    ttx: TTX = Depends(_planner),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ExerciseActorListResponse:
    """The exercise's cast (seeded with TTX-Zone's defaults on first use),
    each with whether an inject sends it."""
    return ExerciseActorListResponse(
        items=[
            ExerciseActorRead(**actor_read(actor).model_dump(), in_use=in_use)
            for actor, in_use in list_cast(session, ttx, locale)
        ]
    )


@router.post(
    "/ttx/{ttx_id}/actors",
    response_model=ActorRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def add_exercise_actor_endpoint(
    payload: ExerciseActorInput,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ActorRead:
    """Add one actor to the exercise's cast -- a copy when it comes from
    the library. Independent of the needs analysis and the MSEL."""
    return actor_read(add_exercise_actor(session, ttx, payload, user))


@router.patch(
    "/ttx/{ttx_id}/actors/{actor_id}",
    response_model=ActorRead,
    dependencies=[Depends(verify_csrf)],
)
def update_exercise_actor_endpoint(
    actor_id: uuid.UUID,
    payload: ExerciseActorInput,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ActorRead:
    """Change a simulated actor of the exercise's library."""
    return actor_read(update_exercise_actor(session, ttx, actor_id, payload, user))


@router.delete(
    "/ttx/{ttx_id}/actors/{actor_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def remove_exercise_actor_endpoint(
    actor_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Remove a simulated actor from the exercise's library."""
    remove_exercise_actor(session, ttx, actor_id, user)
