import uuid
from typing import Literal

from pydantic import BaseModel, Field

# Enough for a page of a list several times over, and a bound on the work
# one request can ask for.
MAX_BULK = 200


class BulkFailure(BaseModel):
    id: uuid.UUID
    code: str
    message: str


class BulkResult(BaseModel):
    """The rows the action was applied to, and the ones it wasn't, each
    with the error it would have answered on its own."""

    done: list[uuid.UUID]
    failed: list[BulkFailure]


class AccessRequestsDecideRequest(BaseModel):
    request_ids: list[uuid.UUID] = Field(min_length=1, max_length=MAX_BULK)
    decision: Literal["approve", "reject"]


class PlayersRemoveRequest(BaseModel):
    user_ids: list[uuid.UUID] = Field(min_length=1, max_length=MAX_BULK)


class ExercisesArchiveRequest(BaseModel):
    ttx_ids: list[uuid.UUID] = Field(min_length=1, max_length=MAX_BULK)
    # False brings them back.
    archived: bool = True
