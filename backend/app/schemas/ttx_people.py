import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr

from app.schemas.organization_tag import OrganizationTagRead
from app.schemas.ttx_tag import TTXTagRead

PeopleRole = Literal["planner", "observer", "evaluator"]


class ExercisePersonRead(BaseModel):
    """One row of the exercise's people matrix."""

    user_id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str
    added_at: datetime
    last_login_at: datetime | None = None
    role: PeopleRole
    plans: bool
    controls: bool
    facilitates: bool
    # A team member who is also its Evaluator / Observer.
    evaluates: bool = False
    observes: bool = False
    is_lead: bool
    # Lead Evaluator (Evaluators only, team members who evaluate included).
    leads: bool = False
    # The exercise roles their organization grants allow (what they can be
    # switched to).
    grants: list[PeopleRole] = []
    # The organization's tags on the person (shown first), then the
    # exercise's own.
    org_tags: list[OrganizationTagRead] = []
    tags: list[TTXTagRead] = []


class ExercisePeopleListResponse(BaseModel):
    items: list[ExercisePersonRead]


class ExercisePersonCandidate(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    # The exercise roles the person's organization grants allow.
    grants: list[PeopleRole]


class ExercisePersonCandidateListResponse(BaseModel):
    items: list[ExercisePersonCandidate]


class ExercisePersonRoleRequest(BaseModel):
    role: PeopleRole
    plans: bool = False
    controls: bool = False
    facilitates: bool = False
    # Team members only: also the exercise's Evaluator / Observer.
    evaluates: bool = False
    observes: bool = False


class ExercisePersonAddRequest(BaseModel):
    # Added as one role; a team member is made Evaluator / Observer too
    # afterwards (PUT .../role), once on the exercise.
    email: EmailStr
    role: PeopleRole
    plans: bool = False
    controls: bool = False
    facilitates: bool = False


class ExerciseJoinRequest(BaseModel):
    """A Program Manager taking a seat on an exercise themselves: as
    ExercisePersonAddRequest, for the caller."""

    role: PeopleRole
    plans: bool = False
    controls: bool = False
    facilitates: bool = False


class ExercisePersonTagsRequest(BaseModel):
    tag_ids: list[uuid.UUID]
