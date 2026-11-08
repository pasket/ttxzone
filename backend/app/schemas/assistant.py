import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


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
        "needs_scope",
        "needs_tlp",
        "ttx_meta",
        "inject",
        "msel_phase",
        "msel_actor",
        "msel_threat",
        "msel_meta",
        "msel_renumber",
        "eeg_point",
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
    # An update whose row changed (or went) since it was proposed.
    outdated: bool = False


class AssistantProposalListResponse(BaseModel):
    items: list[AssistantProposalRead]


class AssistantProposalAppliedRequest(BaseModel):
    row_id: uuid.UUID


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
