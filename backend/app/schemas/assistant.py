import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssistantSettingsRead(BaseModel):
    enabled: bool
    pinned_by_env: bool
    # The notice version a new token acknowledges, and how many tokens are
    # active in the whole deployment.
    disclaimer_version: str
    active_tokens: int


class AssistantSettingsUpdateRequest(BaseModel):
    enabled: bool


class PersonalAccessTokenRead(BaseModel):
    id: uuid.UUID
    name: str
    prefix: str
    created_at: datetime
    expires_at: datetime
    last_used_at: datetime | None
    expired: bool


class PersonalAccessTokenListResponse(BaseModel):
    items: list[PersonalAccessTokenRead]
    # What the Preferences page needs to create one.
    enabled: bool
    disclaimer_version: str
    max_active: int
    expiry_days_choices: list[int]


class PersonalAccessTokenCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    expires_in_days: Literal[7, 30, 90] = 30
    acknowledge: bool
    disclaimer_version: str = Field(max_length=16)

    @field_validator("name")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name is required")
        return value


class PersonalAccessTokenCreated(PersonalAccessTokenRead):
    # The secret, this once.
    token: str


class AssistantProposalRead(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    target: Literal[
        "need",
        "objective",
        "placeholders",
        "risk",
        "needs_scope",
        "needs_context",
        "needs_tlp",
        "ttx_meta",
        "inject",
        "msel_phase",
        "msel_actor",
        "msel_threat",
        "msel_meta",
        "msel_renumber",
        "eeg_point",
        "prep_texts",
        "aar_text",
        "aar_objective",
        "aar_action",
    ]
    operation: Literal["create", "update", "delete"]
    target_id: uuid.UUID | None
    base: dict | None
    patch: dict
    depends_on: list[str]
    summary: str
    changeset: str | None = None
    issues: list[dict]
    evidence: list[dict] = []
    status: Literal["pending", "accepted", "discarded"]
    applied_row_id: uuid.UUID | None
    created_at: datetime
    decided_at: datetime | None
    decision_reason: str | None = None
    decision_note: str | None = None
    # The person's request it answers, when it was made for one.
    request_id: uuid.UUID | None = None
    # An update whose row changed (or went) since it was proposed.
    outdated: bool = False


class AssistantProposalListResponse(BaseModel):
    items: list[AssistantProposalRead]


class AssistantRequestCreate(BaseModel):
    """Something to ask the AI assistant for, from a design page."""

    model_config = ConfigDict(extra="forbid")

    section: Literal["needs", "msel", "conduct-prep"]
    # A saved row of the exercise it's about; None: the document.
    row_id: uuid.UUID | None = None
    note: str = Field(min_length=1, max_length=1000)

    @field_validator("note", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AssistantRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section: str
    row_id: uuid.UUID | None
    # The row's code, as the screens show it (None: the document, or a row gone).
    row_code: str | None = None
    note: str
    status: Literal["open", "answered"]
    created_at: datetime
    answered_at: datetime | None


class AssistantRequestListResponse(BaseModel):
    items: list[AssistantRequestRead]
    # The assistant is on here for Planners (the instance's switch and the
    # organization's): the page offers asking only then.
    enabled: bool = False


class AssistantOrgProposalRead(BaseModel):
    """A proposal to the organization: a new exercise, or a Library inject."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    target: Literal["new_exercise", "library_inject"]
    # The form's fields, as its save takes them.
    patch: dict[str, Any]
    summary: str
    status: Literal["pending", "accepted", "discarded"]
    created_at: datetime
    decided_at: datetime | None
    decision_reason: str | None = None
    decision_note: str | None = None


class AssistantOrgProposalListResponse(BaseModel):
    items: list[AssistantOrgProposalRead]


class AssistantProposalAppliedRequest(BaseModel):
    row_id: uuid.UUID


class AssistantProposalDiscardRequest(BaseModel):
    """Why, when the person says: the assistant reads it before proposing
    again. Both optional."""

    model_config = ConfigDict(extra="forbid")

    reason: (
        Literal["duplicate", "unrealistic", "out_of_scope", "tone", "incorrect", "other"] | None
    ) = None
    note: str = Field(default="", max_length=500)


class AssistantProposalDiscardResponse(BaseModel):
    # The proposal and those that depended on it.
    discarded: list[uuid.UUID]


class AssistantCallRead(BaseModel):
    id: uuid.UUID
    created_at: datetime
    user_id: uuid.UUID
    user_name: str
    user_email: str
    token_name: str
    token_prefix: str
    tool: str
    ttx_id: uuid.UUID | None
    ttx_code: str | None
    ttx_name: str | None
    organization_name: str | None
    # "ok" or the error code the call ended with.
    outcome: str
    duration_ms: int


class AssistantCallerRead(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str


class AssistantCallListResponse(BaseModel):
    items: list[AssistantCallRead]
    # Everyone with a call on record, for the filter.
    callers: list[AssistantCallerRead]
    retention_days: int
