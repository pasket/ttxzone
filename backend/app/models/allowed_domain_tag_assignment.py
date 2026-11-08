import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class AllowedDomainTagAssignment(SQLModel, table=True):
    """One OrganizationTag applied to one OrganizationAllowedDomain row --
    same shape as MembershipTagAssignment.
    organization_allowed_domain.id is an int PK (unlike every tag/
    OrganizationTag row, which is uuid), so organization_allowed_domain_id
    below is int, not uuid, to match its FK target."""

    __tablename__ = "allowed_domain_tag_assignment"
    __table_args__ = (UniqueConstraint("organization_tag_id", "organization_allowed_domain_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_tag_id: uuid.UUID = Field(foreign_key="organization_tag.id", index=True)
    organization_allowed_domain_id: int = Field(
        foreign_key="organization_allowed_domain.id", index=True
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
