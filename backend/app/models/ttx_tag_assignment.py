import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class TTXTagAssignment(SQLModel, table=True):
    """One TTXTag applied to one TTX (Exercise) -- many-to-many, a TTX can
    carry several tags and a tag can sit on several TTXs."""

    __tablename__ = "ttx_tag_assignment"
    __table_args__ = (UniqueConstraint("ttx_tag_id", "ttx_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_tag_id: uuid.UUID = Field(foreign_key="ttx_tag.id", index=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
