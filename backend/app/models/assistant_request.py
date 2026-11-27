import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class AssistantRequest(SQLModel, table=True):
    """Something a person asks the AI assistant for from a design page (a
    document or one of its rows, with a note), waiting for their AI client
    to read it (services/assistant/requests.py). No model runs here: the
    client lists the open ones, and a proposal that names one answers it."""

    __tablename__ = "assistant_request"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    # Whose it is: they alone see it, and their own client answers it.
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    # The page it was asked on: "needs", "msel" or "conduct-prep".
    section: str = Field(max_length=16)
    # The row it's about, when it's about one (any coded row of the exercise).
    row_id: uuid.UUID | None = Field(default=None)
    # What they ask, in their words.
    note: str = Field(max_length=1000)
    # "open" or "answered".
    status: str = Field(default="open", max_length=16, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    answered_at: datetime | None = Field(default=None)
