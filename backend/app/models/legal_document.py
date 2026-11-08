import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class LegalDocumentKind(StrEnum):
    """The legal documents a deployment's operator publishes for its users
    (Platform), accepted together at signup."""

    TERMS = "terms"
    PRIVACY = "privacy"


class LegalDocumentDraft(SQLModel, table=True):
    """The operator's working copy of one document, per language (Markdown
    subset). Publishing copies it into a new LegalDocumentVersion; the draft
    stays as the starting point for the next version."""

    __tablename__ = "legal_document_draft"

    kind: LegalDocumentKind = Field(primary_key=True)
    # language -> Markdown text; a missing or empty language isn't offered.
    content: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")


class LegalDocumentVersion(SQLModel, table=True):
    """One published version of a document, immutable: the exact text users
    accepted. `requires_acceptance` marks a substantial change, which every
    account must accept again; a minor correction is only recorded."""

    __tablename__ = "legal_document_version"
    __table_args__ = (UniqueConstraint("kind", "version"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    kind: LegalDocumentKind = Field(index=True)
    # 1, 2, 3... per kind.
    version: int
    content: dict = Field(sa_column=Column(JSONB, nullable=False))
    requires_acceptance: bool
    published_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    published_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")


class LegalAcceptance(SQLModel, table=True):
    """An account accepted one version of one document (at signup, or after
    a substantial change). Kept forever as proof; never updated."""

    __tablename__ = "legal_acceptance"
    __table_args__ = (UniqueConstraint("user_id", "kind", "version"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    kind: LegalDocumentKind
    version: int
    accepted_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
