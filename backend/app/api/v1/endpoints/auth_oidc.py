"""Single sign-on through an OpenID Connect provider (docs/architecture/sso.md):
signing in, proving it's you again (step-up) and linking an account."""

import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.security import (
    RequireRecentAuthentication,
    create_mfa_pending_token,
    get_current_user,
    get_current_user_optional,
    get_current_user_session,
    start_session,
    verify_csrf,
)
from app.models import OidcLoginState, User, UserSession
from app.schemas.auth import OidcPublicConfig, OidcRedirectRequest, OidcRedirectResponse
from app.services import email_mfa_service, oidc_service, session_service
from app.services.auth_event_service import auth_event
from app.services.auth_service import record_login, record_signup
from app.services.oidc_service import OidcConfig, OidcError
from app.services.totp_service import new_login_challenge

router = APIRouter(prefix="/auth/oidc", tags=["auth"])


def _spa(path: str, params: dict[str, str] | None = None, fragment: str | None = None) -> str:
    """An address of the application (PUBLIC_BASE_URL), for the browser."""
    url = f"{settings.PUBLIC_BASE_URL or ''}{path}"
    if params:
        url += ("&" if "?" in url else "?") + urlencode(params)
    if fragment:
        url += f"#{fragment}"
    return url


def _set_binding_cookie(response: Response, binding: str) -> None:
    response.set_cookie(
        oidc_service.BINDING_COOKIE_NAME,
        binding,
        max_age=int(oidc_service.STATE_TTL.total_seconds()),
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        # Lax: sent on the provider's top-level redirect back to the callback.
        samesite="lax",
        path=oidc_service.BINDING_COOKIE_PATH,
    )


def _clear_binding_cookie(response: Response) -> None:
    response.delete_cookie(
        oidc_service.BINDING_COOKIE_NAME,
        path=oidc_service.BINDING_COOKIE_PATH,
        secure=settings.ENVIRONMENT != "development",
        samesite="lax",
    )


def _require_config(session: Session) -> OidcConfig:
    config = oidc_service.effective_config(session)
    if config is None:
        raise AppException(
            "SSO_UNAVAILABLE",
            "Single sign-on isn't available.",
            404,
            log_level=logging.WARNING,
        )
    return config


def _begin(
    session: Session,
    config: OidcConfig,
    purpose: oidc_service.Purpose,
    return_to: str,
    user: User,
    user_session: UserSession,
    response: Response,
) -> OidcRedirectResponse:
    try:
        url, binding = oidc_service.begin(
            session, config, purpose, return_to=return_to, user=user, user_session=user_session
        )
    except OidcError as exc:
        raise AppException(
            "SSO_PROVIDER_UNREACHABLE",
            "The single sign-on provider can't be reached. Try again later.",
            502,
            log_level=logging.WARNING,
        ) from exc
    _set_binding_cookie(response, binding)
    return OidcRedirectResponse(authorize_url=url)


@router.get("/config", response_model=OidcPublicConfig)
def public_config(session: Session = Depends(get_session)) -> OidcPublicConfig:
    """Whether the sign-in page offers single sign-on, and as what."""
    config = oidc_service.effective_config(session)
    if config is None:
        return OidcPublicConfig(enabled=False)
    return OidcPublicConfig(
        enabled=True, display_name=config.display_name, provider_kind=config.provider_kind
    )


@router.get("/start")
def start(
    return_to: str | None = Query(default=None, max_length=500),
    session: Session = Depends(get_session),
) -> RedirectResponse:
    """Off to the provider to sign in (a full-page navigation)."""
    config = oidc_service.effective_config(session)
    if config is None:
        return RedirectResponse(_spa("/login", {"sso_error": "SSO_UNAVAILABLE"}), 302)
    try:
        url, binding = oidc_service.begin(session, config, "login", return_to=return_to)
    except OidcError as exc:
        auth_event(
            session,
            "auth.login_failed",
            details={"method": "sso", "reason": exc.reason, "detail": exc.detail},
            level=logging.WARNING,
        )
        return RedirectResponse(_spa("/login", {"sso_error": _code(exc.reason)}), 302)
    response = RedirectResponse(url, 302)
    _set_binding_cookie(response, binding)
    return response


@router.post("/step-up", response_model=OidcRedirectResponse, dependencies=[Depends(verify_csrf)])
def step_up(
    payload: OidcRedirectRequest,
    response: Response,
    user: User = Depends(get_current_user),
    user_session: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> OidcRedirectResponse:
    """Prove it's you again through the provider (the account is linked):
    where to send the browser. The callback marks this session."""
    config = _require_config(session)
    if oidc_service.identity_of(session, user) is None:
        raise AppException(
            "SSO_NOT_LINKED",
            "This account isn't linked to single sign-on.",
            409,
            log_level=logging.WARNING,
        )
    return _begin(session, config, "step_up", payload.return_to, user, user_session, response)


@router.post(
    "/link",
    response_model=OidcRedirectResponse,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def start_link(
    payload: OidcRedirectRequest,
    response: Response,
    user: User = Depends(get_current_user),
    user_session: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> OidcRedirectResponse:
    """Link this account to the provider: where to send the browser. With
    step-up -- it's a new way into the account."""
    config = _require_config(session)
    if oidc_service.identity_of(session, user) is not None:
        raise AppException(
            "SSO_ALREADY_LINKED",
            "This account is already linked to single sign-on.",
            409,
            log_level=logging.WARNING,
        )
    return _begin(session, config, "link", payload.return_to, user, user_session, response)


@router.delete(
    "/link", status_code=204, dependencies=[Depends(verify_csrf), RequireRecentAuthentication]
)
def unlink(user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> None:
    """Unlink the provider; refused while the account has no password."""
    oidc_service.unlink(session, user)
    auth_event(session, "auth.sso_unlink", user)


def _code(reason: str) -> str:
    return f"SSO_{reason.upper()}"


@router.get("/callback")
def callback(
    request: Request,
    code: str | None = Query(default=None, max_length=4096),
    state: str | None = Query(default=None, max_length=128),
    error: str | None = Query(default=None, max_length=256),
    session: Session = Depends(get_session),
) -> RedirectResponse:
    """Where the provider sends the browser back. Every outcome is a
    redirect into the application (an error as ?sso_error=SSO_<REASON>),
    never a page of its own."""
    binding = request.cookies.get(oidc_service.BINDING_COOKIE_NAME)
    login_state: OidcLoginState | None = None
    try:
        login_state = oidc_service.consume_state(session, state, binding)
        if error is not None:
            # The person cancelled, or the provider refused them.
            reason = "cancelled" if error == "access_denied" else "provider_error"
            raise OidcError(reason, error[:64])
        config = oidc_service.effective_config(session)
        if config is None:
            raise OidcError("unavailable")
        claims = oidc_service.exchange_code(config, login_state, code or "")
        if login_state.purpose == "login":
            response = _finish_login(request, session, config, claims, login_state.return_to)
        else:
            response = _finish_for_session(request, session, config, claims, login_state)
    except OidcError as exc:
        response = _failure(session, request, exc, login_state)
    _clear_binding_cookie(response)
    return response


def _failure(
    session: Session, request: Request, exc: OidcError, login_state: OidcLoginState | None
) -> RedirectResponse:
    purpose = login_state.purpose if login_state is not None else "login"
    user = exc.user
    if user is None and login_state is not None and login_state.user_id is not None:
        user = session.get(User, login_state.user_id)
    details = {"method": "sso", "reason": exc.reason}
    if exc.detail:
        details["detail"] = exc.detail
    if purpose == "step_up":
        details = {"factor": "sso", "reason": exc.reason}
        auth_event(session, "auth.step_up_failed", user, details=details, level=logging.WARNING)
    else:
        if purpose == "link":
            details["link"] = True
        auth_event(session, "auth.login_failed", user, details=details, level=logging.WARNING)
    # Back where the person was (step-up, link), else the sign-in page.
    path = login_state.return_to if login_state is not None and purpose != "login" else "/login"
    return RedirectResponse(_spa(path, {"sso_error": _code(exc.reason)}), 302)


def _finish_login(
    request: Request,
    session: Session,
    config: OidcConfig,
    claims: dict,
    return_to: str,
) -> RedirectResponse:
    user, created = oidc_service.resolve_login(session, config, claims)
    if user.suspended_at is not None:
        raise OidcError("suspended", user=user)
    provider_mfa = oidc_service.provider_did_mfa(config, claims)
    if not provider_mfa and email_mfa_service.needs_challenge(session, user):
        # The provider didn't ask for a second factor: the account's own
        # (TOTP or an email code) finishes the sign-in, on the sign-in page. The token travels
        # in the fragment: never sent to a server, nor in a Referer.
        jti = new_login_challenge(session, user)
        token = create_mfa_pending_token(user.id, jti)
        return RedirectResponse(
            _spa("/login", {"return_to": return_to}, f"mfa={token}"),
            302,
        )
    response = RedirectResponse(_spa("/auth/sso", {"return_to": return_to}), 302)
    if created:
        record_signup(session, user, "sso")
    else:
        # Whether the provider's token said it asked for a second factor:
        # the activity log shows the operator if trusting it takes effect
        # (Entra's ID tokens may not carry `amr`, docs/architecture/sso.md).
        record_login(session, user, "sso", {"provider_mfa": provider_mfa})
    start_session(request, response, session, user, mfa_source="provider" if provider_mfa else None)
    return response


def _finish_for_session(
    request: Request,
    session: Session,
    config: OidcConfig,
    claims: dict,
    login_state: OidcLoginState,
) -> RedirectResponse:
    """Step-up and link: only for the account and the session that asked."""
    user = get_current_user_optional(request, session)
    user_session: UserSession | None = getattr(request.state, "user_session", None)
    if (
        user is None
        or user_session is None
        or user.id != login_state.user_id
        or user_session.id != login_state.session_id
    ):
        raise OidcError("session_mismatch")
    if login_state.purpose == "link":
        oidc_service.link(session, user, config, claims)
        auth_event(
            session,
            "auth.sso_link",
            user,
            details={"provider_email": oidc_service.verified_email(config, claims)},
        )
        return RedirectResponse(_spa(login_state.return_to, {"sso_linked": "1"}), 302)

    if not oidc_service.matches_identity(session, user, config, claims):
        raise OidcError("identity_mismatch")
    if not oidc_service.recently_authenticated(claims, login_state.created_at):
        raise OidcError("not_recent")
    # An account with its own TOTP doesn't step up with less than that.
    if user.totp_enabled and not oidc_service.provider_did_mfa(config, claims):
        raise OidcError("mfa_required")
    session_service.mark_authenticated(session, user_session)
    auth_event(session, "auth.step_up", user, details={"factor": "sso"})
    return RedirectResponse(_spa(login_state.return_to, {"sso_confirmed": "1"}), 302)
