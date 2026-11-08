import uuid
from datetime import date, datetime

from pydantic import BaseModel


class DashboardKpis(BaseModel):
    # Org-scoped Planner grants (OrganizationMembership).
    planners: int
    # Users holding a TTX-scoped Planner grant in this org without an
    # org-scoped one -- reported separately so the headline number keeps
    # meaning "Planners of the organization".
    exercise_only_planners: int
    exercises: int
    exercises_last_30_days: int
    # Distinct users, not TTXAccess rows -- one person in three exercises
    # counts once.
    unique_players: int
    pending_requests: int
    oldest_pending_request_at: datetime | None
    # The organization's improvement plan: actions not done or cancelled,
    # and those of them past their due date.
    improvement_open: int = 0
    improvement_overdue: int = 0


class DashboardExercise(BaseModel):
    ttx_id: uuid.UUID
    name: str
    created_at: datetime
    players: int
    planners: int
    injects: int
    pending_requests: int


class DashboardAccessRequests(BaseModel):
    approved: int
    pending: int
    rejected: int


class DashboardInvitations(BaseModel):
    active: int
    revoked: int
    expired: int
    redemptions: int


class DashboardWeeklyAccess(BaseModel):
    """Access granted in one week: to Players, and to the exercise team
    (planning and control team, Evaluators, Observers) -- an exercise's
    creator, who gets in by creating it, isn't counted."""

    week_start: date
    players: int
    team: int


class OrganizationDashboardRead(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
    generated_at: datetime
    kpis: DashboardKpis
    exercises: list[DashboardExercise]
    access_requests: DashboardAccessRequests
    invitations: DashboardInvitations
    # Always DASHBOARD_WEEKS entries, oldest first, zero-filled.
    weekly_joins: list[DashboardWeeklyAccess]


class TTXDashboardKpis(BaseModel):
    players: int
    # TTX-scoped Planner grants on this exercise (its Planners).
    planners: int
    injects: int
    pending_requests: int
    oldest_pending_request_at: datetime | None


class TTXDashboardInvitation(BaseModel):
    """One invitation token and what its redemptions turned into."""

    token_id: uuid.UUID
    description: str | None
    role: str
    # "active" | "revoked" | "expired" -- "expired" also covers used up.
    status: str
    created_at: datetime
    redemptions: int
    approved: int
    pending: int
    rejected: int


class TTXDashboardRead(BaseModel):
    ttx_id: uuid.UUID
    ttx_name: str
    generated_at: datetime
    kpis: TTXDashboardKpis
    invitation_breakdown: list[TTXDashboardInvitation]
    access_requests: DashboardAccessRequests
    invitations: DashboardInvitations
    # Always DASHBOARD_WEEKS entries, oldest first, zero-filled.
    weekly_joins: list[DashboardWeeklyAccess]


class PlannerOverviewRead(BaseModel):
    """Creator -> Exercises for a Planner: organization-wide counts, and the
    Program Manager's panels over the Planner's own exercises only (never
    another manager's exercise names)."""

    organization_id: uuid.UUID
    organization_name: str
    generated_at: datetime
    exercises: int
    exercises_last_30_days: int
    # Exercises this user holds Planner access to, split by whether
    # they created it (owner) or were added to it (planning team member).
    owned_by_you: int
    co_planned_by_you: int
    # Org-scoped Planner grants, this user included.
    planners: int
    unique_players: int
    # Over the exercises this user plans: players/planners/injects/pending
    # per exercise, their access requests and invitations, and new access
    # per week (DASHBOARD_WEEKS entries, oldest first).
    my_exercises: list[DashboardExercise]
    access_requests: DashboardAccessRequests
    invitations: DashboardInvitations
    weekly_joins: list[DashboardWeeklyAccess]
