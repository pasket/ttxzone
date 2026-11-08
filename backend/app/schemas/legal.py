from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import LegalDocumentKind

# Per language, generous for a legal text yet bounded.
MAX_LEGAL_TEXT_LENGTH = 100_000


class LegalAcceptanceItem(BaseModel):
    """One version of one document the user accepts (signup, or after a
    substantial change). Must be the version currently published."""

    kind: LegalDocumentKind
    version: int = Field(ge=1)


class LegalDocumentSummary(BaseModel):
    """The latest published version of a document, without its text."""

    kind: LegalDocumentKind
    version: int
    published_at: datetime
    languages: list[str]


class LegalDocumentListResponse(BaseModel):
    # Empty while the operator has published nothing: signup asks nothing.
    items: list[LegalDocumentSummary]


class LegalDocumentRead(BaseModel):
    kind: LegalDocumentKind
    version: int
    published_at: datetime
    # The language served: the one asked for when published in it, else the
    # first available (`requested_language_available` false).
    language: str
    requested_language_available: bool
    content: str


class LegalAcceptRequest(BaseModel):
    acceptances: list[LegalAcceptanceItem] = Field(min_length=1, max_length=len(LegalDocumentKind))


class LegalPendingRead(BaseModel):
    kind: LegalDocumentKind
    version: int
    # The account accepted an earlier version: a substantial change, not
    # a first publication.
    updated: bool


class LegalAcceptanceRead(BaseModel):
    kind: LegalDocumentKind
    version: int
    accepted_at: datetime


class LegalAcceptanceListResponse(BaseModel):
    items: list[LegalAcceptanceRead]


class LegalDraftRead(BaseModel):
    content: dict[str, str]
    updated_at: datetime | None


class LegalVersionSummary(BaseModel):
    version: int
    published_at: datetime
    published_by: str | None
    requires_acceptance: bool
    languages: list[str]


class LegalDocumentAdminRead(BaseModel):
    """Platform's view of one document: the working draft, whether it differs
    from what's published, and every published version."""

    kind: LegalDocumentKind
    draft: LegalDraftRead
    has_unpublished_changes: bool
    versions: list[LegalVersionSummary]


class LegalDocumentAdminListResponse(BaseModel):
    items: list[LegalDocumentAdminRead]


class LegalDraftUpdateRequest(BaseModel):
    # language -> Markdown text; only supported languages are kept.
    content: dict[str, str] = Field(max_length=8)


class LegalPublishRequest(BaseModel):
    # A substantial change every account must accept again; ignored for the
    # first version, which everyone always accepts.
    requires_acceptance: bool


class LegalVersionRead(BaseModel):
    version: int
    published_at: datetime
    published_by: str | None
    requires_acceptance: bool
    content: dict[str, str]


class LegalTemplateRequest(BaseModel):
    """The operator's details, written into the templates once."""

    operator_name: str = Field(min_length=1, max_length=255)
    contact_email: EmailStr
    postal_address: str = Field(default="", max_length=500)
    jurisdiction: str = Field(min_length=1, max_length=255)


class LegalTemplateRead(BaseModel):
    kind: LegalDocumentKind
    content: dict[str, str]


class LegalTemplateListResponse(BaseModel):
    items: list[LegalTemplateRead]
