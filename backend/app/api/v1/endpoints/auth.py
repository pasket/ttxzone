import logging
import uuid

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlmodel import Session, select

from app.core import surface
from app.core.config import settings
from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.i18n import get_locale
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.core.security import (
    RequireRecentAuthentication,
    clear_auth_cookies,
    client_address,
    create_mfa_pending_token,
    decode_mfa_pending_token,
    get_current_user,
    get_current_user_session,
    start_session,
    verify_csrf,
    verify_password,
)
from app.models import Organization, User, UserSession
from app.schemas.auth import (
    AccountDeleteRequest,
    AuthMeResponse,
    AvatarPresetRequest,
    EmailCodeSentResponse,
    EmailMfaConfirmRequest,
    EmailVerifyRequest,
    ForgotPasswordRequest,
    LeadExerciseListResponse,
    LeadExerciseRead,
    LeadHandoverCandidate,
    LoginRequest,
    LoginResponse,
    MfaChallengeRequest,
    MfaChallengeResponse,
    MfaPreferredRequest,
    PasswordChangeRequest,
    PasswordResetRequest,
    SessionInfo,
    StepUpRequest,
    TotpBackupCodesRegenerateRequest,
    TotpBackupCodesRegenerateResponse,
    TotpConfirmRequest,
    TotpConfirmResponse,
    TotpDisableRequest,
    TotpEnrollResponse,
    UserSessionListResponse,
    UserSessionRead,
    VerifyTotpLoginRequest,
)
from app.schemas.legal import LegalPendingRead
from app.schemas.organization import (
    BareRegisterRequest,
    DefaultContextRequest,
    DefaultOrganizationRequest,
    UserRead,
)
from app.services import (
    account_email_service,
    email_mfa_service,
    legal_service,
    oidc_service,
    session_service,
)
from app.services.auth_event_service import auth_event
from app.services.auth_service import (
    authenticate_user,
    change_password,
    deactivate_account,
    ensure_not_suspended,
    log_logout,
    record_login,
    record_signup,
    register_bare_account,
    user_is_org_planner,
    user_is_org_program_manager,
)
from app.services.avatar_service import (
    avatar_kind_and_value,
    clear_avatar,
    save_uploaded_avatar,
    set_preset_avatar,
)
from app.services.login_throttle_service import guarded_signup
from app.services.organization_service import set_default_context, set_default_organization
from app.services.security_policy_service import (
    effective_password_policy,
    mfa_mandated,
    password_expired,
)
from app.services.tenancy_service import is_last_instance_admin, self_service_founding_allowed
from app.services.totp_service import (
    confirm_enrollment,
    consume_backup_code,
    count_unused_backup_codes,
    disable,
    ensure_not_locked,
    is_current_challenge,
    new_login_challenge,
    record_failure,
    record_success,
    regenerate_backup_codes,
    start_enrollment,
    verify_code,
)
from app.services.ttx_planning_team_service import exercises_led

router = APIRouter(prefix="/auth", tags=["auth"])


def _invalid_totp_code() -> AppException:
    return AppException(
        "INVALID_TOTP_CODE",
        "Invalid or expired code.",
        400,
        log_level=logging.WARNING,
        logger_name=AUTH_LOGGER_NAME,
    )


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
) -> LoginResponse:
    """Sign in with email and password; may ask for a second factor."""
    user = authenticate_user(session, payload.email, payload.password, client_address(request))

    if email_mfa_service.needs_challenge(session, user):
        jti = new_login_challenge(session, user)
        return LoginResponse(
            mfa_required=True,
            mfa_pending_token=create_mfa_pending_token(user.id, jti),
            mfa_methods=email_mfa_service.methods(session, user),
            mfa_preferred=email_mfa_service.preferred(session, user),
        )

    record_login(session, user, "password")
    start_session(request, response, session, user)
    return LoginResponse(mfa_required=False, user=UserRead.model_validate(user))


def _challenged_user(session: Session, mfa_pending_token: str) -> User:
    """The account a sign-in challenge belongs to, while it may still be
    answered: only the latest challenge counts, and too many wrong codes
    withdraw it (the user goes back to the password step)."""
    user_id, jti = decode_mfa_pending_token(mfa_pending_token)
    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise _invalid_totp_code()
    ensure_not_suspended(user)
    ensure_not_locked(user)
    if not is_current_challenge(user, jti):
        raise AppException(
            "MFA_CHALLENGE_EXPIRED",
            "Sign in again.",
            401,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )
    return user


@router.post("/login/challenge", response_model=MfaChallengeResponse)
def login_challenge(
    payload: MfaChallengeRequest, session: Session = Depends(get_session)
) -> MfaChallengeResponse:
    """The methods of a pending challenge, for a sign-in page that only has
    its token (single sign-on hands it over in the address fragment)."""
    user = _challenged_user(session, payload.mfa_pending_token)
    return MfaChallengeResponse(
        mfa_methods=email_mfa_service.methods(session, user),
        mfa_preferred=email_mfa_service.preferred(session, user),
    )


@router.post("/login/email-code", response_model=EmailCodeSentResponse)
def login_email_code(
    payload: MfaChallengeRequest,
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> EmailCodeSentResponse:
    """Emails a code that answers the pending sign-in challenge."""
    user = _challenged_user(session, payload.mfa_pending_token)
    return EmailCodeSentResponse(
        sent_to=email_mfa_service.send_code(session, user, "login", locale)
    )


@router.post("/login/verify-totp", response_model=LoginResponse)
def verify_totp_login(
    payload: VerifyTotpLoginRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
) -> LoginResponse:
    """Finish signing in with an authenticator or backup code."""
    user = _challenged_user(session, payload.mfa_pending_token)

    if payload.method == "email":
        if "email" in email_mfa_service.methods(session, user) and (
            email_mfa_service.verify_code(session, user, payload.code)
        ):
            record_success(session, user)
            record_login(session, user, "email_code")
            start_session(request, response, session, user)
            return LoginResponse(mfa_required=False, user=UserRead.model_validate(user))
        record_failure(session, user)
        auth_event(
            session, "auth.mfa_failed", user, details={"factor": "email"}, level=logging.WARNING
        )
        raise _invalid_totp_code()

    if payload.method != "backup_code" and verify_code(session, user, payload.code):
        record_success(session, user)
        record_login(session, user, "totp")
        start_session(request, response, session, user)
        return LoginResponse(mfa_required=False, user=UserRead.model_validate(user))

    if payload.method != "totp" and consume_backup_code(session, user, payload.code):
        record_success(session, user)
        # A backup code means the authenticator is lost: whoever else may
        # hold a session on this account loses it.
        session_service.revoke_sessions(session, user)
        record_login(session, user, "backup_code")
        start_session(request, response, session, user)
        return LoginResponse(mfa_required=False, user=UserRead.model_validate(user))

    record_failure(session, user)
    auth_event(session, "auth.mfa_failed", user, level=logging.WARNING)
    raise _invalid_totp_code()


@router.post("/step-up", status_code=204, dependencies=[Depends(verify_csrf)])
def step_up(
    payload: StepUpRequest,
    user: User = Depends(get_current_user),
    user_session: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> None:
    """Prove it's you again on this session, for the actions guarded by
    require_recent_authentication: a TOTP code when the account has TOTP
    (backup codes don't count -- they reset enrollment), an email code
    (method="email") when it has that factor -- the only way when it's its
    one factor -- else the password. An account with none of them (single
    sign-on only) goes back to the provider (POST /auth/oidc/step-up)."""
    has_email = "email" in email_mfa_service.methods(session, user)
    if payload.method == "email" or (has_email and not user.totp_enabled):
        factor = "email"
    elif user.totp_enabled:
        factor = "totp"
    elif user.hashed_password is None:
        raise AppException(
            "SSO_STEP_UP_REQUIRED",
            "Confirm it's you with your single sign-on provider.",
            409,
            log_level=logging.WARNING,
        )
    else:
        factor = "password"

    if factor == "password":
        if not payload.password or not verify_password(payload.password, user.hashed_password):
            auth_event(
                session, "auth.step_up_failed", user, details={"factor": "password"},
                level=logging.WARNING,
            )  # fmt: skip
            raise AppException(
                "INVALID_CREDENTIALS",
                "Invalid password.",
                401,
                log_level=logging.WARNING,
                logger_name=AUTH_LOGGER_NAME,
            )
    else:
        ensure_not_locked(user)
        if factor == "email":
            valid = (
                has_email
                and bool(payload.code)
                and email_mfa_service.verify_code(session, user, payload.code or "")
            )
        else:
            valid = bool(payload.code) and verify_code(session, user, payload.code or "")
        if not valid:
            record_failure(session, user)
            auth_event(
                session, "auth.step_up_failed", user, details={"factor": factor},
                level=logging.WARNING,
            )  # fmt: skip
            raise _invalid_totp_code()
        record_success(session, user)
    session_service.mark_authenticated(session, user_session)
    auth_event(session, "auth.step_up", user, details={"factor": factor})


@router.post(
    "/step-up/email-code",
    response_model=EmailCodeSentResponse,
    dependencies=[Depends(verify_csrf)],
)
def step_up_email_code(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> EmailCodeSentResponse:
    """Emails a code for POST /auth/step-up with method="email"."""
    return EmailCodeSentResponse(
        sent_to=email_mfa_service.send_code(session, user, "step_up", locale)
    )


def _session_read(user_session: UserSession, current: UserSession) -> UserSessionRead:
    return UserSessionRead(
        id=user_session.id,
        created_at=user_session.created_at,
        last_seen_at=user_session.last_seen_at,
        user_agent=user_session.user_agent,
        ip_address=user_session.ip_address,
        current=user_session.id == current.id,
    )


@router.get("/sessions", response_model=UserSessionListResponse)
def list_sessions(
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> UserSessionListResponse:
    """The caller's active sessions."""
    return UserSessionListResponse(
        items=[
            _session_read(s, current) for s in session_service.list_active_sessions(session, user)
        ]
    )


@router.delete("/sessions", status_code=204, dependencies=[Depends(verify_csrf)])
def revoke_other_sessions(
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> None:
    """End every session of the caller's except the current one."""
    session_service.revoke_sessions(session, user, keep=current.id)


@router.delete("/sessions/{session_id}", status_code=204, dependencies=[Depends(verify_csrf)])
def revoke_session(
    session_id: uuid.UUID,
    response: Response,
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> None:
    """End one of the caller's sessions."""
    target = session.get(UserSession, session_id)
    if target is None or target.user_id != user.id:
        raise AppException(
            "SESSION_NOT_FOUND", "Session not found.", 404, log_level=logging.WARNING
        )
    session_service.revoke(session, target)
    if target.id == current.id:
        clear_auth_cookies(response)


@router.post("/register", response_model=LoginResponse, status_code=201)
def register_bare_account_endpoint(
    payload: BareRegisterRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> LoginResponse:
    """Create an account without an organization."""
    legal_service.require_signup_acceptance(session, payload.accepted_legal)
    with guarded_signup(session, payload.email, client_address(request)):
        user = register_bare_account(session, payload)
    legal_service.record_signup_acceptance(session, user, payload.accepted_legal)
    account_email_service.start_verification(session, user, locale)
    record_signup(session, user, "account")
    start_session(request, response, session, user)
    return LoginResponse(mfa_required=False, user=UserRead.model_validate(user))


@router.post("/password/forgot", status_code=202)
def forgot_password(
    payload: ForgotPasswordRequest,
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> None:
    """Public: emails a link to choose a new password. The same answer
    whether or not an account has that address."""
    account_email_service.request_password_reset(session, payload.email, locale)


@router.post("/password/reset", status_code=204)
def reset_password(
    payload: PasswordResetRequest, request: Request, session: Session = Depends(get_session)
) -> None:
    """Public: spends a reset link. Signs every session out and opens none:
    the person signs in again, second factor included."""
    account_email_service.reset_password(
        session, payload.token, payload.new_password, client_address(request)
    )


@router.post("/email/verify", status_code=204)
def verify_email(payload: EmailVerifyRequest, session: Session = Depends(get_session)) -> None:
    """Public: spends a confirmation link, from any browser."""
    account_email_service.verify_email(session, payload.token)


@router.post("/email/verification", status_code=202, dependencies=[Depends(verify_csrf)])
def resend_email_verification(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> None:
    """A new confirmation link (the previous one stops working)."""
    account_email_service.resend_verification(session, user, locale)


@router.post("/logout", status_code=204, dependencies=[Depends(verify_csrf)])
def logout(
    response: Response,
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> None:
    """End the current session."""
    session_service.revoke(session, current)
    clear_auth_cookies(response)
    log_logout(session, user)


@router.delete(
    "/me", status_code=204, dependencies=[Depends(verify_csrf), RequireRecentAuthentication]
)
def delete_account_endpoint(
    payload: AccountDeleteRequest,
    response: Response,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Delete the caller's account. Needs a recent authentication."""
    deactivate_account(session, user, payload.confirmation, payload.lead_successors)
    clear_auth_cookies(response)


@router.get("/me/lead-exercises", response_model=LeadExerciseListResponse)
def lead_exercises_endpoint(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> LeadExerciseListResponse:
    """The exercises whose Lead Planner role deleting this account must
    hand over, each with the members who could take it."""
    led = exercises_led(session, user)
    org_ids = list({ttx.organization_id for ttx, _ in led})
    organizations = {
        o.id: o.name for o in session.exec(select(Organization).where(Organization.id.in_(org_ids)))
    }
    return LeadExerciseListResponse(
        items=[
            LeadExerciseRead(
                ttx_id=ttx.id,
                ttx_code=ttx.code,
                ttx_name=ttx.name,
                organization_name=organizations.get(ttx.organization_id, ""),
                candidates=[
                    LeadHandoverCandidate(user_id=member.id, full_name=member.full_name)
                    for _, member in team
                    if member.id != user.id
                ],
            )
            for ttx, team in led
        ]
    )


@router.get("/me", response_model=AuthMeResponse)
def me(
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> AuthMeResponse:
    """The signed-in account, with its roles and session."""
    avatar_kind, avatar_value = avatar_kind_and_value(user)
    accepted = legal_service.accepted_versions(session, user)
    expired = password_expired(session, user)
    return AuthMeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        totp_enabled=user.totp_enabled,
        # The Players' face answers as a Player: no organization role, no
        # Platform (none of it is served there).
        is_program_manager=user_is_org_program_manager(session, user) and not surface.is_public(),
        is_planner=user_is_org_planner(session, user) and not surface.is_public(),
        is_instance_admin=user.is_instance_admin and not surface.is_public(),
        password_change_required=user.password_change_required or expired,
        password_change_reason=(
            "reset" if user.password_change_required else "expired" if expired else None
        ),
        mfa_mandated=mfa_mandated(session, user),
        password_min_length=effective_password_policy(session).min_length,
        email_verification_pending=account_email_service.verification_pending(session, user),
        email_reconfirm_deadline=(
            user.email_reconfirm_deadline
            if account_email_service.reconfirmation_asked(session, user)
            else None
        ),
        email_reconfirmation_overdue=account_email_service.reconfirmation_overdue(session, user),
        is_last_instance_admin=is_last_instance_admin(session, user),
        can_found_organization=self_service_founding_allowed(session),
        legal_acceptance_pending=[
            LegalPendingRead(
                kind=version.kind, version=version.version, updated=version.kind in accepted
            )
            for version in legal_service.pending_acceptances(session, user)
        ],
        backup_codes_remaining=count_unused_backup_codes(session, user) if user.totp_enabled else 0,
        email_mfa_enabled=user.email_mfa_enabled,
        email_mfa_available=email_mfa_service.usable(session),
        mfa_methods=email_mfa_service.methods(session, user),
        mfa_preferred=email_mfa_service.preferred(session, user),
        default_organization_id=user.default_organization_id,
        default_role=user.default_role,
        default_ttx_id=user.default_ttx_id,
        avatar_kind=avatar_kind,
        avatar_value=avatar_value,
        has_password=user.hashed_password is not None,
        sso_linked=oidc_service.identity_of(session, user) is not None,
        sso_provider=sso.display_name if (sso := oidc_service.effective_config(session)) else None,
        session=SessionInfo(
            idle_timeout_minutes=current.idle_timeout_minutes,
            idle_expires_at=session_service.idle_expires_at(current),
            absolute_expires_at=current.absolute_expires_at,
            authenticated_at=current.authenticated_at,
            step_up_minutes=settings.STEP_UP_MINUTES,
            mfa_source="provider" if current.mfa_source == "provider" else None,
        ),
    )


@router.patch("/default-organization", status_code=204, dependencies=[Depends(verify_csrf)])
def set_default_organization_endpoint(
    payload: DefaultOrganizationRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Set the organization the caller lands on."""
    set_default_organization(session, user, payload.organization_id)


@router.put("/default-context", status_code=204, dependencies=[Depends(verify_csrf)])
def set_default_context_endpoint(
    payload: DefaultContextRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Set the organization, exercise and role the caller lands on."""
    set_default_context(session, user, payload.organization_id, payload.role, payload.ttx_id)


@router.post("/totp/enroll", response_model=TotpEnrollResponse, dependencies=[Depends(verify_csrf)])
def enroll_totp(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> TotpEnrollResponse:
    """Start enrolling an authenticator app: a new secret and its QR data."""
    provisioning_uri = start_enrollment(session, user)
    return TotpEnrollResponse(provisioning_uri=provisioning_uri)


@router.post(
    "/totp/enroll/confirm", response_model=TotpConfirmResponse, dependencies=[Depends(verify_csrf)]
)
def confirm_totp_enrollment(
    payload: TotpConfirmRequest,
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> TotpConfirmResponse:
    """Finish enrolling with a code from the app; returns the backup codes."""
    backup_codes = confirm_enrollment(session, user, payload.code)
    # A new second factor: other sessions were opened without it.
    session_service.revoke_sessions(session, user, keep=current.id)
    session_service.mark_authenticated(session, current)
    return TotpConfirmResponse(backup_codes=backup_codes)


@router.post(
    "/totp/disable",
    status_code=204,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def disable_totp(
    payload: TotpDisableRequest,
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> None:
    """Turn off the authenticator app. Needs a recent authentication."""
    disable(session, user, payload.password)
    session_service.revoke_sessions(session, user, keep=current.id)


@router.post(
    "/totp/backup-codes/regenerate",
    response_model=TotpBackupCodesRegenerateResponse,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def regenerate_backup_codes_endpoint(
    payload: TotpBackupCodesRegenerateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TotpBackupCodesRegenerateResponse:
    """Replace the backup codes, shown only in this answer."""
    codes = regenerate_backup_codes(session, user, payload.password)
    return TotpBackupCodesRegenerateResponse(backup_codes=codes)


@router.post(
    "/mfa/email/enable", response_model=EmailCodeSentResponse, dependencies=[Depends(verify_csrf)]
)
def start_email_mfa(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> EmailCodeSentResponse:
    """Emails the code that turns the factor on (POST .../confirm)."""
    return EmailCodeSentResponse(
        sent_to=email_mfa_service.send_code(session, user, "enable", locale)
    )


@router.post("/mfa/email/enable/confirm", status_code=204, dependencies=[Depends(verify_csrf)])
def confirm_email_mfa(
    payload: EmailMfaConfirmRequest,
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> None:
    """Turn on the second factor by email with the code sent to the address."""
    email_mfa_service.enable(session, user, payload.code)
    # A new second factor: other sessions were opened without it.
    session_service.revoke_sessions(session, user, keep=current.id)
    session_service.mark_authenticated(session, current)


@router.delete(
    "/mfa/email",
    status_code=204,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def disable_email_mfa(
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> None:
    """Turn off the second factor by email. Needs a recent authentication."""
    email_mfa_service.disable(session, user)
    session_service.revoke_sessions(session, user, keep=current.id)


@router.put("/mfa/preferred", status_code=204, dependencies=[Depends(verify_csrf)])
def set_preferred_mfa(
    payload: MfaPreferredRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Choose which second factor a challenge opens on."""
    email_mfa_service.set_preferred(session, user, payload.method)


@router.post(
    "/password", status_code=204, dependencies=[Depends(verify_csrf), RequireRecentAuthentication]
)
def change_password_endpoint(
    payload: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> None:
    """Change the caller's password. Needs a recent authentication."""
    change_password(session, user, payload.current_password, payload.new_password)
    session_service.revoke_sessions(session, user, keep=current.id)


@router.post("/avatar/preset", status_code=204, dependencies=[Depends(verify_csrf)])
def set_avatar_preset_endpoint(
    payload: AvatarPresetRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Use one of the preset avatars."""
    set_preset_avatar(session, user, payload.preset_key)


@router.post("/avatar/upload", status_code=204, dependencies=[Depends(verify_csrf)])
def upload_avatar_endpoint(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Upload the caller's avatar image."""
    save_uploaded_avatar(session, user, file)


@router.delete("/avatar", status_code=204, dependencies=[Depends(verify_csrf)])
def clear_avatar_endpoint(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Remove the caller's avatar."""
    clear_avatar(session, user)
