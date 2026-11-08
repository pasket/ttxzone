import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import settings
from app.models import MselStatus, NeedsFormStatus, Tlp
from app.schemas.ttx_tag import TTXTagRead


def _supported_language(value: str | None) -> str | None:
    if value is not None and value not in settings.SUPPORTED_LOCALES:
        raise ValueError(f"Must be one of {', '.join(settings.SUPPORTED_LOCALES)}.")
    return value


class TTXCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    # Formatted text (a small Markdown subset), up to a long brief.
    description: str | None = Field(default=None, max_length=10000)
    organization_id: uuid.UUID
    # The language of its content; left out, the creator's.
    content_language: str | None = Field(default=None, max_length=8)

    _language = field_validator("content_language")(_supported_language)


class TTXUpdateRequest(BaseModel):
    """An update never moves a TTX to a different org, unlike create --
    no organization_id here."""

    name: str = Field(min_length=1, max_length=255)
    # Formatted text (a small Markdown subset), up to a long brief.
    description: str | None = Field(default=None, max_length=10000)
    # The language of its content (a supported locale); left out, kept.
    content_language: str | None = Field(default=None, max_length=8)

    _language = field_validator("content_language")(_supported_language)


class LeadPlannerRead(BaseModel):
    user_id: uuid.UUID
    full_name: str


class TTXRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    organization_id: uuid.UUID
    created_by_id: uuid.UUID
    created_at: datetime
    # The language of its content (None: not known yet).
    content_language: str | None = None
    role: str
    # The caller's planning and control team functions on it (role
    # "planner" only): plans (design), controls (runs the exercise),
    # facilitates (moderates it alongside the Players).
    plans: bool = False
    controls: bool = False
    facilitates: bool = False
    # Also its Evaluator / Observer (a team member, role "planner" only).
    evaluates: bool = False
    observes: bool = False
    image_url: str | None
    tags: list[TTXTagRead]
    # The needs form's state, so every exercise screen can show the TLP
    # label and the design gate without fetching the form itself.
    needs_form_status: NeedsFormStatus
    tlp: Tlp
    # None until the MSEL is first opened.
    msel_status: MselStatus | None = None
    # The planning team member who coordinates it (None only while the
    # exercise has no Planner at all).
    lead_planner: LeadPlannerRead | None = None
    # The caller may delete it: a Program Manager of its organization, or
    # its Lead Planner.
    can_delete: bool = False
    # Archived: read-only, out of the default lists. Whoever may delete it
    # (`can_delete`) archives and unarchives it.
    archived_at: datetime | None = None


class TTXListResponse(BaseModel):
    items: list[TTXRead]
    total: int
    limit: int
    offset: int


class TTXDeleteRequest(BaseModel):
    """The exercise's name, typed to confirm a permanent delete."""

    confirmation: str = Field(min_length=1, max_length=255)


class TTXDuplicateRequest(BaseModel):
    """The copy's name, in the source's organization (named explicitly,
    like every write: it must be the source's)."""

    name: str = Field(min_length=1, max_length=255)
    organization_id: uuid.UUID


class TTXDuplicateResponse(BaseModel):
    ttx: TTXRead
    # Team members left off the copy: their org grant is gone.
    skipped_members: list[str]


class TTXAttentionRead(BaseModel):
    """GET /ttx/{ttx_id}/attention: how many validation issues keep each
    document from moving on; None for one not opened yet."""

    needs_analysis: int
    msel: int | None
    session_plan: int | None
