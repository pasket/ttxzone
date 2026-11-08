"""The simulated actor library: TTX-Zone's catalog, an organization's own
actors, and a single actor of an exercise's cast (added or edited from
Library -> Simulated actors rather than the MSEL page)."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.models import ActorOrigin, ActorType, DeliveryMethod
from app.schemas.ttx_msel import ActorRead

ShortText = Annotated[str, Field(max_length=255)]
LongText = Annotated[str, Field(max_length=5000)]
OriginId = Annotated[str, Field(max_length=64)]


class SystemActorRead(BaseModel):
    id: str
    type: ActorType
    name_en: str
    name_es: str
    description_en: str
    description_es: str
    channel: DeliveryMethod
    default: bool


class SystemActorListResponse(BaseModel):
    items: list[SystemActorRead]


class ActorFields(BaseModel):
    """What an actor is, at any level of the library."""

    name: Annotated[str, Field(min_length=1, max_length=255)]
    type: ActorType = ActorType.OTHER
    description: LongText = ""
    channel: DeliveryMethod | None = None
    # What it was copied from, if anything.
    origin: ActorOrigin | None = None
    origin_id: OriginId | None = None
    # The original's name at copy time ("Copied from", read-only).
    origin_name: ShortText | None = None


class OrganizationActorRead(ActorFields):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    # Set when deleted while still in use (see library_usage_service).
    disabled_at: datetime | None = None
    # How many uses keep it from being deleted for good (library lists only).
    usage_count: int = 0


class OrganizationActorListResponse(BaseModel):
    items: list[OrganizationActorRead]


class ExerciseActorInput(ActorFields):
    """One actor of an exercise's cast, written from Templates."""

    played_by: ShortText = ""


class ExerciseActorRead(ActorRead):
    # An inject sends it: it can't leave the cast.
    in_use: bool


class ExerciseActorListResponse(BaseModel):
    items: list[ExerciseActorRead]
