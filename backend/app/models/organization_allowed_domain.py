import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class OrganizationAllowedDomain(SQLModel, table=True):
    """One email domain an organization's Program Manager has opted into
    trusting for Program Manager and/or Planner (Planner) grants -- see
    is_email_domain_allowed in organization_service.py. Default-deny: a
    grant is refused unless a row for the email's domain has the matching
    allows_* flag. Signup seeds the org's own domain with both flags."""

    __tablename__ = "organization_allowed_domain"
    __table_args__ = (UniqueConstraint("organization_id", "domain"),)

    id: int | None = Field(default=None, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    domain: str = Field(max_length=255)
    # Which grants this domain is allowlisted for -- checked separately:
    # adding a Program Manager looks only at allows_program_manager, adding
    # a Planner only at allows_planner. At least one is always true. A new
    # domain is for Planners only unless said otherwise (as the API's
    # create schema); the founder's own domain is seeded with both.
    allows_program_manager: bool = Field(default=False)
    allows_planner: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
