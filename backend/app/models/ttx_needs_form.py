import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlmodel import Field, SQLModel


class NeedsFormStatus(StrEnum):
    DRAFT = "draft"
    READY_FOR_APPROVAL = "ready_for_approval"
    APPROVED = "approved"


class Tlp(StrEnum):
    """FIRST Traffic Light Protocol 2.0 labels."""

    CLEAR = "clear"
    GREEN = "green"
    AMBER = "amber"
    AMBER_STRICT = "amber_strict"
    RED = "red"


class Capability(StrEnum):
    """Capabilities an exercise can validate -- TTX-Zone's own taxonomy."""

    DETECTION_TRIAGE_ESCALATION = "detection_triage_escalation"
    INCIDENT_CLASSIFICATION = "incident_classification"
    CRISIS_DECISION_MAKING = "crisis_decision_making"
    REGULATORY_NOTIFICATION = "regulatory_notification"
    INTERNAL_EXTERNAL_COMMS = "internal_external_comms"
    CROSS_UNIT_COORDINATION = "cross_unit_coordination"
    THIRD_PARTY_SUPPLY_CHAIN = "third_party_supply_chain"
    CONTINUITY_RECOVERY = "continuity_recovery"
    LEGAL_FORENSICS = "legal_forensics"


class Trigger(StrEnum):
    REGULATORY = "regulatory"
    ANNUAL_PROGRAM = "annual_program"
    NEW_OR_REVISED_PLAN = "new_or_revised_plan"
    RECENT_INCIDENT = "recent_incident"
    PENDING_AAR_ACTIONS = "pending_aar_actions"
    NEW_THREAT = "new_threat"
    AUDIT_FINDING = "audit_finding"
    ORG_OR_TECH_CHANGE = "org_or_tech_change"
    OTHER = "other"


class ExerciseLevel(StrEnum):
    STRATEGIC = "strategic"
    TACTICAL = "tactical"
    OPERATIONAL = "operational"


class AarRecipient(StrEnum):
    EXECUTIVE_COMMITTEE = "executive_committee"
    CRISIS_COMMITTEE = "crisis_committee"
    BOARD = "board"
    OTHER = "other"


def _string_array() -> Column:
    # A fresh Column per field: SQLAlchemy binds a Column to one table
    # attribute, so the definition can't be shared.
    return Column(ARRAY(String(255)), nullable=False, server_default="{}")


class TTXNeedsForm(SQLModel, table=True):
    """The exercise's needs & objectives form (ISO 22398 / NIST SP 800-84
    needs analysis) -- one per TTX, created with it. Until it is APPROVED the
    scenario can't be written (see ttx_needs_form_service.require_approved_form).

    Text fields default to "" rather than NULL: a DRAFT form is saved
    incomplete, and completeness is judged by the validation report, not
    by the schema. Multi-selects are string arrays holding StrEnum values
    (validated by the request schemas). `revision` bumps on every save
    (optimistic locking); `version` is the document version shown to users
    and bumps only when an approved form is edited, withdrawing its
    approval."""

    __tablename__ = "ttx_needs_form"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", unique=True, index=True)
    status: NeedsFormStatus = Field(default=NeedsFormStatus.DRAFT)
    version: int = Field(default=1)
    revision: int = Field(default=0)

    # Section 0 -- document control
    tlp: Tlp = Field(default=Tlp.AMBER)
    document_date: date = Field(default_factory=lambda: datetime.now(UTC).date())
    design_lead: str = Field(default="", max_length=255)

    # Section 1 -- sponsorship & governance
    sponsor_name: str = Field(default="", max_length=255)
    sponsor_role: str = Field(default="", max_length=255)
    sponsor_motivation: str = Field(default="")
    findings_closure_commitment: bool = Field(default=False)
    findings_owner: str = Field(default="", max_length=255)
    aar_recipient: AarRecipient | None = Field(default=None)
    aar_recipient_other: str = Field(default="", max_length=255)

    # Section 2 -- triggers
    triggers: list[str] = Field(default_factory=list, sa_column=_string_array())
    regulatory_frameworks: list[str] = Field(default_factory=list, sa_column=_string_array())
    regulatory_framework_other: str = Field(default="", max_length=255)
    trigger_other: str = Field(default="", max_length=255)

    # Section 4 -- capabilities to validate
    capabilities: list[str] = Field(default_factory=list, sa_column=_string_array())

    # Section 6 -- scope
    levels: list[str] = Field(default_factory=list, sa_column=_string_array())
    participating_areas: list[str] = Field(default_factory=list, sa_column=_string_array())
    third_parties: list[str] = Field(default_factory=list, sa_column=_string_array())
    perimeter: str = Field(default="")
    out_of_scope: str = Field(default="")

    # Section 7 -- constraints & assumptions
    date_window_start: date | None = Field(default=None)
    date_window_end: date | None = Field(default=None)
    max_duration_hours: int | None = Field(default=None)
    key_participants_availability: str = Field(default="")
    confidentiality_restrictions: str = Field(default="")
    budget_and_external_support: str = Field(default="")

    # Section 8 -- exercise risks (rows in TTXExerciseRisk)
    stop_exercise_keyword: str = Field(default="", max_length=64)

    # Human codes (NEED-01, OBJ-01) come from these counters so a deleted
    # row's code is never handed out again.
    next_need_number: int = Field(default=1)
    next_objective_number: int = Field(default=1)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
