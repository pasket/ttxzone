import uuid
from enum import StrEnum

from sqlmodel import Field, SQLModel

from app.models.ttx_needs_form import Capability


class NeedSource(StrEnum):
    RISK_ANALYSIS = "risk_analysis"
    INCIDENT_HISTORY = "incident_history"
    PREVIOUS_AAR = "previous_aar"
    RECENT_CHANGES = "recent_changes"
    THREAT_INTEL = "threat_intel"
    REGULATORY = "regulatory"
    OTHER = "other"


class NeedPriority(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TTXNeed(SQLModel, table=True):
    """One row of the needs analysis (section 3): the evidence that
    justifies an objective. Kept by id across edits -- objectives link to
    it through TTXObjectiveNeed."""

    __tablename__ = "ttx_need"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    form_id: uuid.UUID = Field(foreign_key="ttx_needs_form.id", index=True)
    code: str = Field(max_length=16)
    position: int = Field(default=0)
    source: NeedSource
    # A short name ("Clear escalation paths") -- how tables, links and
    # messages refer to the need; `finding` describes it.
    title: str = Field(default="", max_length=255)
    finding: str = Field(default="")
    affected_capability: Capability
    priority: NeedPriority
