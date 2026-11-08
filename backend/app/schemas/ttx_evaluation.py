import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models import Capability, NeedsFormStatus, Tlp
from app.schemas.ttx_needs_form import NotificationMilestoneRead


class EEGExpectedAction(BaseModel):
    """An MSEL expected action, listed under each objective its inject
    evaluates -- an observation point with its window."""

    code: str
    inject_code: str
    inject_title: str
    description: str
    responsible_role: str
    expected_within_minutes: int | None


class EEGDuePhase(BaseModel):
    """A phase the objective (or one of its decisions) is due by the end
    of -- its deadline, from the MSEL."""

    code: str
    name: str
    end_offset: int


class EEGPoint(BaseModel):
    """An observation point of a definitive EEG (the conduct prep's), with
    what each rating level means for it."""

    id: uuid.UUID
    kind: str
    text: str
    # Keyed "P", "S", "M", "U".
    criteria: dict[str, str]
    action_code: str = ""
    inject_code: str = ""
    inject_title: str = ""
    responsible_role: str = ""
    expected_within_minutes: int | None = None


class EEGObjective(BaseModel):
    id: uuid.UUID
    code: str
    title: str = ""
    capability: Capability
    statement: str
    # The success criterion split into things an evaluator can check off.
    observation_points: list[str]
    evidence: str
    # One item to collect per line of `evidence`.
    evidence_items: list[str] = []
    # Achieved with at least this many points of the criterion; None: all.
    achieve_at_least: int | None = None
    # Minutes from the inject that triggers it.
    time_box_minutes: int | None = None
    # Phases it's due by the end of (the MSEL's deadlines), session order.
    due_phases: list[EEGDuePhase] = []
    # What each outcome means here: P or S, M, U (blank: the common scale).
    achieved_note: str = ""
    partially_achieved: str = ""
    not_achieved: str = ""
    # From the MSEL: the frozen READY version for Evaluators, the live one
    # for Planners' preview. Empty until the MSEL has them.
    expected_actions: list[EEGExpectedAction] = []
    # The definitive EEG's points (source "plan"); empty for a derived one.
    points: list[EEGPoint] = []
    # Who evaluates it (source "plan").
    evaluators: list[str] = []


class ExpectedNotificationRead(BaseModel):
    """A notification regime the team should recognise during the session
    (services/notification_reference.py): derived from the notification
    requirements the objectives cite."""

    requirement_id: str
    framework: str
    framework_label_en: str
    framework_label_es: str
    reference: str
    description_en: str
    description_es: str
    objective_codes: list[str]
    milestones: list[NotificationMilestoneRead]


class EEGRead(BaseModel):
    """The Exercise Evaluation Guide (EEG): what evaluators observe and
    rate. Deliberately *not* the design -- no needs, risks, sponsor, scope
    or stop keyword -- since the Evaluator role has no access to it."""

    ttx_id: uuid.UUID
    exercise_code: str
    exercise_name: str
    tlp: Tlp
    needs_form_status: NeedsFormStatus
    needs_form_version: int
    # The MSEL version the expected actions come from (None: none yet).
    msel_version: int | None = None
    objectives: list[EEGObjective]
    rating_scale: list[str] = ["P", "S", "M", "U"]
    # "plan": the definitive EEGs of the READY conduct prep; "derived": the
    # draft built from the needs analysis and the MSEL (no plan ready yet).
    source: str = "derived"
    plan_version: int | None = None
    # A newer version of the plan is being prepared (this one stays in use).
    plan_reopened: bool = False
    # The observers' notification reference; empty when no objective cites
    # a notification requirement.
    notifications: list[ExpectedNotificationRead] = []
    lead_evaluator: str | None = None


class EvaluatorGrantRequest(BaseModel):
    email: EmailStr


class EvaluatorRead(BaseModel):
    user_id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str
    added_at: datetime
    last_login_at: datetime | None = None
    # Lead Evaluator (always false for Observers).
    leads: bool = False


class LeadEvaluatorRequest(BaseModel):
    user_id: uuid.UUID


class EvaluatorListResponse(BaseModel):
    items: list[EvaluatorRead]
