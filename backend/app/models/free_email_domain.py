from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class FreeEmailDomain(SQLModel, table=True):
    """The instance administrator's changes to the free email domains that
    can't found an organization of their own in an "open" deployment
    (org_creation_security): a domain added to the built-in list, or one of
    the built-in domains switched off (`disabled`). Who did it lives in
    Platform's activity log."""

    __tablename__ = "free_email_domain"

    domain: str = Field(primary_key=True, max_length=253)
    # Only meaningful for a built-in domain: an added one is just deleted.
    disabled: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
