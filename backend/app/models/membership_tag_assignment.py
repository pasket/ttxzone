import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class MembershipTagAssignment(SQLModel, table=True):
    """One OrganizationTag applied to one OrganizationMembership (an
    Planner grant) -- same shape as TTXTagAssignment/
    InvitationTokenTagAssignment. organization_membership.id is an int PK
    (unlike every other assignment target in this schema, which is uuid),
    so organization_membership_id below is int, not uuid, to match its FK
    target."""

    __tablename__ = "membership_tag_assignment"
    __table_args__ = (UniqueConstraint("organization_tag_id", "organization_membership_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_tag_id: uuid.UUID = Field(foreign_key="organization_tag.id", index=True)
    organization_membership_id: int = Field(foreign_key="organization_membership.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
