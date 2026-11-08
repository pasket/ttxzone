import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models import AccessRequestStatus, RoleEnum
from app.schemas.organization import UserRead


class TTXAccessRequestRead(BaseModel):
    id: uuid.UUID
    ttx_id: uuid.UUID
    role: RoleEnum
    token_description: str | None
    status: AccessRequestStatus
    user: UserRead
    created_at: datetime
    # True when the org has no allowed-domain list configured, or the
    # requester's email domain is on it -- see
    # organization_service.list_allowed_domains. Informational only, never
    # blocks approval.
    is_allowed_domain: bool


class TTXAccessRequestListResponse(BaseModel):
    items: list[TTXAccessRequestRead]
    total: int
    limit: int
    offset: int


class MyAccessRequestRead(BaseModel):
    """A player's own view of one of their access requests -- unlike
    TTXAccessRequestRead (a Planner's admin view of who's asking), this
    carries ttx_name/organization_name instead of the requester's own user
    info, since the viewer already knows who they are.
    """

    id: uuid.UUID
    ttx_id: uuid.UUID
    ttx_name: str
    organization_name: str
    organization_domain: str | None
    role: RoleEnum
    status: AccessRequestStatus
    created_at: datetime


class MyAccessRequestListResponse(BaseModel):
    items: list[MyAccessRequestRead]
    total: int
    limit: int
    offset: int
