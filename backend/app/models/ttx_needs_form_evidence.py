import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class TTXNeedsFormEvidence(SQLModel, table=True):
    """A file backing an approval (a signed PDF, the sponsor's email...).
    Stored on disk under a random name (`stored_name`, no extension) in a
    directory no StaticFiles mount serves; `original_filename` is only
    used for the download's Content-Disposition, and `content_type` comes
    from the server's own allowlist, never from the client."""

    __tablename__ = "ttx_needs_form_evidence"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    approval_id: uuid.UUID = Field(foreign_key="ttx_needs_form_approval.id", index=True)
    stored_name: str = Field(max_length=64, unique=True)
    original_filename: str = Field(max_length=255)
    content_type: str = Field(max_length=100)
    size_bytes: int
    uploaded_by_id: uuid.UUID = Field(foreign_key="user.id")
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
