import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Index, UniqueConstraint, and_, or_, text
from sqlmodel import Field, SQLModel


class RoleEnum(StrEnum):
    """TTX-scoped roles: PLANNER is a member of the exercise's planning and
    control team (what they do on it -- plan, control, facilitate -- is in
    the row's flags); EVALUATOR rates the exercise with the EEG and
    OBSERVER watches it, neither with access to the design; PLAYER plays
    it."""

    PLANNER = "planner"
    EVALUATOR = "evaluator"
    OBSERVER = "observer"
    PLAYER = "player"


class TTXContextRole(StrEnum):
    """What a user acts as on one exercise, derived from their TTXAccess
    row: a planning and control team member (role PLANNER) can act as
    Planner (`plans`), Controller (`controls`), Facilitator
    (`facilitates`), and -- when also assigned so -- Evaluator
    (`evaluates`) and Observer (`observes`); every other role acts as
    itself. Values match
    RoleEnum's where they overlap, so guards accept either enum."""

    PLANNER = "planner"
    CONTROLLER = "controller"
    FACILITATOR = "facilitator"
    EVALUATOR = "evaluator"
    OBSERVER = "observer"
    PLAYER = "player"


class TTXAccess(SQLModel, table=True):
    """TTX-scoped role grant. Planner/Player are both scoped to a
    specific ttx_id here -- there is no global/org-wide Planner role in
    this table (org-scoped Planner membership is tracked separately in
    OrganizationMembership; creating a TTX auto-grants the creator a
    matching TTXAccess(role=PLANNER) row here for that ttx_id).

    A row is created either by direct assignment (granted_by_id set), by
    TTX creation (self-granted), or by redeeming an InvitationToken
    (granted_by_id left null).
    """

    __tablename__ = "ttx_access"
    __table_args__ = (
        UniqueConstraint("user_id", "ttx_id"),
        # At most one Lead Evaluator per exercise.
        Index(
            "uq_ttx_access_lead_evaluator", "ttx_id", unique=True, postgresql_where=text("leads")
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    role: RoleEnum
    # Planning and control team functions (role PLANNER only, false
    # otherwise): at least one of plans/controls; facilitates needs controls.
    plans: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    controls: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    facilitates: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    # A team member who is also the exercise's Evaluator / Observer (role
    # PLANNER only, false otherwise; each from the org grant of that name),
    # as a Controller/Evaluator often is in a small exercise.
    evaluates: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    observes: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    # Lead Evaluator (an Evaluator: role EVALUATOR, or PLANNER that
    # evaluates): organizes the evaluation team -- assignments, briefing,
    # the rated EEGs.
    leads: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    # A Player's room (TTXRoom), when the exercise uses rooms; null: none
    # yet, so the main room only. Never set on other roles.
    room_id: uuid.UUID | None = Field(default=None, foreign_key="ttx_room.id", index=True)
    granted_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    def context_roles(self) -> set[str]:
        """The TTXContextRole values this grant lets its holder act as."""
        if self.role != RoleEnum.PLANNER:
            return {self.role.value}
        flags = (
            (self.plans, TTXContextRole.PLANNER),
            (self.controls, TTXContextRole.CONTROLLER),
            (self.facilitates, TTXContextRole.FACILITATOR),
            (self.evaluates, TTXContextRole.EVALUATOR),
            (self.observes, TTXContextRole.OBSERVER),
        )
        return {role.value for held, role in flags if held}

    @property
    def is_evaluator(self) -> bool:
        return self.role == RoleEnum.EVALUATOR or (self.role == RoleEnum.PLANNER and self.evaluates)


def evaluator_access():
    """SQL twin of TTXAccess.is_evaluator: an Evaluator row, or a team
    member who also evaluates."""
    return or_(
        TTXAccess.role == RoleEnum.EVALUATOR,
        and_(TTXAccess.role == RoleEnum.PLANNER, TTXAccess.evaluates),
    )


def observer_access():
    """An Observer row, or a team member who also observes."""
    return or_(
        TTXAccess.role == RoleEnum.OBSERVER,
        and_(TTXAccess.role == RoleEnum.PLANNER, TTXAccess.observes),
    )
