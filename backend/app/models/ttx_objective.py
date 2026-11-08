import uuid

from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlmodel import Field, SQLModel

from app.models.ttx_needs_form import Capability


class TTXObjective(SQLModel, table=True):
    """A SMART objective (section 5). Kept by id across edits: it is what
    injects, EEG observation points and AAR findings will link to later
    (objective_id). `regulatory_requirement_ids` holds ids from
    app/data/regulatory_catalog.py -- a code-level catalog, so no FK."""

    __tablename__ = "ttx_objective"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    form_id: uuid.UUID = Field(foreign_key="ttx_needs_form.id", index=True)
    code: str = Field(max_length=16)
    position: int = Field(default=0)
    # A short name: how lists, references, headings and messages name it.
    # The statement is the full SMART sentence it's rated against.
    title: str = Field(default="", max_length=255)
    statement: str = Field(default="")
    capability: Capability
    # One observable condition per line: each line is one EEG observation
    # point (eeg_service.observation_points).
    success_criterion: str = Field(default="")
    # Achieved with at least this many conditions; None: all of them.
    achieve_at_least: int | None = Field(default=None)
    # Minutes from the inject that triggers it; None: no time box.
    time_box_minutes: int | None = Field(default=None)
    # What each outcome means for this objective, read with the common
    # rating scale: achieved (P or S) -- the rule is derived from the
    # conditions, this only adds a note --, partially (M), not (U). Never
    # observation points.
    achieved_note: str = Field(default="")
    partially_achieved: str = Field(default="")
    not_achieved: str = Field(default="")
    # One item to collect per line.
    evidence: str = Field(default="")
    regulatory_requirement_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String(64)), nullable=False, server_default="{}"),
    )


class TTXObjectiveNeed(SQLModel, table=True):
    """Which needs justify an objective (N:M, at least one per objective)."""

    __tablename__ = "ttx_objective_need"

    objective_id: uuid.UUID = Field(foreign_key="ttx_objective.id", primary_key=True)
    need_id: uuid.UUID = Field(foreign_key="ttx_need.id", primary_key=True, index=True)
