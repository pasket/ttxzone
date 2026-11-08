import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class MselImage(SQLModel, table=True):
    """An image uploaded to an MSEL (a ransom note, a leak-site screenshot,
    a chat message...), attached to injects through InjectImage. The file
    lives under settings.MSEL_IMAGE_UPLOAD_DIR with a random name and is
    only served through the MSEL's guarded endpoint: it carries the
    exercise's TLP. Re-encoded on upload (msel_image_service), so its
    content type is always one the server wrote."""

    __tablename__ = "msel_image"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    msel_id: uuid.UUID = Field(foreign_key="ttx_msel.id", index=True)
    stored_name: str = Field(max_length=64)
    content_type: str = Field(max_length=32)
    width: int
    height: int
    size_bytes: int
    uploaded_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class InjectImage(SQLModel, table=True):
    """An image shown with an inject, in order, with an optional caption.
    Several injects may share one image (a duplicated inject does)."""

    __tablename__ = "inject_image"

    inject_id: uuid.UUID = Field(foreign_key="inject.id", primary_key=True)
    image_id: uuid.UUID = Field(foreign_key="msel_image.id", primary_key=True, index=True)
    position: int = Field(default=0)
    caption: str = Field(default="", max_length=255)
