import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.core.password_policy import (
    PASSWORD_HISTORY_MAX,
    PASSWORD_MAX_AGE_DAYS_MAX,
    PASSWORD_MIN_LENGTH,
    PASSWORD_MIN_LENGTH_MAX,
)

TenancyModeField = Literal["open", "single", "managed"]


class InstancePolicyRead(BaseModel):
    """What the menus need, signed in or not: whether an account may found
    an organization on its own (signup, avatar menu, Waiting Room)."""

    tenancy_mode: TenancyModeField
    can_found_organization: bool
    # The deployment sends email links: the sign-in page offers "Forgot
    # your password?".
    password_reset_available: bool
    # Same condition: Creator -> Players -> Invitations can send personal
    # invitations by email.
    email_invitations_available: bool
    # The deployment's password rules the forms check before sending
    # (Platform -> Sign-in security); reuse is only checked by the server.
    password_min_length: int = 8
    password_reject_personal: bool = False
    # The AI assistant is on: Preferences shows its section.
    assistant_enabled: bool = False
    # The face this answer came through (docs/deployment.md, section 8):
    # "public" shows only the Player's workspace.
    surface: Literal["internal", "public"] = "internal"


class InstanceSettingsRead(BaseModel):
    tenancy_mode: TenancyModeField
    max_organizations: int | None
    pinned_by_env: bool
    organization_count: int


class InstanceSettingsUpdateRequest(BaseModel):
    tenancy_mode: TenancyModeField
    max_organizations: int | None = Field(default=None, ge=1)


class PasswordPolicyFields(BaseModel):
    min_length: int = Field(ge=PASSWORD_MIN_LENGTH, le=PASSWORD_MIN_LENGTH_MAX)
    reject_personal: bool
    # None: passwords never expire.
    max_age_days: int | None = Field(default=None, ge=1, le=PASSWORD_MAX_AGE_DAYS_MAX)
    # 0: reuse isn't checked.
    history_count: int = Field(ge=0, le=PASSWORD_HISTORY_MAX)


class MfaPolicyFields(BaseModel):
    """Whether each role must have a second factor. The instance
    administrator always must, so it has no field."""

    program_manager: bool
    planner: bool
    evaluator: bool
    observer: bool
    player: bool


class MfaPolicyCounts(BaseModel):
    program_manager: int
    planner: int
    evaluator: int
    observer: int
    player: int


class SecurityPolicyRead(BaseModel):
    password: PasswordPolicyFields
    mfa: MfaPolicyFields
    # Per role: active accounts holding it without their own TOTP.
    accounts_without_totp: MfaPolicyCounts


class SecurityPolicyUpdateRequest(BaseModel):
    password: PasswordPolicyFields
    mfa: MfaPolicyFields


class FreeEmailDomainRead(BaseModel):
    domain: str
    builtin: bool
    active: bool


class FreeEmailDomainListResponse(BaseModel):
    items: list[FreeEmailDomainRead]
    # The list only applies in an "open" deployment.
    applies: bool


class FreeEmailDomainCreateRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=253, pattern=r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


class FreeEmailDomainUpdateRequest(BaseModel):
    active: bool


class InstanceOrganizationRead(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None
    program_manager_count: int
    created_at: datetime


class InstanceOrganizationListResponse(BaseModel):
    items: list[InstanceOrganizationRead]
    total: int
    limit: int
    offset: int


class InstanceOrganizationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    program_manager_email: EmailStr


class InstanceOrganizationUpdateRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=255, pattern=r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


class InstanceProgramManagerRead(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str | None
    # Removed from the organization while still on its exercises.
    disabled: bool


class InstanceProgramManagerListResponse(BaseModel):
    items: list[InstanceProgramManagerRead]


class InstanceProgramManagerGrantRequest(BaseModel):
    email: EmailStr


class InstanceAccountOrganizationRead(BaseModel):
    id: uuid.UUID
    name: str
    roles: list[str]
    # Removed from the organization while still on its exercises.
    disabled: bool
    # Its only active Program Manager: suspending the account leaves the
    # organization without one.
    sole_program_manager: bool


class InstanceAccountRead(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str | None
    created_at: datetime
    last_login_at: datetime | None
    is_instance_admin: bool
    suspended_at: datetime | None
    organizations: list[InstanceAccountOrganizationRead]


class InstanceAccountListResponse(BaseModel):
    items: list[InstanceAccountRead]
    total: int
    limit: int
    offset: int


class InstanceAccountSuspendRequest(BaseModel):
    # The account's email, typed to confirm.
    confirmation: str = Field(min_length=1, max_length=255)


class InstanceAccountExerciseRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    organization_id: uuid.UUID
    organization_name: str
    # TTXContextRole values: planner, controller, facilitator, evaluator,
    # observer, player.
    roles: list[str]
    lead_evaluator: bool
    lead_planner: bool


class InstanceAccountDependencyRead(BaseModel):
    # organizations, exercises, exercise_requests, invitations, library,
    # exercise_content, instance or other.
    category: str
    count: int


class InstanceAccountDetailRead(InstanceAccountRead):
    totp_enabled: bool
    email_mfa_enabled: bool
    backup_codes_remaining: int
    password_change_required: bool
    # When the address was confirmed (a link opened, or single sign-on);
    # None: never -- `email_verification_pending` says whether it's asked.
    email_verified_at: datetime | None
    email_verification_pending: bool
    # Asked to confirm it again (periodic reconfirmation) and past the
    # grace period: held at the confirmation screen.
    email_reconfirmation_overdue: bool = False
    active_sessions: int
    exercises: list[InstanceAccountExerciseRead]
    # What keeps it from being deleted for good; empty = it can be.
    dependencies: list[InstanceAccountDependencyRead]
    # Your own account: managed from Preferences, not here.
    is_self: bool


class InstanceAccountUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None


class InstanceAccountCreateRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)


class InstanceAccountCreateRead(BaseModel):
    user_id: uuid.UUID
    # Shown once, like a reset: give it to the person over a channel you trust.
    temporary_password: str


class InstanceAccountPasswordResetRead(BaseModel):
    # Shown once: give it to the person over a channel you trust.
    temporary_password: str


class InstanceAccountDeleteRequest(BaseModel):
    # The account's email, typed to confirm.
    confirmation: str = Field(min_length=1, max_length=255)


class InstanceAccountBulkRequest(BaseModel):
    action: Literal["suspend", "reactivate", "end_sessions", "delete"]
    user_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)
    # Suspending and deleting: the number of accounts, typed to confirm.
    confirmation: str = Field(default="", max_length=10)


class InstanceAccountBulkOutcomeRead(BaseModel):
    user_id: uuid.UUID
    email: str | None
    # Null: done; else why this one was skipped.
    code: str | None
    message: str | None


class InstanceAccountBulkRead(BaseModel):
    done: int
    skipped: int
    results: list[InstanceAccountBulkOutcomeRead]


class InstanceAdminRead(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    created_at: datetime
    last_login_at: datetime | None
    suspended_at: datetime | None


class InstanceAdminListResponse(BaseModel):
    items: list[InstanceAdminRead]
    # False: granted and revoked from the server's console only
    # (INSTANCE_ADMIN_WEB_GRANTS).
    web_grants_enabled: bool


class InstanceAdminGrantRequest(BaseModel):
    user_id: uuid.UUID
    # The account's email, typed to confirm.
    confirmation: str = Field(min_length=1, max_length=255)


class PlatformAuditEventRead(BaseModel):
    id: uuid.UUID
    created_at: datetime
    action: str
    # None: the server's console.
    actor_user_id: uuid.UUID | None
    actor_label: str
    target_kind: str
    target_id: uuid.UUID | None
    target_label: str | None
    details: dict | None


class PlatformAuditListResponse(BaseModel):
    items: list[PlatformAuditEventRead]
    total: int
    limit: int
    offset: int


class AuditWebhookRead(BaseModel):
    configured: bool
    url: str | None = None
    enabled: bool = False
    # Shared with the collector to check each delivery's signature.
    secret: str | None = None
    # Whether an Authorization header is stored (its value never leaves).
    has_authorization: bool = False
    pending: int = 0
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_status: int | None = None
    last_error: str | None = None
    # Whether plain http:// collectors are accepted (AUDIT_WEBHOOK_ALLOW_HTTP).
    allow_http: bool


class AuditWebhookUpdateRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2000)
    enabled: bool = True
    # None keeps the stored header; "" removes it.
    authorization: str | None = Field(default=None, max_length=1000)


class AuditRetentionRead(BaseModel):
    days: int
    # The server's log files (settings.LOG_FILE_*); max_mb 0 = logrotate.
    log_file_max_mb: int
    log_file_backups: int


class AuditWebhookTestRead(BaseModel):
    ok: bool
    status: int | None
    error: str | None


class DomainOrganizationRead(BaseModel):
    id: uuid.UUID
    name: str


class DomainOrganizationListResponse(BaseModel):
    items: list[DomainOrganizationRead]
