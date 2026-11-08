import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from sqlalchemy import func, or_, update
from sqlmodel import Session, col, delete, select

from app.core.exceptions import AppException
from app.core.security import is_program_manager
from app.models import (
    TTX,
    AssistantProposal,
    ImprovementAction,
    InvitationToken,
    InvitationTokenRedemption,
    InvitationTokenTagAssignment,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    RunStatus,
    TTXAccess,
    TTXAccessRequest,
    TTXAccessTagAssignment,
    TTXContextRole,
    TTXLeaveRequest,
    TTXTagAssignment,
    User,
    active_membership,
    evaluator_access,
    observer_access,
)
from app.schemas.ttx import TTXCreateRequest, TTXUpdateRequest
from app.services.ttx_conduct_prep_service import delete_conduct_preps_for_ttx
from app.services.ttx_msel_service import delete_msels_for_ttx
from app.services.ttx_needs_form_service import add_default_risks, delete_forms_for_ttx
from app.services.ttx_room_service import delete_rooms_for_ttx
from app.services.ttx_tag_service import delete_tags_for_ttx

logger = logging.getLogger(__name__)


def create_ttx(
    session: Session,
    organization_id: uuid.UUID,
    creator: User,
    payload: TTXCreateRequest,
    locale: str = "en",
    *,
    commit: bool = True,
) -> TTX:
    """The flush below also gives the exercise its code and its needs form
    (ttx_needs_form_service's before_flush hook); the form's default risks
    are added here, in the creator's language. Without `commit` the caller
    finishes the transaction (duplicate_ttx)."""
    ttx = TTX(
        name=payload.name,
        description=payload.description,
        # Its content starts in the creator's language unless they say.
        content_language=payload.content_language or locale,
        organization_id=organization_id,
        created_by_id=creator.id,
        lead_planner_id=creator.id,
    )
    session.add(ttx)
    session.flush()

    # The Planner who creates a TTX immediately gets TTX-scoped access to
    # it too -- RequiresOrgAndTTXAccess checks TTXAccess, not org
    # membership, so without this the creator couldn't manage their own
    # exercise (injects, invitations) until separately granted access.
    # The first Planner also controls it by default (the planning and
    # control team can hand that over later).
    session.add(
        TTXAccess(
            user_id=creator.id,
            ttx_id=ttx.id,
            role=RoleEnum.PLANNER,
            plans=True,
            controls=True,
            granted_by_id=creator.id,
        )
    )
    add_default_risks(session, ttx, locale)
    if not commit:
        session.flush()
        return ttx
    session.commit()
    session.refresh(ttx)

    logger.info("TTX %s created by user %s.", ttx.id, creator.id)
    return ttx


# The roles a duplicate's team keeps, each from the org grant of its name.
_TEAM_GRANT = {
    RoleEnum.PLANNER: OrgRoleEnum.PLANNER,
    RoleEnum.EVALUATOR: OrgRoleEnum.EVALUATOR,
    RoleEnum.OBSERVER: OrgRoleEnum.OBSERVER,
}


def _copy_team(session: Session, source: TTX, target: TTX, user: User) -> list[str]:
    """Seat the source's team (never its Players) on the copy, each person
    with the functions their org grants still allow; returns the names of
    those who couldn't keep a seat. The duplicator is already on it, as a
    Planner who controls (create_ttx): their other functions come along."""
    rows = list(
        session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == source.id, TTXAccess.role.in_(list(_TEAM_GRANT)))
            .order_by(TTXAccess.created_at, User.full_name)
        )
    )
    grants: dict[uuid.UUID, set[OrgRoleEnum]] = {}
    for membership in session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == source.organization_id,
            OrganizationMembership.user_id.in_([access.user_id for access, _ in rows]),
            active_membership(),
        )
    ):
        grants.setdefault(membership.user_id, set()).add(membership.role)

    skipped: list[str] = []
    for access, member in rows:
        granted = grants.get(member.id, set()) if member.is_active else set()
        evaluates = access.evaluates or access.role == RoleEnum.EVALUATOR
        observes = access.observes or access.role == RoleEnum.OBSERVER
        evaluates = evaluates and OrgRoleEnum.EVALUATOR in granted
        observes = observes and OrgRoleEnum.OBSERVER in granted and not evaluates
        team = access.role == RoleEnum.PLANNER and OrgRoleEnum.PLANNER in granted
        if member.id == user.id:
            mine = session.exec(
                select(TTXAccess).where(TTXAccess.ttx_id == target.id, TTXAccess.user_id == user.id)
            ).one()
            mine.facilitates = access.facilitates and team
            mine.evaluates, mine.observes = evaluates, observes
            mine.leads = access.leads and evaluates
            session.add(mine)
            continue
        if team:
            row = TTXAccess(
                role=RoleEnum.PLANNER,
                plans=access.plans,
                controls=access.controls,
                facilitates=access.facilitates and access.controls,
                evaluates=evaluates,
                observes=observes,
            )
        elif evaluates:
            row = TTXAccess(role=RoleEnum.EVALUATOR)
        elif observes:
            row = TTXAccess(role=RoleEnum.OBSERVER)
        else:
            skipped.append(member.full_name)
            continue
        row.user_id, row.ttx_id, row.granted_by_id = member.id, target.id, user.id
        row.leads = access.leads and evaluates
        session.add(row)
    session.flush()
    return skipped


def duplicate_ttx(
    session: Session, source: TTX, user: User, name: str, locale: str = "en"
) -> tuple[TTX, list[str]]:
    """A new exercise of the same organization with the source's design --
    what a scenario carries (scenario_service.export_ttx / apply_document:
    needs analysis, MSEL, cast, threat actors, injects and images, tags,
    rooms) -- its image and its team. Never its Players, invitations,
    access requests, sessions, session plan or after-action report; the
    needs analysis and MSEL start again as drafts. The duplicator is its
    Lead Planner. One transaction: nothing is left behind if it fails.
    Returns the copy and the names of team members who lost their seat
    (their org grant is gone)."""
    from app.services import scenario_service
    from app.services.ttx_image_service import TTX_IMAGE_DIR, ensure_ttx_image_dir

    doc = scenario_service.export_ttx(session, source, locale)
    # The requested name; the description as it is (the scenario format
    # caps it lower than the exercise does).
    doc = doc.model_copy(
        update={
            "exercise": doc.exercise.model_copy(
                update={"name": name, "description": source.description}
            )
        }
    )
    origin = (
        (source.scenario_origin, source.scenario_origin_id, source.scenario_origin_name or "")
        if source.scenario_origin and source.scenario_origin_id
        else None
    )
    ttx = create_ttx(
        session,
        source.organization_id,
        user,
        TTXCreateRequest(
            name=name,
            description=source.description,
            organization_id=source.organization_id,
            content_language=source.content_language,
        ),
        locale,
        commit=False,
    )
    skipped = _copy_team(session, source, ttx, user)

    image: Path | None = None
    if source.image_path and (TTX_IMAGE_DIR / source.image_path).is_file():
        ensure_ttx_image_dir()
        ttx.image_path = f"{uuid.uuid4()}{Path(source.image_path).suffix}"
        image = TTX_IMAGE_DIR / ttx.image_path
        image.write_bytes((TTX_IMAGE_DIR / source.image_path).read_bytes())
        session.add(ttx)
    try:
        # Commits on success, rolls back on a failed write.
        report = scenario_service.apply_document(
            session, ttx, doc, user, dry_run=False, origin=origin
        )
    except Exception:
        session.rollback()
        if image:
            image.unlink(missing_ok=True)
        raise
    if not report.ok:
        session.rollback()
        if image:
            image.unlink(missing_ok=True)
        logger.warning("Duplicating TTX %s failed: %s", source.id, [e.code for e in report.errors])
        raise AppException(
            "TTX_DUPLICATE_FAILED",
            "The exercise couldn't be duplicated.",
            422,
            ttx_id=str(source.id),
        )
    session.refresh(ttx)
    logger.info("TTX %s duplicated as %s by user %s.", source.id, ttx.id, user.id)
    return ttx, skipped


def update_ttx(session: Session, ttx: TTX, payload: TTXUpdateRequest) -> TTX:
    ttx.name = payload.name
    ttx.description = payload.description
    if payload.content_language is not None:
        ttx.content_language = payload.content_language
    session.add(ttx)
    session.commit()
    session.refresh(ttx)
    logger.info("TTX %s updated.", ttx.id)
    return ttx


def unenroll_from_ttx(
    session: Session, user: User, ttx_id: uuid.UUID, lead_successor_id: uuid.UUID | None = None
) -> None:
    """Self-service leave: removes the caller's own TTXAccess row for
    ttx_id, if any. Hard delete -- no soft-state column on TTXAccess, and
    the (user_id, ttx_id) unique constraint already lets a former member
    rejoin cleanly with a fresh invitation-token redemption later.
    """
    access = session.exec(
        select(TTXAccess).where(TTXAccess.user_id == user.id, TTXAccess.ttx_id == ttx_id)
    ).first()
    if access is None:
        raise AppException("TTX_ACCESS_NOT_FOUND", "You do not have access to this TTX.", 404)

    if access.role == RoleEnum.PLANNER:
        # A Planner leaving goes through the planning team member rules: the
        # exercise must keep at least one Planner.
        from app.services.ttx_planning_team_service import remove_planning_team_member

        remove_planning_team_member(
            session, session.get(TTX, ttx_id), user.id, user.id, lead_successor_id
        )
        logger.info("User %s left TTX %s.", user.id, ttx_id)
        return
    if access.role == RoleEnum.PLAYER:
        # A Player asks to leave; the exercise's Planners decide
        # (ttx_leave_request_service).
        raise AppException(
            "LEAVE_NEEDS_APPROVAL",
            "A Player asks to leave the exercise; its Planners decide.",
            403,
            ttx_id=str(ttx_id),
            log_level=logging.WARNING,
        )

    from app.services.ttx_planning_team_service import _delete_access_with_tags

    _delete_access_with_tags(session, access)
    session.commit()
    logger.info("User %s left TTX %s.", user.id, ttx_id)


def list_ttx_for_user(
    session: Session,
    user: User,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name"] = "created_at",
    q: str | None = None,
    organization_id: uuid.UUID | None = None,
    role: TTXContextRole | None = None,
    archived: bool | None = None,
) -> tuple[list[TTX], dict[uuid.UUID, TTXAccess], int]:
    """Every TTX the user can see, optionally narrowed to one organization
    and/or to the exercises they hold a given TTX role on. `role` counts
    explicit TTXAccess only -- a Program Manager's org-wide visibility doesn't
    make them that exercise's Planner -- so screens acting as a role
    (Creator -> Exercises as Planner) list exactly what the context
    bar's exercise selector offers for that role."""
    program_manager_orgs = select(OrganizationMembership.organization_id).where(
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
        active_membership(),
    )
    accessible_ttx_ids = select(TTXAccess.ttx_id).where(TTXAccess.user_id == user.id)
    # Organizations that disabled the user (see organization_service.delete_member).
    disabled_orgs = select(OrganizationMembership.organization_id).where(
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.disabled_at.is_not(None),
    )

    where_clause = [
        or_(
            TTX.organization_id.in_(program_manager_orgs),
            TTX.id.in_(accessible_ttx_ids),
        ),
        TTX.organization_id.not_in(disabled_orgs),
    ]
    if q:
        where_clause.append(or_(TTX.name.ilike(f"%{q}%"), TTX.code.ilike(f"%{q}%")))
    if organization_id is not None:
        where_clause.append(TTX.organization_id == organization_id)
    if role is not None:
        where_clause.append(TTX.id.in_(_ttx_ids_acting_as(user, role)))
    if archived is not None:
        where_clause.append(TTX.archived_at.is_not(None) if archived else TTX.archived_at.is_(None))

    total = session.exec(select(func.count()).select_from(TTX).where(*where_clause)).one()

    sort_column = TTX.name if sort_by == "name" else TTX.created_at
    order = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    # Stable tiebreaker among equal sort keys across paginated queries.
    items = list(
        session.exec(
            select(TTX).where(*where_clause).order_by(order, TTX.id).limit(limit).offset(offset)
        )
    )

    page_ttx_ids = [ttx.id for ttx in items]
    access_map: dict[uuid.UUID, TTXAccess] = {}
    if page_ttx_ids:
        accesses = session.exec(
            select(TTXAccess).where(
                TTXAccess.user_id == user.id,
                TTXAccess.ttx_id.in_(page_ttx_ids),
            )
        )
        access_map = {access.ttx_id: access for access in accesses}

    return items, access_map, total


def _ttx_ids_acting_as(user: User, role: TTXContextRole):
    """The exercises `user` can act on as `role` (TTXAccess.context_roles,
    in SQL)."""
    query = select(TTXAccess.ttx_id).where(TTXAccess.user_id == user.id)
    team_flag = {
        TTXContextRole.PLANNER: TTXAccess.plans,
        TTXContextRole.CONTROLLER: TTXAccess.controls,
        TTXContextRole.FACILITATOR: TTXAccess.facilitates,
    }.get(role)
    if team_flag is not None:
        return query.where(TTXAccess.role == RoleEnum.PLANNER, team_flag)
    if role == TTXContextRole.EVALUATOR:
        return query.where(evaluator_access())
    if role == TTXContextRole.OBSERVER:
        return query.where(observer_access())
    return query.where(TTXAccess.role == RoleEnum(role.value))


def delete_exercises(session: Session, ttx_ids: list[uuid.UUID]) -> list[str | None]:
    """Delete these exercises and every row that hangs off them, children
    first -- no FK here cascades: email invitations, invitation tokens
    (redemptions, tag assignments, access requests), access and leave
    requests, tag assignments, the team, the exercise's tags, session plan,
    MSEL (images unlinked on commit), needs analysis (evidence unlinked on
    commit) and the TTX rows.
    No commit; returns the exercises' image paths, for the caller to delete
    once its commit succeeds (ttx_image_service._delete_image_file). Shared
    by the exercise delete and the organization delete."""
    if not ttx_ids:
        return []
    from app.services.email_invitation_service import delete_for_ttxs

    delete_for_ttxs(session, ttx_ids)
    # The AI assistant's proposals on them, decided or not.
    session.exec(delete(AssistantProposal).where(col(AssistantProposal.ttx_id).in_(ttx_ids)))
    token_ids = list(
        session.exec(select(InvitationToken.id).where(InvitationToken.ttx_id.in_(ttx_ids)))
    )
    if token_ids:
        for row in session.exec(
            select(InvitationTokenRedemption).where(
                InvitationTokenRedemption.invitation_token_id.in_(token_ids)
            )
        ):
            session.delete(row)
        for row in session.exec(
            select(InvitationTokenTagAssignment).where(
                InvitationTokenTagAssignment.invitation_token_id.in_(token_ids)
            )
        ):
            session.delete(row)
        for row in session.exec(
            select(TTXAccessRequest).where(TTXAccessRequest.invitation_token_id.in_(token_ids))
        ):
            session.delete(row)
        session.flush()
        for row in session.exec(select(InvitationToken).where(InvitationToken.id.in_(token_ids))):
            session.delete(row)

    for row in session.exec(select(TTXAccessRequest).where(TTXAccessRequest.ttx_id.in_(ttx_ids))):
        session.delete(row)
    for row in session.exec(select(TTXLeaveRequest).where(TTXLeaveRequest.ttx_id.in_(ttx_ids))):
        session.delete(row)
    for row in session.exec(select(TTXTagAssignment).where(TTXTagAssignment.ttx_id.in_(ttx_ids))):
        session.delete(row)
    # TTXAccessTagAssignment FKs ttx_access.id with no ondelete cascade.
    access_ids = list(session.exec(select(TTXAccess.id).where(TTXAccess.ttx_id.in_(ttx_ids))))
    if access_ids:
        for row in session.exec(
            select(TTXAccessTagAssignment).where(
                TTXAccessTagAssignment.ttx_access_id.in_(access_ids)
            )
        ):
            session.delete(row)
        session.flush()
    for row in session.exec(select(TTXAccess).where(TTXAccess.ttx_id.in_(ttx_ids))):
        session.delete(row)
    # Each exercise's tags (and whatever they're still applied to).
    delete_tags_for_ttx(session, ttx_ids)
    # Conduct preps point at the exercise and its Evaluators; MSEL rows
    # (injects included) reference the needs form's objectives, so they
    # go first.
    # A session points at both snapshots: it goes before them.
    from app.services.after_action_service import delete_reports_for_ttx
    from app.services.exercise_run_service import delete_runs_for_ttx

    # Improvement actions (of other exercises) they re-test stay, unlinked.
    session.execute(
        update(ImprovementAction)
        .where(ImprovementAction.retest_ttx_id.in_(ttx_ids))
        .values(retest_ttx_id=None, retest_objective_id=None)
    )
    delete_reports_for_ttx(session, ttx_ids)
    delete_runs_for_ttx(session, ttx_ids)
    delete_conduct_preps_for_ttx(session, ttx_ids)
    delete_msels_for_ttx(session, ttx_ids)
    delete_forms_for_ttx(session, ttx_ids)
    session.flush()
    # Players' seats and injects pointed at them, both gone above.
    delete_rooms_for_ttx(session, ttx_ids)
    session.flush()

    # A user's saved default context may name one of them.
    for user in session.exec(select(User).where(User.default_ttx_id.in_(ttx_ids))):
        user.default_ttx_id = None
        session.add(user)
    # TTX images are stored on disk, not in the DB -- remember each path
    # now; the caller deletes the files once its commit has succeeded.
    image_paths: list[str | None] = []
    for ttx in session.exec(select(TTX).where(TTX.id.in_(ttx_ids))):
        image_paths.append(ttx.image_path)
        session.delete(ttx)
    session.flush()
    return image_paths


def can_delete_ttx(session: Session, user: User, ttx: TTX, access: TTXAccess | None = None) -> bool:
    """Who may delete an exercise: a Program Manager of its organization, or
    its Lead Planner (still on its planning team)."""
    if is_program_manager(session, user, ttx.organization_id):
        return True
    if ttx.lead_planner_id != user.id:
        return False
    if access is None:
        access = session.exec(
            select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == user.id)
        ).first()
    return access is not None and access.role == RoleEnum.PLANNER and access.plans


def set_archived(session: Session, ttx: TTX, user: User, archived: bool) -> TTX:
    """Archive the exercise (read-only, out of the default lists) or bring
    it back: the same people who may delete it. Never while a session is
    under way -- end it first."""
    if not can_delete_ttx(session, user, ttx):
        raise AppException(
            "TTX_ARCHIVE_FORBIDDEN",
            "Only the exercise's Lead Planner or a Program Manager can archive it.",
            403,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    if archived and ttx.archived_at is None:
        from app.services.exercise_run_service import find_run

        run = find_run(session, ttx.id)
        if run is not None and run.status in (RunStatus.LIVE, RunStatus.PAUSED):
            raise AppException(
                "RUN_IN_PROGRESS",
                "A session of this exercise is under way: end it before archiving.",
                409,
                ttx_id=str(ttx.id),
                log_level=logging.WARNING,
            )
        ttx.archived_at, ttx.archived_by_id = datetime.now(UTC), user.id
    elif not archived:
        ttx.archived_at, ttx.archived_by_id = None, None
    session.add(ttx)
    session.commit()
    session.refresh(ttx)
    logger.info("TTX %s %s by user %s.", ttx.id, "archived" if archived else "unarchived", user.id)
    return ttx


def delete_ttx(session: Session, ttx: TTX, user: User, confirmation: str) -> None:
    """Delete an exercise for good (audited by the endpoint): only
    its Lead Planner or a Program Manager, and only with its name typed."""
    if not can_delete_ttx(session, user, ttx):
        raise AppException(
            "TTX_DELETE_FORBIDDEN",
            "Only the exercise's Lead Planner or a Program Manager can delete it.",
            403,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    if confirmation.strip() != ttx.name.strip():
        raise AppException(
            "CONFIRMATION_MISMATCH",
            "Type the exercise's name exactly to delete it.",
            422,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    ttx_id, organization_id = ttx.id, ttx.organization_id
    image_paths = delete_exercises(session, [ttx_id])
    session.commit()

    from app.services.ttx_image_service import _delete_image_file

    for image_path in image_paths:
        _delete_image_file(image_path)
    logger.info("TTX %s of org %s deleted by user %s.", ttx_id, organization_id, user.id)
