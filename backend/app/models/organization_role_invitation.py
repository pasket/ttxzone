import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlmodel import Field, SQLModel


class OrganizationRoleInvitation(SQLModel, table=True):
    """Organization roles offered to an email address, waiting for the
    account with that address to accept them (organization_role_invitation_service).

    Where any account may found an organization ("open" tenancy), a Program
    Manager can't grant a role straight to someone outside the
    organization's own domain: the grant would pull a stranger in without
    asking and show the Program Manager their name and activity. The offer
    is kept by address -- whether an account exists or not, so the answer
    never tells -- and becomes OrganizationMembership rows only when that
    account accepts. One live offer per organization and address: offering
    again adds the roles and renews the expiry."""

    __tablename__ = "organization_role_invitation"
    __table_args__ = (UniqueConstraint("organization_id", "email"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    # Lower-case; only the account with exactly this address can accept.
    email: str = Field(max_length=255, index=True)
    # OrgRoleEnum values, in hierarchy order.
    roles: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String(32)), nullable=False)
    )
    # The organization's tags for the person, applied on acceptance (those
    # deleted meanwhile are skipped).
    tag_ids: list[uuid.UUID] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(Uuid), nullable=False, server_default="{}"),
    )
    invited_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # The latest offer (the first, or a renewal).
    sent_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime
