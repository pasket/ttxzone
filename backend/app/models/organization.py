import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class Organization(SQLModel, table=True):
    __tablename__ = "organization"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=255)
    # The founding Program Manager's email domain at signup, captured once and
    # never editable -- shown alongside the org name in invite-facing copy
    # so a recipient can judge provenance. Nullable: orgs created before
    # this column existed have no backfilled value.
    domain: str | None = Field(default=None, max_length=255)
    # Program Manager-editable like name (unlike domain) -- shown in parens next to
    # the org name in the header's context bar when set.
    alias: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=50)
    subscription_tier: str = Field(default="free", max_length=50)
    description: str | None = Field(default=None, max_length=2000)
    logo_path: str | None = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
