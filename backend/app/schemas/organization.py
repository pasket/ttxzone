import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.password_policy import StrongPassword
from app.models.organization_membership import OrgRoleEnum
from app.schemas.legal import LegalAcceptanceItem
from app.schemas.organization_tag import OrganizationTagRead


class OrganizationProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    tax_id: str | None = Field(default=None, max_length=50)


class OrganizationFoundRequest(BaseModel):
    """A signed-in account founding an organization of its own."""

    name: str = Field(min_length=1, max_length=255)


class ProgramManagerCreate(BaseModel):
    email: EmailStr
    password: StrongPassword
    full_name: str = Field(min_length=1, max_length=255)


class OrganizationSignupRequest(BaseModel):
    organization: OrganizationProfileCreate
    admin: ProgramManagerCreate
    # The current version of every published legal document (GET /legal);
    # empty while the deployment has published none.
    accepted_legal: list[LegalAcceptanceItem] = Field(default_factory=list, max_length=4)


class OrganizationRead(BaseModel):
    """Not built via automatic from_attributes conversion (despite the
    model_config below, kept for the id/name/tax_id/subscription_tier/
    created_at fields that do map 1:1 onto the Organization model) --
    `logo_url` has no matching attribute on Organization (only
    `logo_path` does, see organization_logo_service.logo_url), so every
    call site constructs this explicitly, field by field.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    domain: str | None
    alias: str | None
    tax_id: str | None
    subscription_tier: str
    description: str | None
    logo_url: str | None
    created_at: datetime


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str


class OrganizationSignupResponse(BaseModel):
    organization: OrganizationRead
    user: UserRead


class PlannerGrantRequest(BaseModel):
    email: EmailStr


class PlannerTagAssignmentRequest(BaseModel):
    """Full-replace semantics, same as TTXTagAssignmentRequest -- a
    dedicated class rather than reusing that one directly since this
    validates against a different tag table (OrganizationTag, not
    TTXTag)."""

    tag_ids: list[uuid.UUID]


class PlannerRead(BaseModel):
    user_id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str
    granted_at: datetime
    last_login_at: datetime | None = None
    tags: list[OrganizationTagRead] = []


class PlannerListResponse(BaseModel):
    items: list[PlannerRead]
    total: int
    limit: int
    offset: int


class OrgMemberRead(BaseModel):
    """One person in Admin -> Users and roles: every grant they hold in the
    organization, and their tags (one set per person)."""

    user_id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str
    granted_at: datetime
    last_login_at: datetime | None = None
    roles: list[Literal["program_manager", "planner", "observer", "evaluator"]]
    tags: list[OrganizationTagRead] = []
    # Removed while still on exercises: no grant counts until they're off
    # those exercises (then removable) or re-enabled.
    disabled: bool = False


class OrgMemberExerciseRead(BaseModel):
    """One exercise of the organization the person is on, and as what."""

    ttx_id: uuid.UUID
    code: str
    name: str
    role: str
    plans: bool
    controls: bool
    facilitates: bool
    # A team member who is also its Evaluator / Observer.
    evaluates: bool = False
    observes: bool = False
    is_lead: bool


class OrgMemberExerciseListResponse(BaseModel):
    items: list[OrgMemberExerciseRead]


class OrgMemberDeleteResponse(BaseModel):
    # "deleted": every grant gone; "disabled": still on `exercises`.
    status: Literal["deleted", "disabled"]
    exercises: list[str]


class OrgMemberListResponse(BaseModel):
    items: list[OrgMemberRead]
    total: int
    limit: int
    offset: int
    # Holders per role in the whole organization (unfiltered).
    role_counts: dict[str, int]


class OrgMemberTagsRequest(BaseModel):
    """Full-replace semantics, applied to every grant of the person."""

    tag_ids: list[uuid.UUID]


class ProgramManagerGrantRequest(BaseModel):
    email: EmailStr


class ProgramManagerRead(PlannerRead):
    """Same shape as a Planner grant: the user plus the grant's tags."""


class ProgramManagerListResponse(BaseModel):
    # Unpaginated on purpose -- see organization_service.list_program_managers.
    items: list[ProgramManagerRead]


class OrganizationSummary(BaseModel):
    """One organization a user belongs to, from their own point of view --
    used for the org switcher and the default-organization preference, not
    to be confused with OrganizationRead (the org's own admin-facing
    profile). is_program_manager/is_planner come strictly from
    OrganizationMembership, mirroring core/security.py's own helpers of
    the same name -- a Player-only or per-TTX-Planner-only org
    still appears here (see list_user_organizations), just with both flags
    False.
    """

    organization_id: uuid.UUID
    organization_name: str
    domain: str | None
    alias: str | None
    logo_url: str | None
    is_program_manager: bool
    is_planner: bool
    is_observer: bool = False
    is_evaluator: bool = False


class OrganizationSummaryListResponse(BaseModel):
    items: list[OrganizationSummary]


class DefaultOrganizationRequest(BaseModel):
    organization_id: uuid.UUID


class DefaultContextRequest(BaseModel):
    """Login-time default context. All three optional; null means "use the
    first available one". See organization_service.set_default_context."""

    organization_id: uuid.UUID | None = None
    role: (
        Literal[
            "program_manager",
            "planner",
            "controller",
            "facilitator",
            "evaluator",
            "observer",
            "player",
        ]
        | None
    ) = None
    ttx_id: uuid.UUID | None = None


class OrganizationProfileUpdateRequest(BaseModel):
    """Program Manager-editable organization profile fields, past signup --
    tax_id lives here rather than on OrganizationProfileCreate, since it's
    a Program Manager org-settings concern, not a registration-form field.
    `name` is optional so a client that omits it leaves the name unchanged;
    when sent it's stripped and must not be blank."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    tax_id: str | None = Field(default=None, max_length=50)
    alias: str | None = Field(default=None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class OrganizationAllowedDomainRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    allows_program_manager: bool
    allows_planner: bool
    tags: list[OrganizationTagRead] = []
    created_at: datetime


class _AllowedDomainScopes(BaseModel):
    """Which grants a domain is allowlisted for. At least one must be on --
    a domain that allows nothing is just a removed domain. Defaults to TTX
    Managers only: allowing a domain to receive Program Manager is always an
    explicit choice (the org's own domain, seeded at signup, is the one
    exception and gets both)."""

    allows_program_manager: bool = False
    allows_planner: bool = True

    @model_validator(mode="after")
    def _at_least_one_scope(self) -> "_AllowedDomainScopes":
        if not (self.allows_program_manager or self.allows_planner):
            raise ValueError("Allow the domain for Program Managers, Planners, or both.")
        return self


class OrganizationAllowedDomainCreateRequest(_AllowedDomainScopes):
    domain: str = Field(min_length=3, max_length=255, pattern=r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


class OrganizationAllowedDomainUpdateRequest(_AllowedDomainScopes):
    """The domain name itself isn't editable -- remove and re-add instead."""


class OrganizationAllowedDomainListResponse(BaseModel):
    items: list[OrganizationAllowedDomainRead]
    total: int
    limit: int
    offset: int


class AllowedDomainTagAssignmentRequest(BaseModel):
    """Full-replace semantics, same shape as PlannerTagAssignmentRequest
    -- the ids in this list are exactly the tags that should end up
    assigned to this allowed-domain row."""

    tag_ids: list[uuid.UUID]


class BareRegisterRequest(BaseModel):
    """A brand-new account with no organization and no invitation token --
    pending role assignment (an org grants Planner later, or the user
    redeems a token later). Mirrors RedeemAccountCreate/ProgramManagerCreate's
    field shape/validators exactly."""

    email: EmailStr
    password: StrongPassword
    full_name: str = Field(min_length=1, max_length=255)
    # The current version of every published legal document (GET /legal);
    # empty while the deployment has published none.
    accepted_legal: list[LegalAcceptanceItem] = Field(default_factory=list, max_length=4)


class DomainAccountRead(BaseModel):
    """An account from one of the organization's allowed domains that holds
    no role in it yet."""

    user_id: uuid.UUID
    email: str
    full_name: str
    created_at: datetime
    last_login_at: datetime | None


class DomainAccountListResponse(BaseModel):
    items: list[DomainAccountRead]


class LeaveCandidateRead(BaseModel):
    user_id: uuid.UUID
    full_name: str
    # Output: plain str (a deleted account's placeholder must still load).
    email: str


class LeaveExerciseRead(BaseModel):
    ttx_id: uuid.UUID
    ttx_code: str
    ttx_name: str
    # The roles held there (TTXAccess.context_roles()).
    seats: list[str]
    # The only Planner / Controller there: leaving waits until someone
    # else is added.
    blocked: Literal["planner", "controller"] | None
    # Leads it with others who plan: one of them takes over (chosen).
    lead_candidates: list[LeaveCandidateRead]


class OrganizationLeavePreviewRead(BaseModel):
    """What leaving the organization would take (Preferences -> Privacy)."""

    organization_name: str
    is_program_manager: bool
    is_last_program_manager: bool
    program_manager_candidates: list[LeaveCandidateRead]
    exercises: list[LeaveExerciseRead]


class OrganizationDeleteRequest(BaseModel):
    # The organization's name, typed.
    confirmation: str = Field(max_length=255)


class OrganizationLeaveRequest(BaseModel):
    # The organization's name, typed.
    confirmation: str = Field(max_length=255)
    # Gets the Program Manager role: required for the last one.
    program_manager_successor_id: uuid.UUID | None = None
    # Exercise id -> the Planner who becomes its Lead Planner.
    lead_successors: dict[uuid.UUID, uuid.UUID] = Field(default_factory=dict, max_length=200)


class OrgRoleInvitationCreateRequest(BaseModel):
    """Admin -> Users and roles -> Add person where roles are offered, not
    granted (organization_role_invitation_service)."""

    email: EmailStr
    roles: list[OrgRoleEnum] = Field(min_length=1, max_length=4)
    tag_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)


class OrgRoleInvitationCreateResponse(BaseModel):
    # "granted": the person was already in the organization (or in its own
    # domain) and holds the roles now; "invited": an offer waits for the
    # address -- the same answer whether an account holds it or not.
    outcome: Literal["invited", "granted"]


class OrgRoleInvitationRead(BaseModel):
    """An offer as its organization's Program Managers see it: the address
    they typed, never anything about an account."""

    id: uuid.UUID
    email: str
    roles: list[OrgRoleEnum]
    invited_by_name: str | None
    sent_at: datetime
    expires_at: datetime


class OrgRoleInvitationListResponse(BaseModel):
    items: list[OrgRoleInvitationRead]


class MyRoleInvitationRead(BaseModel):
    """An offer as the invited account sees it."""

    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str
    organization_domain: str | None
    roles: list[OrgRoleEnum]
    invited_by_name: str | None
    sent_at: datetime
    expires_at: datetime


class MyRoleInvitationListResponse(BaseModel):
    items: list[MyRoleInvitationRead]


class RoleInvitationAcceptResponse(BaseModel):
    organization_id: uuid.UUID
    # The roles added (empty when the allowlist no longer accepts them).
    roles: list[OrgRoleEnum]
