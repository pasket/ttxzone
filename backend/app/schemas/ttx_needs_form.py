import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.data.regulatory_catalog import REGULATORY_FRAMEWORKS, REGULATORY_REQUIREMENT_IDS
from app.models import (
    AarRecipient,
    ApproverKind,
    Capability,
    ExerciseLevel,
    NeedPriority,
    NeedsFormStatus,
    NeedSource,
    Tlp,
    Trigger,
)

# Bounded text inputs -- strict limits on every free-text field (SSDLC:
# no unbounded payloads). Long-form fields get a generous cap.
ShortText = Annotated[str, Field(max_length=255)]
LongText = Annotated[str, Field(max_length=5000)]
ListItem = Annotated[str, Field(min_length=1, max_length=255)]


def _dedupe(values: list) -> list:
    return list(dict.fromkeys(values))


class NeedInput(BaseModel):
    """A needs-analysis row. `id` is set for a row that already exists
    (kept, so objectives and future links survive edits); `key` is how
    objectives in the same payload refer to it -- the id itself for an
    existing row, any client-chosen temporary string for a new one."""

    id: uuid.UUID | None = None
    key: str = Field(min_length=1, max_length=64)
    source: NeedSource
    title: Annotated[str, Field(max_length=255)] = ""
    finding: LongText = ""
    affected_capability: Capability
    priority: NeedPriority


class ObjectiveInput(BaseModel):
    id: uuid.UUID | None = None
    # Only used by the dry-run validation, to name an unsaved row in its
    # report (a saved row is named by its id). Ignored when saving.
    key: str | None = Field(default=None, max_length=64)
    title: str = Field(default="", max_length=255)
    statement: LongText = ""
    capability: Capability
    linked_need_keys: list[Annotated[str, Field(min_length=1, max_length=64)]] = Field(
        default_factory=list, max_length=50
    )
    success_criterion: LongText = ""
    achieve_at_least: int | None = Field(default=None, ge=1, le=50)
    time_box_minutes: int | None = Field(default=None, ge=1, le=1440)
    achieved_note: LongText = ""
    partially_achieved: LongText = ""
    not_achieved: LongText = ""
    evidence: LongText = ""
    regulatory_requirement_ids: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("linked_need_keys", "regulatory_requirement_ids")
    @classmethod
    def _unique(cls, values: list[str]) -> list[str]:
        return _dedupe(values)

    @field_validator("regulatory_requirement_ids")
    @classmethod
    def _known_requirements(cls, values: list[str]) -> list[str]:
        unknown = [v for v in values if v not in REGULATORY_REQUIREMENT_IDS]
        if unknown:
            raise ValueError(f"Unknown regulatory requirement: {', '.join(unknown)}")
        return values


class RiskInput(BaseModel):
    id: uuid.UUID | None = None
    key: str | None = Field(default=None, max_length=64)  # see ObjectiveInput.key
    risk: LongText = ""
    mitigation: LongText = ""
    owner: ShortText = ""


class NeedsFormSaveRequest(BaseModel):
    """PUT /ttx/{ttx_id}/needs-form -- the whole form in one save. A DRAFT
    may be incomplete: completeness is reported by the validation report,
    and only the rules that can never hold in a stored form (V01, V02, V04)
    reject the save. `revision` is the one the client edited (optimistic
    locking). Collections are full-replace, keyed by id."""

    revision: int = Field(ge=0)

    tlp: Tlp
    document_date: date
    design_lead: ShortText = ""

    sponsor_name: ShortText = ""
    sponsor_role: ShortText = ""
    sponsor_motivation: LongText = ""
    findings_closure_commitment: bool = False
    findings_owner: ShortText = ""
    aar_recipient: AarRecipient | None = None
    aar_recipient_other: ShortText = ""

    triggers: list[Trigger] = Field(default_factory=list, max_length=len(Trigger))
    regulatory_frameworks: list[Literal[REGULATORY_FRAMEWORKS]] = Field(  # type: ignore[valid-type]
        default_factory=list, max_length=len(REGULATORY_FRAMEWORKS)
    )
    regulatory_framework_other: ShortText = ""
    trigger_other: ShortText = ""

    capabilities: list[Capability] = Field(default_factory=list, max_length=len(Capability))

    levels: list[ExerciseLevel] = Field(default_factory=list, max_length=len(ExerciseLevel))
    participating_areas: list[ListItem] = Field(default_factory=list, max_length=50)
    third_parties: list[ListItem] = Field(default_factory=list, max_length=50)
    perimeter: LongText = ""
    out_of_scope: LongText = ""

    date_window_start: date | None = None
    date_window_end: date | None = None
    max_duration_hours: int | None = Field(default=None, ge=1, le=720)
    key_participants_availability: LongText = ""
    confidentiality_restrictions: LongText = ""
    budget_and_external_support: LongText = ""

    stop_exercise_keyword: Annotated[str, Field(max_length=64)] = ""

    needs: list[NeedInput] = Field(default_factory=list, max_length=50)
    objectives: list[ObjectiveInput] = Field(default_factory=list, max_length=20)
    risks: list[RiskInput] = Field(default_factory=list, max_length=30)

    @field_validator(
        "triggers", "regulatory_frameworks", "capabilities", "levels",
        "participating_areas", "third_parties",
    )  # fmt: skip
    @classmethod
    def _unique(cls, values: list) -> list:
        return _dedupe(values)

    @model_validator(mode="after")
    def _date_window_order(self) -> "NeedsFormSaveRequest":
        if (
            self.date_window_start
            and self.date_window_end
            and self.date_window_end < self.date_window_start
        ):
            raise ValueError("date_window_end must not be before date_window_start")
        keys = [need.key for need in self.needs]
        if len(keys) != len(set(keys)):
            raise ValueError("Each need needs a unique key")
        return self


class NeedsFormTransitionRequest(BaseModel):
    to: NeedsFormStatus


class NeedsFormRenumberRequest(BaseModel):
    """Renumber needs in creation order or objectives in needs order -- or, to undo, put back
    the `codes` (row id -> code) a previous renumbering returned."""

    kind: Literal["needs", "objectives"]
    codes: dict[uuid.UUID, str] | None = Field(default=None, max_length=1000)


class NeedsFormApprovalRequest(BaseModel):
    approver_kind: ApproverKind
    approver_name: str = Field(min_length=1, max_length=255)
    approver_role: ShortText = ""
    approved_on: date


class NeedRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    source: NeedSource
    title: str
    finding: str
    affected_capability: Capability
    priority: NeedPriority


class ObjectiveRead(BaseModel):
    id: uuid.UUID
    code: str
    title: str = ""
    statement: str
    capability: Capability
    linked_need_ids: list[uuid.UUID]
    success_criterion: str
    achieve_at_least: int | None = None
    time_box_minutes: int | None = None
    achieved_note: str = ""
    partially_achieved: str = ""
    not_achieved: str = ""
    evidence: str
    regulatory_requirement_ids: list[str]


class RiskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    risk: str
    mitigation: str
    owner: str


class EvidenceRead(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    uploaded_by_name: str
    uploaded_at: datetime


class ApprovalRead(BaseModel):
    id: uuid.UUID
    version: int
    approver_kind: ApproverKind
    approver_name: str
    approver_role: str
    approved_on: date
    recorded_by_name: str
    recorded_at: datetime
    evidence: list[EvidenceRead] = []


class ValidationIssue(BaseModel):
    """One rule a form breaks. `section` is the form section (0-9) to send
    the user to; `field` the field within it; `item_id` the row (need,
    objective) or value (capability, approver kind) concerned, if any."""

    code: str
    section: int
    field: str | None = None
    item_id: str | None = None


class ValidationReport(BaseModel):
    """`ready` blocks DRAFT -> READY_FOR_APPROVAL, `approved` additionally
    blocks READY_FOR_APPROVAL -> APPROVED; `warnings` never block."""

    ready: list[ValidationIssue]
    approved: list[ValidationIssue]
    warnings: list[ValidationIssue]


class NeedsFormRead(BaseModel):
    id: uuid.UUID
    ttx_id: uuid.UUID
    exercise_code: str
    status: NeedsFormStatus
    version: int
    revision: int

    tlp: Tlp
    document_date: date
    design_lead: str

    sponsor_name: str
    sponsor_role: str
    sponsor_motivation: str
    findings_closure_commitment: bool
    findings_owner: str
    aar_recipient: AarRecipient | None
    aar_recipient_other: str

    triggers: list[str]
    regulatory_frameworks: list[str]
    regulatory_framework_other: str
    trigger_other: str

    capabilities: list[str]

    levels: list[str]
    participating_areas: list[str]
    third_parties: list[str]
    perimeter: str
    out_of_scope: str

    date_window_start: date | None
    date_window_end: date | None
    max_duration_hours: int | None
    key_participants_availability: str
    confidentiality_restrictions: str
    budget_and_external_support: str

    stop_exercise_keyword: str

    needs: list[NeedRead]
    objectives: list[ObjectiveRead]
    risks: list[RiskRead]
    approvals: list[ApprovalRead]

    updated_at: datetime
    validation: ValidationReport
    # Kinds of row (needs, objectives) whose codes don't follow the list's
    # order and can still be renumbered (a first draft, before any MSEL).
    renumberable: list[str] = Field(default_factory=list)


class NeedsFormRenumberRead(BaseModel):
    """POST /ttx/{ttx_id}/needs-form/renumber: the form and the codes it
    had (row id -> code), which undo sends back."""

    form: NeedsFormRead
    previous: dict[uuid.UUID, str]


class NotificationMilestoneRead(BaseModel):
    recipient_en: str
    recipient_es: str
    stage_en: str
    stage_es: str
    deadline_en: str
    deadline_es: str
    clock_en: str
    clock_es: str


class RegulatoryRequirementRead(BaseModel):
    id: str
    framework: str
    reference: str
    description_en: str
    description_es: str
    # The reports a notification requirement demands; empty for the rest.
    notifications: list[NotificationMilestoneRead] = []


class RegulatoryFrameworkRead(BaseModel):
    """A framework a regulatory trigger can name; OTHER isn't one (it's
    implied, always offered last, with free text)."""

    id: str
    label_en: str
    label_es: str
    jurisdiction: str
    name_en: str
    name_es: str
    scope_en: str
    scope_es: str
    requires_exercises: bool
    binding: bool
    rationale_en: str
    rationale_es: str
    rationale_reference: str


class RegulatoryCatalogResponse(BaseModel):
    items: list[RegulatoryRequirementRead]
    frameworks: list[RegulatoryFrameworkRead]


class ObjectiveTemplateRead(BaseModel):
    """GET /objective-catalog -- one SMART objective template, both locales.
    `criterion_*`/`evidence_*` hold one line per entry (the form joins them)."""

    id: str
    capability: Capability
    title_en: str
    title_es: str
    statement_en: str
    statement_es: str
    criterion_en: list[str]
    criterion_es: list[str]
    evidence_en: list[str]
    evidence_es: list[str]
    regulatory_requirement_ids: list[str]
    time_box_minutes: int | None


class ObjectiveCatalogResponse(BaseModel):
    items: list[ObjectiveTemplateRead]


class RiskTemplateRead(BaseModel):
    """GET /risk-catalog -- one exercise risk template, both locales."""

    id: str
    category: str
    risk_en: str
    risk_es: str
    mitigation_en: str
    mitigation_es: str
    default: bool


class RiskCatalogResponse(BaseModel):
    items: list[RiskTemplateRead]
