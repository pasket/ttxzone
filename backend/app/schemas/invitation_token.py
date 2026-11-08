import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.password_policy import StrongPassword
from app.models import RoleEnum
from app.schemas.legal import LegalAcceptanceItem
from app.schemas.organization import UserRead
from app.schemas.ttx_tag import TTXTagRead

MAX_TOKEN_LIFETIME = timedelta(days=365)
MAX_TOKEN_USES = 1000


class InvitationTokenCreateRequest(BaseModel):
    role: RoleEnum
    description: str | None = Field(default=None, max_length=255)
    expires_at: datetime
    max_uses: int | None = Field(default=None, ge=1, le=MAX_TOKEN_USES)

    @field_validator("role")
    @classmethod
    def _players_only(cls, value: RoleEnum) -> RoleEnum:
        # Planners join an exercise as planning team members added directly by
        # another of its Planners (Creator -> Settings -> TTX
        # planning team), never through a shared join code.
        if value != RoleEnum.PLAYER:
            raise ValueError(
                "Invitations are for players only. Add Planners as "
                "exercise planning team members instead."
            )
        return value

    @field_validator("expires_at")
    @classmethod
    def _validate_expires_at(cls, value: datetime) -> datetime:
        now = datetime.now(UTC)
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        if value <= now:
            raise ValueError("expires_at must be in the future")
        if value > now + MAX_TOKEN_LIFETIME:
            raise ValueError(f"expires_at must be within {MAX_TOKEN_LIFETIME.days} days")
        return value


class InvitationTokenCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ttx_id: uuid.UUID
    role: RoleEnum
    description: str | None
    expires_at: datetime
    max_uses: int | None
    created_at: datetime
    token: str


class RedeemAccountCreate(BaseModel):
    email: EmailStr
    password: StrongPassword
    full_name: str = Field(min_length=1, max_length=255)
    # The current version of every published legal document (GET /legal);
    # empty while the deployment has published none.
    accepted_legal: list[LegalAcceptanceItem] = Field(default_factory=list, max_length=4)


class InvitationTokenRedeemRequest(BaseModel):
    token: str = Field(min_length=1)
    account: RedeemAccountCreate | None = None


class InvitationTokenRedeemResponse(BaseModel):
    ttx_id: uuid.UUID
    ttx_name: str
    organization_name: str
    organization_domain: str | None
    role: RoleEnum
    status: Literal["pending"]
    user: UserRead


class InvitationTokenRevokeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    revoked_at: datetime | None


class TokenRedemptionRead(BaseModel):
    user_id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str
    redeemed_at: datetime


class InvitationTokenAuditRead(BaseModel):
    id: uuid.UUID
    ttx_id: uuid.UUID
    role: RoleEnum
    description: str | None
    token: str
    expires_at: datetime
    max_uses: int | None
    redemption_count: int
    revoked_at: datetime | None
    created_at: datetime
    created_by_id: uuid.UUID
    redemptions: list[TokenRedemptionRead]
    tags: list[TTXTagRead]


class InvitationTokenAuditListResponse(BaseModel):
    items: list[InvitationTokenAuditRead]
    total: int
    limit: int
    offset: int
