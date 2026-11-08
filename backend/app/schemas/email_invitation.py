import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.core.password_policy import StrongPassword
from app.schemas.legal import LegalAcceptanceItem

# Mirrors email_invitation_service.MAX_ADDRESSES_PER_REQUEST.
MAX_ADDRESSES = 50


class EmailInvitationCreateRequest(BaseModel):
    # Checked one by one in the service (email_service.normalize_address).
    emails: list[str] = Field(min_length=1, max_length=MAX_ADDRESSES)


class EmailInvitationOutcome(BaseModel):
    email: str
    outcome: Literal["sent", "resent", "already_player", "on_team", "dropped"]


class EmailInvitationCreateResponse(BaseModel):
    results: list[EmailInvitationOutcome]


class EmailInvitationRead(BaseModel):
    id: uuid.UUID
    ttx_id: uuid.UUID
    # Output: read back as stored (a deleted account's placeholder too).
    email: str
    status: Literal["pending", "accepted", "expired", "revoked"]
    invited_by_name: str | None
    created_at: datetime
    sent_at: datetime
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None


class EmailInvitationListResponse(BaseModel):
    items: list[EmailInvitationRead]
    total: int
    limit: int
    offset: int


class EmailInvitationTokenRequest(BaseModel):
    token: str = Field(min_length=1, max_length=128)


class EmailInvitationPreview(BaseModel):
    organization_name: str
    ttx_name: str
    # "p•••@acme.com": whoever holds the link sees which mailbox it went to.
    email_hint: str
    account_exists: bool


class EmailInvitationAccountCreate(BaseModel):
    """A new account for the invited address (the address comes from the
    invitation, never from the form)."""

    password: StrongPassword
    full_name: str = Field(min_length=1, max_length=255)
    accepted_legal: list[LegalAcceptanceItem] = Field(default_factory=list, max_length=4)


class EmailInvitationAcceptRequest(BaseModel):
    token: str = Field(min_length=1, max_length=128)
    account: EmailInvitationAccountCreate | None = None


class EmailInvitationAcceptResponse(BaseModel):
    ttx_id: uuid.UUID
    ttx_name: str
    organization_id: uuid.UUID
    organization_name: str
    created_account: bool
