import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.password_policy import StrongPassword
from app.schemas.legal import LegalPendingRead
from app.schemas.organization import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


MfaMethod = Literal["totp", "email", "backup_code"]
# A method an account can prefer (backup codes are only a way back in).
PreferredMfaMethod = Literal["totp", "email"]


class LoginResponse(BaseModel):
    mfa_required: bool
    mfa_pending_token: str | None = None
    # With mfa_required: how the challenge can be answered, and the one it
    # opens on (email_mfa_service).
    mfa_methods: list[MfaMethod] = []
    mfa_preferred: PreferredMfaMethod | None = None
    user: UserRead | None = None


class VerifyTotpLoginRequest(BaseModel):
    mfa_pending_token: str = Field(min_length=1)
    # 6-digit TOTP or email code, or a "xxxxxxxx-xxxxxxxx" backup code.
    code: str = Field(min_length=6, max_length=17)
    # None: a TOTP code, else a backup code (as before email codes).
    method: MfaMethod | None = None


class MfaChallengeRequest(BaseModel):
    mfa_pending_token: str = Field(min_length=1)


class MfaChallengeResponse(BaseModel):
    mfa_methods: list[MfaMethod]
    mfa_preferred: PreferredMfaMethod | None


class EmailCodeSentResponse(BaseModel):
    # Masked ("p•••@acme.com").
    sent_to: str


class EmailMfaConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class MfaPreferredRequest(BaseModel):
    method: PreferredMfaMethod


class AuthMeResponse(BaseModel):
    id: uuid.UUID
    # Output: read back as stored -- a deleted account's placeholder
    # (".invalid" domain) isn't a deliverable address and must still load.
    email: str
    full_name: str
    totp_enabled: bool
    backup_codes_remaining: int
    # A code by email as a second factor (email_mfa_service): turned on,
    # and whether the deployment can send one at all.
    email_mfa_enabled: bool
    email_mfa_available: bool
    # How a challenge (sign-in, step-up) can be answered now, and the one
    # it opens on.
    mfa_methods: list[MfaMethod]
    mfa_preferred: PreferredMfaMethod | None
    is_program_manager: bool
    is_planner: bool
    # Runs the deployment (Platform); TOTP mandatory.
    is_instance_admin: bool
    # Signed in with a temporary password (reset from Platform), or one
    # past the deployment's maximum age: only the password change is open
    # until a new one is chosen. The reason picks the screen's copy.
    password_change_required: bool
    password_change_reason: Literal["reset", "expired"] | None = None
    # Holds a role whose second factor is mandatory (Platform -> Sign-in security),
    # or runs the deployment: the enrollment screen until it has one.
    mfa_mandated: bool = False
    # The deployment's minimum password length (Platform -> Sign-in security), for
    # the password change form's checklist.
    password_min_length: int = 8
    # Signed up while the deployment sends email and hasn't confirmed the
    # address yet: only the confirmation screen is open until it does.
    email_verification_pending: bool
    # Asked to confirm the address again (periodic reconfirmation): until
    # when it keeps working (a banner), and whether that's past -- then
    # only the confirmation screen is open.
    email_reconfirm_deadline: datetime | None = None
    email_reconfirmation_overdue: bool = False
    # The only active instance administrator: Preferences warns before
    # deleting the account.
    is_last_instance_admin: bool
    # The deployment's tenancy rules let this account found an organization
    # on its own (avatar menu, Waiting Room).
    can_found_organization: bool
    # Legal documents to accept before anything but the account itself
    # (LEGAL_ACCEPTANCE_REQUIRED elsewhere); empty when up to date.
    legal_acceptance_pending: list[LegalPendingRead]
    default_organization_id: uuid.UUID | None
    default_role: (
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
    )
    default_ttx_id: uuid.UUID | None
    avatar_kind: Literal["preset", "upload"] | None
    avatar_value: str | None
    # False: signs in only through single sign-on (may set a password).
    has_password: bool
    # Linked to the single sign-on provider (Account -> Sign-in methods).
    sso_linked: bool
    # The single sign-on provider's name when the deployment offers it.
    sso_provider: str | None
    session: "SessionInfo"


class SessionInfo(BaseModel):
    """The current session's timeouts, so the client can warn before the
    soft timeout and announce the hard one."""

    idle_timeout_minutes: int
    idle_expires_at: datetime
    absolute_expires_at: datetime
    authenticated_at: datetime
    step_up_minutes: int
    # "provider": opened through single sign-on with the provider's second
    # factor, which counts for the roles where TOTP is mandatory.
    mfa_source: Literal["provider"] | None = None


class StepUpRequest(BaseModel):
    # A TOTP code when the account has TOTP, an email code with
    # method="email", else the password.
    code: str | None = Field(default=None, max_length=32)
    method: PreferredMfaMethod | None = None
    password: str | None = Field(default=None, max_length=1024)


class OidcRedirectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Where the application goes afterwards: one of its own paths.
    return_to: str = Field(default="/", max_length=500)


class OidcRedirectResponse(BaseModel):
    # Where to send the browser (the provider's sign-in page).
    authorize_url: str


class OidcPublicConfig(BaseModel):
    """What the sign-in page needs to offer single sign-on."""

    enabled: bool
    display_name: str | None = None
    provider_kind: Literal["entra", "generic"] | None = None


class UserSessionRead(BaseModel):
    id: uuid.UUID
    created_at: datetime
    last_seen_at: datetime
    user_agent: str | None
    ip_address: str | None
    current: bool


class UserSessionListResponse(BaseModel):
    items: list[UserSessionRead]


class TotpEnrollResponse(BaseModel):
    provisioning_uri: str


class TotpConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TotpConfirmResponse(BaseModel):
    backup_codes: list[str]


class TotpDisableRequest(BaseModel):
    # None only for an account without a password (single sign-on only).
    password: str | None = Field(default=None, min_length=1, max_length=1024)


class TotpBackupCodesRegenerateRequest(BaseModel):
    # None only for an account without a password (single sign-on only).
    password: str | None = Field(default=None, min_length=1, max_length=1024)


class TotpBackupCodesRegenerateResponse(BaseModel):
    backup_codes: list[str]


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=1, max_length=128)
    new_password: StrongPassword


class EmailVerifyRequest(BaseModel):
    token: str = Field(min_length=1, max_length=128)


class PasswordChangeRequest(BaseModel):
    # None only when the account has no password yet (single sign-on only).
    current_password: str | None = Field(default=None, min_length=1, max_length=1024)
    new_password: StrongPassword


class AvatarPresetRequest(BaseModel):
    preset_key: str = Field(min_length=1, max_length=64)


class AccountDeleteRequest(BaseModel):
    confirmation: str = Field(min_length=1, max_length=64)
    # Exercise id -> who takes over as Lead Planner, for every exercise the
    # user leads with someone else on its planning team (GET
    # /auth/me/lead-exercises lists them).
    lead_successors: dict[uuid.UUID, uuid.UUID] = Field(default_factory=dict, max_length=500)


class LeadHandoverCandidate(BaseModel):
    user_id: uuid.UUID
    full_name: str


class LeadExerciseRead(BaseModel):
    ttx_id: uuid.UUID
    ttx_code: str
    ttx_name: str
    organization_name: str
    # The rest of the planning team, longest-standing first.
    candidates: list[LeadHandoverCandidate]


class LeadExerciseListResponse(BaseModel):
    items: list[LeadExerciseRead]
