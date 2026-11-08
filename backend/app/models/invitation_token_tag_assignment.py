import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class InvitationTokenTagAssignment(SQLModel, table=True):
    """One TTXTag applied to one InvitationToken -- same shape as
    TTXTagAssignment, kept as its own table rather than a polymorphic
    association since this codebase has no polymorphic-association
    precedent anywhere else in its schema."""

    __tablename__ = "invitation_token_tag_assignment"
    __table_args__ = (UniqueConstraint("ttx_tag_id", "invitation_token_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_tag_id: uuid.UUID = Field(foreign_key="ttx_tag.id", index=True)
    invitation_token_id: uuid.UUID = Field(foreign_key="invitation_token.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
