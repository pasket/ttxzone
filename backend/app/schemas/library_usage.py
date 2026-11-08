"""What uses an organization library item, and what deleting it did."""

import uuid
from typing import Literal

from pydantic import BaseModel


class LibraryUsageExercise(BaseModel):
    """An exercise holding copies of the item."""

    ttx_id: uuid.UUID
    name: str
    copies: int


class LibraryUsageInject(BaseModel):
    """An inject of the library sent by the item (an actor)."""

    id: uuid.UUID
    title: str


class LibraryUsage(BaseModel):
    exercises: list[LibraryUsageExercise] = []
    injects: list[LibraryUsageInject] = []
    # Where a tag is applied in the organization.
    memberships: int = 0
    allowed_domains: int = 0
    applied_to_organization: bool = False
    # Every use above, counted once each (0: it can be deleted for good).
    total: int = 0


class LibraryDeleteResult(BaseModel):
    """`deleted`: gone for good. `disabled`: still in use, so it was
    disabled instead; `usage` says where."""

    result: Literal["deleted", "disabled"]
    usage: LibraryUsage
