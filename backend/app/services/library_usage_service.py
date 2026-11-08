"""What uses an organization library item -- simulated actor, threat actor,
inject, tag or scenario -- and deleting one safely.

Exercises hold copies of library items, never pointers: a copy records its
original in `origin=organization` + `origin_id`. Those copies, plus the
library's own links (an inject template sent by an actor; a tag applied to
the organization, its members or its allowed domains), are the item's uses.
A scenario's uses are the exercises it was last copied onto
(`TTX.scenario_origin`/`scenario_origin_id`).

Deleting an item still in use disables it instead (`disabled_at`): it stays
in the library, marked, but pickers hide it and it can't be copied again.
Once nothing uses it, deleting it again removes it for good -- that last
step is irreversible, so it asks for a recent sign-in."""

import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Literal

from sqlmodel import Session, func, select

from app.core.exceptions import AppException
from app.models import (
    TTX,
    ActorOrigin,
    AllowedDomainTagAssignment,
    Inject,
    MembershipTagAssignment,
    MselSimulatedActor,
    MselThreatActor,
    OrganizationActor,
    OrganizationInject,
    OrganizationScenario,
    OrganizationTag,
    OrganizationThreatActor,
    TTXMsel,
    TTXTag,
    User,
)
from app.schemas.library_usage import (
    LibraryDeleteResult,
    LibraryUsage,
    LibraryUsageExercise,
    LibraryUsageInject,
)
from app.services import platform_audit_service

logger = logging.getLogger(__name__)

LibraryKind = Literal["actor", "threat_actor", "inject", "tag", "scenario"]
LibraryItem = (
    OrganizationActor
    | OrganizationThreatActor
    | OrganizationInject
    | OrganizationTag
    | OrganizationScenario
)

_ITEM_MODELS: dict[LibraryKind, type] = {
    "actor": OrganizationActor,
    "threat_actor": OrganizationThreatActor,
    "inject": OrganizationInject,
    "tag": OrganizationTag,
    "scenario": OrganizationScenario,
}


_NOT_FOUND: dict[LibraryKind, tuple[str, str]] = {
    "actor": ("ACTOR_NOT_FOUND", "That actor isn't in this library."),
    "threat_actor": ("THREAT_ACTOR_NOT_FOUND", "That threat actor isn't in this library."),
    "inject": ("INJECT_NOT_FOUND", "That inject isn't in this library."),
    "tag": ("TAG_NOT_FOUND", "This tag was not found."),
    "scenario": ("SCENARIO_NOT_FOUND", "That scenario isn't in this library."),
}


def get_item(
    session: Session, kind: LibraryKind, organization_id: uuid.UUID, item_id: uuid.UUID
) -> LibraryItem:
    item = session.get(_ITEM_MODELS[kind], item_id)
    if item is None or item.organization_id != organization_id:
        code, message = _NOT_FOUND[kind]
        raise AppException(code, message, 404, log_level=logging.WARNING)
    return item


def _copies_by_exercise(session: Session, kind: LibraryKind, organization_id: uuid.UUID):
    """(origin_id, ttx id, ttx name, copies) for every exercise of the
    organization holding copies of one of its library items of `kind`."""
    if kind == "scenario":
        return (
            select(TTX.scenario_origin_id, TTX.id, TTX.name, func.count())
            .where(
                TTX.scenario_origin == ActorOrigin.ORGANIZATION.value,
                TTX.scenario_origin_id.is_not(None),
                TTX.organization_id == organization_id,
            )
            .group_by(TTX.scenario_origin_id, TTX.id, TTX.name)
        )
    if kind == "threat_actor":
        copy = MselThreatActor
        query = (
            select(copy.origin_id, TTX.id, TTX.name, func.count())
            .join(TTXMsel, TTXMsel.id == copy.msel_id)
            .join(TTX, TTX.id == TTXMsel.ttx_id)
        )
    else:
        copy = {"actor": MselSimulatedActor, "inject": Inject, "tag": TTXTag}[kind]
        query = select(copy.origin_id, TTX.id, TTX.name, func.count()).join(
            TTX, TTX.id == copy.ttx_id
        )
    return query.where(
        copy.origin == ActorOrigin.ORGANIZATION,
        copy.origin_id.is_not(None),
        TTX.organization_id == organization_id,
    ).group_by(copy.origin_id, TTX.id, TTX.name)


def usage(session: Session, kind: LibraryKind, item: LibraryItem) -> LibraryUsage:
    item_id = str(item.id)
    rows = session.exec(
        _copies_by_exercise(session, kind, item.organization_id)
        .where(_copy_origin_id(kind) == item_id)
        .order_by(TTX.name)
    ).all()
    result = LibraryUsage(
        exercises=[
            LibraryUsageExercise(ttx_id=ttx_id, name=name, copies=copies)
            for _, ttx_id, name, copies in rows
        ]
    )
    if kind == "actor":
        result.injects = [
            LibraryUsageInject(id=inject.id, title=inject.title)
            for inject in session.exec(
                select(OrganizationInject)
                .where(
                    OrganizationInject.organization_id == item.organization_id,
                    OrganizationInject.actor_origin == ActorOrigin.ORGANIZATION,
                    OrganizationInject.actor_origin_id == item_id,
                )
                .order_by(OrganizationInject.title)
            )
        ]
    if kind == "tag":
        result.memberships = session.exec(
            select(func.count())
            .select_from(MembershipTagAssignment)
            .where(MembershipTagAssignment.organization_tag_id == item.id)
        ).one()
        result.allowed_domains = session.exec(
            select(func.count())
            .select_from(AllowedDomainTagAssignment)
            .where(AllowedDomainTagAssignment.organization_tag_id == item.id)
        ).one()
        result.applied_to_organization = item.applied
    result.total = (
        len(result.exercises)
        + len(result.injects)
        + result.memberships
        + result.allowed_domains
        + int(result.applied_to_organization)
    )
    return result


def _copy_origin_id(kind: LibraryKind):
    if kind == "scenario":
        return TTX.scenario_origin_id
    return {
        "actor": MselSimulatedActor,
        "threat_actor": MselThreatActor,
        "inject": Inject,
        "tag": TTXTag,
    }[kind].origin_id


def usage_counts(session: Session, kind: LibraryKind, organization_id: uuid.UUID) -> dict[str, int]:
    """Each item's `usage().total`, for a whole library list at once (keyed
    by the item's id as a string)."""
    counts: dict[str, int] = {}

    def add(item_id: str | None, n: int = 1) -> None:
        if item_id is not None:
            counts[item_id] = counts.get(item_id, 0) + n

    for origin_id, _, _, _ in session.exec(_copies_by_exercise(session, kind, organization_id)):
        add(origin_id)
    if kind == "actor":
        for actor_id in session.exec(
            select(OrganizationInject.actor_origin_id).where(
                OrganizationInject.organization_id == organization_id,
                OrganizationInject.actor_origin == ActorOrigin.ORGANIZATION,
            )
        ):
            add(actor_id)
    if kind == "tag":
        for model in (MembershipTagAssignment, AllowedDomainTagAssignment):
            for tag_id, n in session.exec(
                select(model.organization_tag_id, func.count())
                .join(OrganizationTag, OrganizationTag.id == model.organization_tag_id)
                .where(OrganizationTag.organization_id == organization_id)
                .group_by(model.organization_tag_id)
            ):
                add(str(tag_id), n)
        for tag_id in session.exec(
            select(OrganizationTag.id).where(
                OrganizationTag.organization_id == organization_id,
                OrganizationTag.applied.is_(True),
            )
        ):
            add(str(tag_id))
    return counts


def delete_or_disable(
    session: Session,
    kind: LibraryKind,
    item: LibraryItem,
    user: User,
    delete: Callable[[], None],
) -> LibraryDeleteResult:
    """Disable `item` while anything uses it; otherwise `delete()` it for
    good (no step-up: the activity log records who deleted what)."""
    found = usage(session, kind, item)
    if found.total:
        if item.disabled_at is None:
            item.disabled_at = datetime.now(UTC)
            session.add(item)
            session.commit()
            logger.info(
                "Library %s %s disabled in org %s by user %s (still in use).",
                kind,
                item.id,
                item.organization_id,
                user.id,
            )
        return LibraryDeleteResult(result="disabled", usage=found)
    item_id, organization_id = item.id, item.organization_id
    label = getattr(item, "name", None) or getattr(item, "title", None) or str(item_id)
    delete()
    platform_audit_service.record(
        session,
        user,
        "library.item_delete",
        "organization",
        organization_id,
        str(label)[:320],
        {"kind": kind, "item_id": str(item_id)},
    )
    return LibraryDeleteResult(result="deleted", usage=found)


def enable(session: Session, item: LibraryItem) -> None:
    item.disabled_at = None
    session.add(item)
    session.commit()
    session.refresh(item)


def ensure_not_disabled(
    session: Session,
    kind: LibraryKind,
    organization_id: uuid.UUID,
    origin: ActorOrigin | None,
    origin_id: str | None,
) -> None:
    """Refuse a new copy of a disabled library item of the organization."""
    if origin != ActorOrigin.ORGANIZATION or not origin_id:
        return
    try:
        item_id = uuid.UUID(origin_id)
    except ValueError:
        return
    item = session.get(_ITEM_MODELS[kind], item_id)
    if item is not None and item.organization_id == organization_id and item.disabled_at:
        raise AppException(
            "LIBRARY_ITEM_DISABLED",
            "That library item is disabled: enable it in the library to use it again.",
            409,
            log_level=logging.WARNING,
        )
