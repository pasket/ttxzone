import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.data.attack_catalog import ATTACK_VERSIONS, LATEST_ATTACK_VERSION
from app.data.inject_catalog import (
    InjectAudience,
    InjectFamily,
    InjectStage,
    InjectTemplateFields,
    Localized,
)
from app.data.regulatory_catalog import FRAMEWORK_CATALOG
from app.models import (
    ActorOrigin,
    ActorType,
    AttackAttribution,
    Capability,
    DeliveryMethod,
    InjectFormat,
    InjectKind,
)
from app.schemas.ttx_msel import (
    MAX_EXPECTED_ACTIONS,
    MAX_MINUTES,
    MAX_POLL_OPTIONS,
    AttackRef,
    AttackRefRead,
    ListItem,
    LongListItem,
    LongText,
    PollOption,
    PollOutcome,
    PollQuestion,
    ShortText,
)

OriginId = Annotated[str, Field(max_length=64)]
# Scenario time can run for days: up to 30.
MAX_SCENARIO_MINUTES = 30 * 24 * 60
_VARIABLE_NAME = re.compile(r"[a-z][a-z0-9_]{1,31}")


def _dedupe(values: list) -> list:
    return list(dict.fromkeys(values))


# -- TTX-Zone's catalog ----------------------------------------------------------


class CatalogAttackRead(BaseModel):
    domain: str
    tactic_id: str
    tactic_name: str
    technique_id: str
    technique_name: str


class CatalogImageRead(BaseModel):
    """An illustration of a catalog inject, served at
    GET /inject-catalog/{id}/images/{index}?lang=; copied into the MSEL
    with the inject."""

    index: int
    caption: Localized
    width: int
    height: int


class SystemInjectRead(InjectTemplateFields):
    attack: list[CatalogAttackRead]
    images: list[CatalogImageRead] = []


class SystemInjectListResponse(BaseModel):
    """GET /inject-catalog: names resolved from the catalog's ATT&CK release."""

    attack_version: str
    items: list[SystemInjectRead]


# -- the organization's library --------------------------------------------------


class TemplateActionFields(BaseModel):
    description: Annotated[str, Field(min_length=1, max_length=5000)]
    responsible_role: ShortText = ""
    # Scenario minutes after the inject is delivered, not session minutes.
    within_minutes: int | None = Field(default=None, ge=1, le=MAX_SCENARIO_MINUTES)


class OrganizationInjectFields(BaseModel):
    """What an inject template is in an organization's library: one
    language, stated in `language`. See OrganizationInject."""

    # The language its text is written in; None only for injects saved
    # before it was recorded.
    language: Literal["en", "es"] | None = None
    title: Annotated[str, Field(min_length=1, max_length=255)]
    content: LongText = ""
    kind: InjectKind = InjectKind.MANDATORY
    format: InjectFormat = InjectFormat.INJECT
    poll_question: PollQuestion = ""
    poll_options: list[PollOption] = Field(default_factory=list, max_length=MAX_POLL_OPTIONS)
    poll_outcomes: list[PollOutcome] = Field(default_factory=list, max_length=MAX_POLL_OPTIONS)
    trigger_condition: LongText = ""
    contingent_purpose: LongText = ""
    actor_name: ShortText = ""
    actor_type: ActorType = ActorType.OTHER
    actor_origin: ActorOrigin | None = None
    actor_origin_id: OriginId | None = None
    delivery_method: DeliveryMethod = DeliveryMethod.EMAIL
    recipients: list[ListItem] = Field(default_factory=list, max_length=20)
    expected_actions: list[TemplateActionFields] = Field(
        default_factory=list, max_length=MAX_EXPECTED_ACTIONS
    )
    attachment_notes: list[LongListItem] = Field(default_factory=list, max_length=10)
    key_question: LongText = ""
    facilitator_notes: LongText = ""
    families: list[InjectFamily] = Field(default_factory=list, max_length=len(InjectFamily))
    stage: InjectStage = InjectStage.RESPONSE
    audience: InjectAudience = InjectAudience.MIXED
    capabilities: list[Capability] = Field(default_factory=list, max_length=len(Capability))
    attack_version: str = LATEST_ATTACK_VERSION
    attack: list[AttackRef] = Field(default_factory=list, max_length=20)
    frameworks: list[str] = Field(default_factory=list, max_length=20)
    variable_defaults: dict[str, ShortText] = Field(default_factory=dict, max_length=30)
    # What it was copied from, if anything, and that one's title then.
    origin: ActorOrigin | None = None
    origin_id: OriginId | None = None
    origin_name: ShortText | None = None

    @model_validator(mode="after")
    def _poll(self) -> "OrganizationInjectFields":
        """A poll's fields go with the poll, its outcomes by option."""
        if self.format == InjectFormat.POLL:
            self.expected_actions = []
            count = len(self.poll_options)
            self.poll_outcomes = (self.poll_outcomes + [""] * count)[:count]
        else:
            self.poll_question, self.poll_options, self.poll_outcomes = "", [], []
        return self

    @field_validator("recipients", "families", "capabilities", "frameworks")
    @classmethod
    def _unique(cls, values: list) -> list:
        return _dedupe(values)

    @field_validator("attack_version")
    @classmethod
    def _known_release(cls, value: str) -> str:
        if value not in ATTACK_VERSIONS:
            raise ValueError("Unknown ATT&CK release")
        return value

    @field_validator("frameworks")
    @classmethod
    def _known_frameworks(cls, values: list[str]) -> list[str]:
        known = {f.id for f in FRAMEWORK_CATALOG}
        if any(value not in known for value in values):
            raise ValueError("Unknown framework")
        return values

    @field_validator("variable_defaults")
    @classmethod
    def _variable_names(cls, values: dict[str, str]) -> dict[str, str]:
        if any(not _VARIABLE_NAME.fullmatch(name) for name in values):
            raise ValueError("Variable names are snake_case, 2-32 characters")
        return values


class OrganizationInjectRead(OrganizationInjectFields):
    id: uuid.UUID
    attack: list[AttackRefRead]  # type: ignore[assignment]
    created_at: datetime
    updated_at: datetime
    # Set when deleted while still in use (see library_usage_service).
    disabled_at: datetime | None = None
    # How many uses keep it from being deleted for good (library lists only).
    usage_count: int = 0


class OrganizationInjectListResponse(BaseModel):
    items: list[OrganizationInjectRead]


# -- one inject into an exercise's MSEL -------------------------------------------


class CopyActionInput(BaseModel):
    description: Annotated[str, Field(min_length=1, max_length=5000)]
    responsible_role: ShortText = ""
    # Session minutes, like every MSEL row (the client converts a
    # template's scenario minutes with the MSEL's time compression).
    expected_within_minutes: int | None = Field(default=None, ge=1, le=MAX_MINUTES)


class CopySender(BaseModel):
    """Who sends it, when it isn't already in the cast: found there by its
    TTX-Zone id or its name, or added as a copy."""

    name: Annotated[str, Field(min_length=1, max_length=255)]
    type: ActorType = ActorType.OTHER
    channel: DeliveryMethod | None = None
    description: LongText = ""
    origin: ActorOrigin | None = None
    origin_id: OriginId | None = None


class ExerciseInjectInput(BaseModel):
    """POST /ttx/{ttx_id}/msel/injects: one inject added to the MSEL -- a
    copy of a library inject, already in the exercise's language with its
    variables filled in. The MSEL's own save rules apply afterwards (the
    validation report judges it; nothing here needs to be complete)."""

    phase_id: uuid.UUID
    objective_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    offset_minutes: int | None = Field(default=None, ge=0, le=MAX_MINUTES)
    kind: InjectKind = InjectKind.MANDATORY
    format: InjectFormat = InjectFormat.INJECT
    poll_question: PollQuestion = ""
    poll_options: list[PollOption] = Field(default_factory=list, max_length=MAX_POLL_OPTIONS)
    poll_outcomes: list[PollOutcome] = Field(default_factory=list, max_length=MAX_POLL_OPTIONS)
    title: Annotated[str, Field(min_length=1, max_length=255)]
    content: LongText = ""
    trigger_condition: LongText = ""
    contingent_purpose: LongText = ""
    actor_id: uuid.UUID | None = None
    sender: CopySender | None = None
    recipients: list[ListItem] = Field(default_factory=list, max_length=20)
    delivery_method: DeliveryMethod = DeliveryMethod.EMAIL
    attachment_notes: list[LongListItem] = Field(default_factory=list, max_length=10)
    attack_techniques: list[AttackRef] = Field(default_factory=list, max_length=20)
    # Whose activity those techniques are (see Inject.attack_attribution):
    # left out, a template's techniques go to the scenario's first threat
    # actor.
    attack_attribution: AttackAttribution | None = None
    threat_actor_id: uuid.UUID | None = None
    facilitator_notes: LongText = ""
    expected_actions: list[CopyActionInput] = Field(
        default_factory=list, max_length=MAX_EXPECTED_ACTIONS
    )
    origin: ActorOrigin | None = None
    origin_id: OriginId | None = None
    origin_name: ShortText | None = None
    # The language the copy was made in: a TTX-Zone inject's illustrations
    # come in it (left out: the exercise's content language, else English).
    language: Literal["en", "es"] | None = None

    @model_validator(mode="after")
    def _poll(self) -> "ExerciseInjectInput":
        """As an MSEL save does: only an inject evaluates anything, and a
        poll's fields go with the poll."""
        if self.format != InjectFormat.INJECT:
            self.objective_ids = []
        if self.format == InjectFormat.POLL:
            self.expected_actions = []
            count = len(self.poll_options)
            self.poll_outcomes = (self.poll_outcomes + [""] * count)[:count]
        else:
            self.poll_question, self.poll_options, self.poll_outcomes = "", [], []
        return self

    @field_validator("recipients", "objective_ids")
    @classmethod
    def _unique(cls, values: list) -> list:
        return _dedupe(values)
