import uuid
from datetime import UTC, datetime

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class AssistantProposal(SQLModel, table=True):
    """A change the AI assistant proposes to an exercise's design (a need,
    an objective, an MSEL inject), waiting for its author to accept or
    discard it on the form's page (services/assistant/proposals.py).
    Accepting happens in the page's draft, like any edit, and the form's
    own save persists it; the proposal only records that it was applied.

    `patch` holds the proposed fields in the page draft's shape: rows are
    referred to by their id, or by "proposal:<id>" for a row another
    pending proposal creates (listed in `depends_on`). On an update,
    `base` holds those fields as they were saved when it was proposed, so
    the page can tell a field changed since (a conflict)."""

    __tablename__ = "assistant_proposal"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    # Its author: the only person who sees it and decides on it.
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    # Where it came from: "mcp" (later also an integrated chat or an import).
    source: str = Field(default="mcp", max_length=16)
    # Proposals made by one call share it.
    batch_id: uuid.UUID
    # "need", "objective", "inject", or a part of the after-action report:
    # "aar_text", "aar_objective", "aar_action".
    target: str = Field(max_length=16)
    # "create" or "update".
    operation: str = Field(max_length=16)
    # The row an update changes.
    target_id: uuid.UUID | None = Field(default=None)
    base: dict | None = Field(default=None, sa_column=Column(JSONB, nullable=True))
    patch: dict = Field(sa_column=Column(JSONB, nullable=False))
    depends_on: list[str] = Field(
        default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]")
    )
    # Why, in a sentence of the assistant's.
    summary: str = Field(default="", max_length=500)
    # A name the assistant gave a set of proposals ("Close MSEL v5"), to
    # review and accept them together.
    changeset: str | None = Field(default=None, max_length=80, index=True)
    # Validation warnings this proposal would add, when it was made.
    issues: list[dict] = Field(
        default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]")
    )
    # What of the session backs an after-action proposal, checked when it
    # was made: [{kind, ref, label}].
    evidence: list[dict] = Field(
        default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]")
    )
    # "pending", "accepted" or "discarded".
    status: str = Field(default="pending", max_length=16, index=True)
    applied_row_id: uuid.UUID | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    decided_at: datetime | None = Field(default=None)
