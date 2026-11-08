"""Read-only aggregates for dashboards.

Every figure is computed with grouped SQL aggregates over the whole
scope -- a fixed number of queries regardless of how many exercises the
organization has, never one query per exercise (same no-N+1 stance as
ttx_tag_service.list_tags_for_ttxs). Future per-TTX dashboards (Creator,
Execution) add their own entry point here and reuse the private helpers
below with a narrower `ttx_ids` scope, as get_ttx_dashboard does.
"""

import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import and_, case, func, or_
from sqlmodel import Session, select

from app.models import (
    TTX,
    AccessRequestStatus,
    Inject,
    InvitationToken,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
    User,
    active_membership,
)
from app.schemas.dashboard import (
    DashboardAccessRequests,
    DashboardExercise,
    DashboardInvitations,
    DashboardKpis,
    DashboardWeeklyAccess,
    OrganizationDashboardRead,
    PlannerOverviewRead,
    TTXDashboardInvitation,
    TTXDashboardKpis,
    TTXDashboardRead,
)
from app.services.organization_service import get_organization

DASHBOARD_WEEKS = 12
RECENT_EXERCISE_DAYS = 30


def _utcnow() -> datetime:
    # Timestamps are aware UTC end to end (SQLModel's UTCDateTime), so every
    # comparison and bound parameter uses an aware UTC "now".
    return datetime.now(UTC)


def _week_start(day: date) -> date:
    # Monday, matching Postgres date_trunc('week', ...).
    return day - timedelta(days=day.weekday())


def _access_counts(session: Session, ttx_ids) -> dict[tuple[uuid.UUID, RoleEnum], int]:
    rows = session.exec(
        select(TTXAccess.ttx_id, TTXAccess.role, func.count())
        .where(TTXAccess.ttx_id.in_(ttx_ids))
        .group_by(TTXAccess.ttx_id, TTXAccess.role)
    )
    return {(ttx_id, role): count for ttx_id, role, count in rows}


def _inject_counts(session: Session, ttx_ids) -> dict[uuid.UUID, int]:
    rows = session.exec(
        select(Inject.ttx_id, func.count())
        .where(Inject.ttx_id.in_(ttx_ids))
        .group_by(Inject.ttx_id)
    )
    return dict(rows.all())


def _request_counts(session: Session, ttx_ids) -> dict[tuple[uuid.UUID, AccessRequestStatus], int]:
    rows = session.exec(
        select(TTXAccessRequest.ttx_id, TTXAccessRequest.status, func.count())
        .where(TTXAccessRequest.ttx_id.in_(ttx_ids))
        .group_by(TTXAccessRequest.ttx_id, TTXAccessRequest.status)
    )
    return {(ttx_id, status): count for ttx_id, status, count in rows}


def _invitation_summary(session: Session, ttx_ids, now: datetime) -> DashboardInvitations:
    revoked = InvitationToken.revoked_at.is_not(None)
    # "Expired" covers both ways a live token stops working on its own:
    # past its expiry date, or out of uses.
    exhausted = and_(
        InvitationToken.max_uses.is_not(None),
        InvitationToken.redemption_count >= InvitationToken.max_uses,
    )
    expired = and_(~revoked, or_(InvitationToken.expires_at < now, exhausted))
    active = and_(~revoked, InvitationToken.expires_at >= now, ~exhausted)
    row = session.exec(
        select(
            func.count(case((active, 1))),
            func.count(case((revoked, 1))),
            func.count(case((expired, 1))),
            func.coalesce(func.sum(InvitationToken.redemption_count), 0),
        ).where(InvitationToken.ttx_id.in_(ttx_ids))
    ).one()
    return DashboardInvitations(active=row[0], revoked=row[1], expired=row[2], redemptions=row[3])


def _weekly_access(session: Session, ttx_ids, now: datetime) -> list[DashboardWeeklyAccess]:
    """Access granted to these exercises per week -- to Players and to the
    exercise team (planning and control team, Evaluators, Observers) --
    always DASHBOARD_WEEKS entries, oldest first. An exercise's creator
    gets their Planner row by creating it: that isn't access being
    granted, so it isn't counted."""
    first_week = _week_start(now.date()) - timedelta(weeks=DASHBOARD_WEEKS - 1)
    # created_at is TIMESTAMP WITH TIME ZONE: bucket by the UTC calendar
    # week explicitly -- a bare date_trunc would use the session's TimeZone.
    week = func.date_trunc("week", func.timezone("UTC", TTXAccess.created_at))
    is_player = TTXAccess.role == RoleEnum.PLAYER
    rows = session.exec(
        select(week, is_player, func.count())
        .join(TTX, TTX.id == TTXAccess.ttx_id)
        .where(
            TTXAccess.ttx_id.in_(ttx_ids),
            TTXAccess.created_at >= datetime.combine(first_week, time.min, tzinfo=UTC),
            ~and_(TTXAccess.role == RoleEnum.PLANNER, TTXAccess.user_id == TTX.created_by_id),
        )
        .group_by(week, is_player)
    )
    by_week: dict[date, dict[bool, int]] = {}
    for bucket, player, count in rows:
        by_week.setdefault(bucket.date(), {})[bool(player)] = count
    weeks = [first_week + timedelta(weeks=i) for i in range(DASHBOARD_WEEKS)]
    return [
        DashboardWeeklyAccess(
            week_start=w,
            players=by_week.get(w, {}).get(True, 0),
            team=by_week.get(w, {}).get(False, 0),
        )
        for w in weeks
    ]


def _exercise_breakdown(session: Session, exercises, ttx_ids) -> list[DashboardExercise]:
    """Per exercise (id, name, created_at rows): players, planners,
    injects and pending requests -- one grouped query each."""
    access = _access_counts(session, ttx_ids)
    injects = _inject_counts(session, ttx_ids)
    pending = _request_counts(session, ttx_ids)
    return [
        DashboardExercise(
            ttx_id=ttx_id,
            name=name,
            created_at=created_at,
            players=access.get((ttx_id, RoleEnum.PLAYER), 0),
            planners=access.get((ttx_id, RoleEnum.PLANNER), 0),
            injects=injects.get(ttx_id, 0),
            pending_requests=pending.get((ttx_id, AccessRequestStatus.PENDING), 0),
        )
        for ttx_id, name, created_at in exercises
    ]


def _total_requests(request_counts, status: AccessRequestStatus) -> int:
    return sum(count for (_, s), count in request_counts.items() if s == status)


def _access_requests(session: Session, ttx_ids) -> DashboardAccessRequests:
    counts = _request_counts(session, ttx_ids)
    return DashboardAccessRequests(
        approved=_total_requests(counts, AccessRequestStatus.APPROVED),
        pending=_total_requests(counts, AccessRequestStatus.PENDING),
        rejected=_total_requests(counts, AccessRequestStatus.REJECTED),
    )


def _token_status(token: InvitationToken, now: datetime) -> str:
    # Same classification as _invitation_summary, per row.
    if token.revoked_at is not None:
        return "revoked"
    exhausted = token.max_uses is not None and token.redemption_count >= token.max_uses
    if token.expires_at < now or exhausted:
        return "expired"
    return "active"


def _oldest_pending(session: Session, ttx_ids) -> datetime | None:
    return session.exec(
        select(func.min(TTXAccessRequest.created_at)).where(
            TTXAccessRequest.ttx_id.in_(ttx_ids),
            TTXAccessRequest.status == AccessRequestStatus.PENDING,
        )
    ).one()


def get_organization_dashboard(
    session: Session, organization_id: uuid.UUID
) -> OrganizationDashboardRead:
    """Caller (the endpoint) is already authorized via require_program_manager."""
    organization = get_organization(session, organization_id)
    now = _utcnow()
    ttx_ids = select(TTX.id).where(TTX.organization_id == organization_id)

    exercises = list(
        session.exec(
            select(TTX.id, TTX.name, TTX.created_at)
            .where(TTX.organization_id == organization_id)
            .order_by(TTX.created_at.desc())
        )
    )
    request_counts = _request_counts(session, ttx_ids)

    org_planner_ids = select(OrganizationMembership.user_id).where(
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.role == OrgRoleEnum.PLANNER,
        active_membership(),
    )
    planners = session.exec(select(func.count()).select_from(org_planner_ids.subquery())).one()
    exercise_only_planners = session.exec(
        select(func.count(func.distinct(TTXAccess.user_id))).where(
            TTXAccess.ttx_id.in_(ttx_ids),
            TTXAccess.role == RoleEnum.PLANNER,
            TTXAccess.user_id.not_in(org_planner_ids),
        )
    ).one()
    unique_players = session.exec(
        select(func.count(func.distinct(TTXAccess.user_id))).where(
            TTXAccess.ttx_id.in_(ttx_ids), TTXAccess.role == RoleEnum.PLAYER
        )
    ).one()
    oldest_pending = _oldest_pending(session, ttx_ids)

    def total_requests(status: AccessRequestStatus) -> int:
        return sum(count for (_, s), count in request_counts.items() if s == status)

    recent_cutoff = now - timedelta(days=RECENT_EXERCISE_DAYS)
    recent_exercises = sum(1 for _, _, created in exercises if created >= recent_cutoff)
    from app.services.after_action_service import organization_plan

    plan = organization_plan(
        session, organization_id, status=None, overdue=False, q=None, limit=1, offset=0
    )
    return OrganizationDashboardRead(
        organization_id=organization.id,
        organization_name=organization.name,
        generated_at=now,
        kpis=DashboardKpis(
            planners=planners,
            exercise_only_planners=exercise_only_planners,
            exercises=len(exercises),
            exercises_last_30_days=recent_exercises,
            unique_players=unique_players,
            pending_requests=total_requests(AccessRequestStatus.PENDING),
            oldest_pending_request_at=oldest_pending,
            improvement_open=plan.open,
            improvement_overdue=plan.overdue,
        ),
        exercises=_exercise_breakdown(session, exercises, ttx_ids),
        access_requests=DashboardAccessRequests(
            approved=total_requests(AccessRequestStatus.APPROVED),
            pending=total_requests(AccessRequestStatus.PENDING),
            rejected=total_requests(AccessRequestStatus.REJECTED),
        ),
        invitations=_invitation_summary(session, ttx_ids, now),
        weekly_joins=_weekly_access(session, ttx_ids, now),
    )


def get_ttx_dashboard(session: Session, ttx: TTX) -> TTXDashboardRead:
    """Caller (the endpoint) is already authorized via RequiresOrgAndTTXAccess."""
    now = _utcnow()
    ttx_ids = [ttx.id]
    access = _access_counts(session, ttx_ids)
    request_counts = _request_counts(session, ttx_ids)

    tokens = list(
        session.exec(
            select(InvitationToken)
            .where(InvitationToken.ttx_id == ttx.id)
            .order_by(InvitationToken.created_at.desc())
        )
    )
    by_token = {
        (token_id, status): count
        for token_id, status, count in session.exec(
            select(TTXAccessRequest.invitation_token_id, TTXAccessRequest.status, func.count())
            .where(TTXAccessRequest.ttx_id == ttx.id)
            .group_by(TTXAccessRequest.invitation_token_id, TTXAccessRequest.status)
        )
    }

    def requests(status: AccessRequestStatus) -> int:
        return request_counts.get((ttx.id, status), 0)

    return TTXDashboardRead(
        ttx_id=ttx.id,
        ttx_name=ttx.name,
        generated_at=now,
        kpis=TTXDashboardKpis(
            players=access.get((ttx.id, RoleEnum.PLAYER), 0),
            planners=access.get((ttx.id, RoleEnum.PLANNER), 0),
            injects=_inject_counts(session, ttx_ids).get(ttx.id, 0),
            pending_requests=requests(AccessRequestStatus.PENDING),
            oldest_pending_request_at=_oldest_pending(session, ttx_ids),
        ),
        invitation_breakdown=[
            TTXDashboardInvitation(
                token_id=token.id,
                description=token.description,
                role=token.role.value,
                status=_token_status(token, now),
                created_at=token.created_at,
                redemptions=token.redemption_count,
                approved=by_token.get((token.id, AccessRequestStatus.APPROVED), 0),
                pending=by_token.get((token.id, AccessRequestStatus.PENDING), 0),
                rejected=by_token.get((token.id, AccessRequestStatus.REJECTED), 0),
            )
            for token in tokens
        ],
        access_requests=DashboardAccessRequests(
            approved=requests(AccessRequestStatus.APPROVED),
            pending=requests(AccessRequestStatus.PENDING),
            rejected=requests(AccessRequestStatus.REJECTED),
        ),
        invitations=_invitation_summary(session, ttx_ids, now),
        weekly_joins=_weekly_access(session, ttx_ids, now),
    )


def get_planner_overview(
    session: Session, organization_id: uuid.UUID, user: User
) -> PlannerOverviewRead:
    """Creator's landing view for a Planner of the organization: counts
    only, never other managers' exercise names -- an org-level Planner
    doesn't see exercises they don't manage. Caller is already authorized
    via require_planner."""
    organization = get_organization(session, organization_id)
    now = _utcnow()
    in_org = TTX.organization_id == organization_id
    ttx_ids = select(TTX.id).where(in_org)

    exercises, recent = session.exec(
        select(
            func.count(),
            func.count(case((TTX.created_at >= now - timedelta(days=RECENT_EXERCISE_DAYS), 1))),
        ).where(in_org)
    ).one()
    # Exercises this user manages, split by whether they created it.
    owned, co_planned = session.exec(
        select(
            func.count(case((TTX.created_by_id == user.id, 1))),
            func.count(case((TTX.created_by_id != user.id, 1))),
        )
        .join(TTXAccess, TTXAccess.ttx_id == TTX.id)
        .where(in_org, TTXAccess.user_id == user.id, TTXAccess.role == RoleEnum.PLANNER)
    ).one()
    planners = session.exec(
        select(func.count()).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
            active_membership(),
        )
    ).one()
    unique_players = session.exec(
        select(func.count(func.distinct(TTXAccess.user_id))).where(
            TTXAccess.ttx_id.in_(ttx_ids), TTXAccess.role == RoleEnum.PLAYER
        )
    ).one()
    # The Program Manager's panels, over the exercises this user plans only.
    my_ttx_ids = (
        select(TTXAccess.ttx_id)
        .join(TTX, TTX.id == TTXAccess.ttx_id)
        .where(in_org, TTXAccess.user_id == user.id, TTXAccess.role == RoleEnum.PLANNER)
    )
    mine = list(
        session.exec(
            select(TTX.id, TTX.name, TTX.created_at)
            .where(TTX.id.in_(my_ttx_ids))
            .order_by(TTX.created_at.desc())
        )
    )
    return PlannerOverviewRead(
        organization_id=organization.id,
        organization_name=organization.name,
        generated_at=now,
        exercises=exercises,
        exercises_last_30_days=recent,
        owned_by_you=owned,
        co_planned_by_you=co_planned,
        planners=planners,
        unique_players=unique_players,
        my_exercises=_exercise_breakdown(session, mine, my_ttx_ids),
        access_requests=_access_requests(session, my_ttx_ids),
        invitations=_invitation_summary(session, my_ttx_ids, now),
        weekly_joins=_weekly_access(session, my_ttx_ids, now),
    )
