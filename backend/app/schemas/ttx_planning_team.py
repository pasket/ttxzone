import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.schemas.ttx_tag import TTXTagRead


class PlanningTeamAddRequest(BaseModel):
    email: EmailStr
    plans: bool = True
    controls: bool = False
    facilitates: bool = False


class PlanningTeamFunctionsRequest(BaseModel):
    """Full-replace of a member's functions on the exercise."""

    plans: bool
    controls: bool
    facilitates: bool


class PlanningTeamTagAssignmentRequest(BaseModel):
    """Full-replace semantics, same as TTXTagAssignmentRequest."""

    tag_ids: list[uuid.UUID]


class PlanningTeamMemberRead(BaseModel):
    user_id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str
    added_at: datetime
    last_login_at: datetime | None = None
    tags: list[TTXTagRead] = []
    # The Lead Planner: coordinates the team, owns the calendar and the
    # deliverables. Exactly one member of a planning team.
    is_lead: bool = False
    plans: bool = False
    controls: bool = False
    facilitates: bool = False


class PlanningTeamLeadRequest(BaseModel):
    user_id: uuid.UUID


class PlanningTeamListResponse(BaseModel):
    # Unpaginated on purpose -- see ttx_planning_team_service.list_planning_team.
    items: list[PlanningTeamMemberRead]


class PlanningTeamCandidate(BaseModel):
    user_id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str


class PlanningTeamCandidateListResponse(BaseModel):
    items: list[PlanningTeamCandidate]
