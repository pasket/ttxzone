import uuid
from datetime import UTC, datetime

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class AssistantOrgProposal(SQLModel, table=True):
    """Something the AI assistant proposes to an organization rather than to
    one of its exercises (services/assistant/proposals_org.py): a new
    exercise, or an inject for its Library. Like an exercise's proposals,
    it waits for its author, who accepts it into the page's own form (the
    form's save creates the row) or discards it."""

    __tablename__ = "assistant_org_proposal"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    # Its author: the only person who sees it and decides on it.
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    # "new_exercise" or "library_inject".
    target: str = Field(max_length=16)
    # The form's fields, as its save takes them.
    patch: dict = Field(sa_column=Column(JSONB, nullable=False))
    # Why, in a sentence of the assistant's.
    summary: str = Field(default="", max_length=500)
    # "pending", "accepted" or "discarded".
    status: str = Field(default="pending", max_length=16, index=True)
    # The exercise or Library inject the accepted proposal became.
    applied_id: uuid.UUID | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    decided_at: datetime | None = Field(default=None)
    # Why it was discarded, for the assistant to read before proposing again.
    decision_reason: str | None = Field(default=None, max_length=24)
    decision_note: str | None = Field(default=None, max_length=500)
