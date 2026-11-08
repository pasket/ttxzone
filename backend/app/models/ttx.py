import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class TTX(SQLModel, table=True):
    __tablename__ = "ttx"
    __table_args__ = (UniqueConstraint("organization_id", "code"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=255)
    # Human-readable exercise reference, "TTX-YYYY-NN", sequential per
    # organization and (UTC) creation year. Never set by hand: assigned on
    # insert by ttx_needs_form_service's before_flush hook, so every
    # creation path gets one.
    code: str = Field(max_length=32)
    description: str | None = Field(default=None)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    # The Lead Planner: the planning team member who coordinates the team,
    # owns the calendar and the deliverables. Its creator by default; one
    # of the exercise's Planners (kept so by ttx_planning_team_service --
    # removing the lead hands it to the next member).
    lead_planner_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    # Next ACT-NN code of the exercise's cast of simulated actors (never
    # reused). Still 1 means the cast was never seeded.
    next_actor_number: int = Field(default=1)
    # Played in several rooms at once (TTXRoom), each team getting its own
    # injects, plus the main room. Off: one table, as always. Turning it off
    # keeps the rooms and the Players' seats, ignored until it's back on.
    uses_rooms: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    # Next RM-NN code of its rooms (never reused).
    next_room_number: int = Field(default=1, sa_column_kwargs={"server_default": "1"})
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    image_path: str | None = Field(default=None, max_length=255)
    # The library scenario last copied onto it (it overwrites the content):
    # "Copied from" and the scenario's usage. Null: none, or a file.
    scenario_origin: str | None = Field(default=None, max_length=16)
    scenario_origin_id: str | None = Field(default=None, max_length=64)
    scenario_origin_name: str | None = Field(default=None, max_length=255)
    # The language its content (injects, briefings, the needs analysis) is
    # written in -- not anyone's interface language. Set from the creator's
    # language, then from a scenario applied to it; the Planners change it.
    # Defaults written for the table (ENDEX) follow it. Null: not known
    # (an exercise from before it was recorded).
    content_language: str | None = Field(default=None, max_length=8)
    # Archived: read-only (every write refused, security.require_not_archived)
    # and out of the default lists, until it's unarchived. Its after-action
    # report's improvement actions are still followed up.
    archived_at: datetime | None = Field(default=None)
    archived_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
