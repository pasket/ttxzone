import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class OrgRoleEnum(StrEnum):
    PROGRAM_MANAGER = "program_manager"
    PLANNER = "planner"
    # Granted by a Program Manager so the exercise team can assign the
    # person to an exercise in that role (TTXAccess OBSERVER / EVALUATOR).
    OBSERVER = "observer"
    EVALUATOR = "evaluator"


class OrganizationMembership(SQLModel, table=True):
    """Organization-scoped role grant (PROGRAM_MANAGER, PLANNER, OBSERVER or
    EVALUATOR).

    Modeled as a grant table -- not a boolean flag on User -- to mirror
    TTXAccess's pattern and allow an Organization to have more than one
    Program Manager (or Planner) without a future schema change.

    Planner is org-scoped (unlike its TTXAccess counterpart, which is
    per-ttx_id) so a Program Manager can grant it before any TTX exists --
    that grant is what lets the new Planner create their first TTX.
    """

    __tablename__ = "organization_membership"
    __table_args__ = (UniqueConstraint("user_id", "organization_id", "role"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    role: OrgRoleEnum
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Set on every grant of a person removed from the organization while
    # still on some of its exercises: no grant counts and no exercise opens
    # until they're off those exercises and removed for good, or re-enabled.
    disabled_at: datetime | None = Field(default=None)


def active_membership():
    """WHERE clause: the grant counts (its holder isn't disabled)."""
    return OrganizationMembership.disabled_at.is_(None)
