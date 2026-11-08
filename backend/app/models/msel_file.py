import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class MselFile(SQLModel, table=True):
    """A file uploaded to an MSEL for the players to download with an
    inject (a log excerpt, a packet capture, a memory dump...), attached
    through InjectFile. Unlike an image it's stored exactly as uploaded --
    it's evidence to analyse, so it can't be re-encoded -- under
    settings.MSEL_FILE_UPLOAD_DIR with a random name, and only ever served
    through a guarded endpoint as an opaque download: it carries the
    exercise's TLP and the platform never opens it."""

    __tablename__ = "msel_file"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    msel_id: uuid.UUID = Field(foreign_key="ttx_msel.id", index=True)
    stored_name: str = Field(max_length=64)
    original_name: str = Field(max_length=255)
    size_bytes: int
    # Hex digest, so the players can check what they downloaded.
    sha256: str = Field(max_length=64)
    uploaded_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class InjectFile(SQLModel, table=True):
    """A file handed out with an inject, in order, with an optional
    description. Several injects may share one file (a duplicated inject
    does)."""

    __tablename__ = "inject_file"

    inject_id: uuid.UUID = Field(foreign_key="inject.id", primary_key=True)
    file_id: uuid.UUID = Field(foreign_key="msel_file.id", primary_key=True, index=True)
    position: int = Field(default=0)
    description: str = Field(default="", max_length=255)
