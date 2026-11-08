"""The inject library (Library -> Injects): TTX-Zone's read-only
catalog, each organization's own injects, and single injects added to or
removed from an exercise's MSEL (the MSEL page saves its injects whole)."""

import uuid
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from PIL import Image
from sqlmodel import Session

from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    verify_csrf,
)
from app.data.attack_catalog import names
from app.data.inject_catalog import catalog_inject, load_inject_catalog
from app.models import TTX, RoleEnum, User
from app.schemas.inject_library import (
    CatalogAttackRead,
    CatalogImageRead,
    ExerciseInjectInput,
    OrganizationInjectFields,
    OrganizationInjectListResponse,
    OrganizationInjectRead,
    SystemInjectListResponse,
    SystemInjectRead,
)
from app.schemas.library_usage import LibraryDeleteResult, LibraryUsage
from app.schemas.ttx_msel import ExerciseInjectAddedRead, LibraryAttackUpgradeRead
from app.services.actor_library_service import require_library_manager, require_library_reader
from app.services.inject_library_service import (
    create_inject,
    delete_inject,
    inject_read,
    list_injects,
    update_inject,
    upgrade_library,
)
from app.services.library_usage_service import (
    delete_or_disable,
    enable,
    get_item,
    usage,
    usage_counts,
)
from app.services.ttx_msel_service import (
    add_exercise_inject,
    msel_read,
    remove_exercise_inject,
)

router = APIRouter(tags=["inject-library"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/inject-catalog", response_model=SystemInjectListResponse)
def inject_catalog_endpoint(_user: User = Depends(get_current_user)) -> SystemInjectListResponse:
    """TTX-Zone's own injects, both languages: read-only, duplicable."""
    catalog = load_inject_catalog()
    version = catalog.attack_version
    items = []
    for inject in catalog.injects:
        attack = []
        for ref in inject.attack:
            tactic_name, technique_name = names(version, ref.domain, ref.tactic, ref.technique)
            attack.append(
                CatalogAttackRead(
                    domain=ref.domain,
                    tactic_id=ref.tactic,
                    tactic_name=tactic_name,
                    technique_id=ref.technique,
                    technique_name=technique_name,
                )
            )
        images = []
        for index, image in enumerate(inject.images):
            width, height = _image_size(str(image.path("en")))
            images.append(
                CatalogImageRead(index=index, caption=image.caption, width=width, height=height)
            )
        items.append(
            SystemInjectRead(
                **inject.model_dump(exclude={"attack", "images"}), attack=attack, images=images
            )
        )
    return SystemInjectListResponse(attack_version=version, items=items)


@lru_cache
def _image_size(path: str) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


@router.get("/inject-catalog/{inject_id}/images/{index}")
def inject_catalog_image_endpoint(
    inject_id: str,
    index: int,
    lang: Literal["en", "es"] = Query("en"),
    _user: User = Depends(get_current_user),
) -> FileResponse:
    """An illustration of a TTX-Zone inject (fictitious, part of the
    product, not exercise content) in one language."""
    inject = catalog_inject(inject_id)
    if inject is None or not 0 <= index < len(inject.images):
        raise AppException("CATALOG_IMAGE_NOT_FOUND", "Image not found.", 404)
    return FileResponse(
        inject.images[index].path(lang),
        media_type="image/png",
        content_disposition_type="inline",
        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


# -- the organization's library ----------------------------------------------------


@router.get(
    "/organizations/{organization_id}/injects", response_model=OrganizationInjectListResponse
)
def list_organization_injects_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationInjectListResponse:
    """The organization's library of injects."""
    require_library_reader(session, user, organization_id)
    counts = usage_counts(session, "inject", organization_id)
    return OrganizationInjectListResponse(
        items=[
            inject_read(i).model_copy(update={"usage_count": counts.get(str(i.id), 0)})
            for i in list_injects(session, organization_id)
        ]
    )


@router.post(
    "/organizations/{organization_id}/injects",
    response_model=OrganizationInjectRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_organization_inject_endpoint(
    organization_id: uuid.UUID,
    payload: OrganizationInjectFields,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationInjectRead:
    """Add an inject to the organization's library."""
    require_library_manager(session, user, organization_id)
    return inject_read(create_inject(session, organization_id, payload, user))


@router.patch(
    "/organizations/{organization_id}/injects/{inject_id}",
    response_model=OrganizationInjectRead,
    dependencies=[Depends(verify_csrf)],
)
def update_organization_inject_endpoint(
    organization_id: uuid.UUID,
    inject_id: uuid.UUID,
    payload: OrganizationInjectFields,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationInjectRead:
    """Change an inject of the organization's library."""
    require_library_manager(session, user, organization_id)
    return inject_read(update_inject(session, organization_id, inject_id, payload, user))


@router.delete(
    "/organizations/{organization_id}/injects/{inject_id}",
    response_model=LibraryDeleteResult,
    dependencies=[Depends(verify_csrf)],
)
def delete_organization_inject_endpoint(
    organization_id: uuid.UUID,
    inject_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryDeleteResult:
    """Delete it for good when nothing uses it (after a recent sign-in);
    otherwise disable it and say what uses it."""
    require_library_manager(session, user, organization_id)
    item = get_item(session, "inject", organization_id, inject_id)
    return delete_or_disable(
        session,
        "inject",
        item,
        user,
        lambda: delete_inject(session, organization_id, inject_id, user),
    )


@router.get(
    "/organizations/{organization_id}/injects/{inject_id}/usage", response_model=LibraryUsage
)
def organization_inject_usage_endpoint(
    organization_id: uuid.UUID,
    inject_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryUsage:
    """What deleting it would affect (asked before confirming)."""
    require_library_manager(session, user, organization_id)
    return usage(session, "inject", get_item(session, "inject", organization_id, inject_id))


@router.post(
    "/organizations/{organization_id}/injects/{inject_id}/enable",
    response_model=OrganizationInjectRead,
    dependencies=[Depends(verify_csrf)],
)
def enable_organization_inject_endpoint(
    organization_id: uuid.UUID,
    inject_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationInjectRead:
    """Undo a disable: it can be copied into exercises again."""
    require_library_manager(session, user, organization_id)
    item = get_item(session, "inject", organization_id, inject_id)
    enable(session, item)
    return inject_read(item)


# -- the exercise's MSEL -------------------------------------------------------------


@router.post(
    "/ttx/{ttx_id}/msel/injects",
    response_model=ExerciseInjectAddedRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def add_exercise_inject_endpoint(
    payload: ExerciseInjectInput,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExerciseInjectAddedRead:
    """Add one inject to the MSEL -- a copy when it comes from the library,
    its techniques moved onto the MSEL's ATT&CK release. Answers the whole
    MSEL, as its other writes do, and what the move changed."""
    msel, report = add_exercise_inject(session, ttx, payload, user)
    return ExerciseInjectAddedRead(msel=msel_read(session, ttx, msel), conversion=report.read())


@router.delete(
    "/ttx/{ttx_id}/msel/injects/{inject_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def remove_exercise_inject_endpoint(
    inject_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Remove an inject from the exercise's library."""
    remove_exercise_inject(session, ttx, inject_id, user)


@router.post(
    "/organizations/{organization_id}/injects/attack-upgrade",
    response_model=LibraryAttackUpgradeRead,
    dependencies=[Depends(verify_csrf)],
)
def upgrade_org_injects_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryAttackUpgradeRead:
    """Move the organization's injects onto the latest ATT&CK release."""
    require_library_manager(session, user, organization_id)
    version, upgraded, report = upgrade_library(session, organization_id, user)
    return LibraryAttackUpgradeRead(
        attack_version=version, upgraded=upgraded, conversion=report.read()
    )
