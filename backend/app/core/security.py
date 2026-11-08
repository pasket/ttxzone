import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session as OrmSession
from sqlmodel import Session, select

from app.core import surface
from app.core.config import settings
from app.core.db import get_session
from app.core.exceptions import AppException
from app.models import (
    TTX,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    TTXContextRole,
    User,
    UserSession,
    active_membership,
)
from app.services import legal_service, session_service

logger = logging.getLogger(__name__)

_password_hasher = PasswordHasher()
# Nobody's: checking a password against it costs what a real one does, so
# the time an answer takes doesn't tell who has an account (verify_password).
_NO_PASSWORD_HASH = _password_hasher.hash(secrets.token_urlsafe(32))

# -- per-request memory -------------------------------------------------------
#
# A request's database session (get_session) lives as long as the request.
# What a request's guards and endpoint read about the caller several times
# -- their exercise grant, their memberships -- is read once and kept in
# the session's `info`, forgotten as soon as the session writes anything.
# With hundreds of Players, every change of a session is that many requests
# (docs/deployment.md, section 10).

_MEMO = "request_memo"


def request_memo(session: Session) -> dict:
    """This request's memory (forgotten when the session writes)."""
    return session.info.setdefault(_MEMO, {})


@event.listens_for(OrmSession, "after_flush")
def _forget_on_write(session: OrmSession, flush_context: object) -> None:
    session.info.pop(_MEMO, None)


def ttx_access_of(session: Session, user_id: uuid.UUID, ttx_id: uuid.UUID) -> TTXAccess | None:
    """`user_id`'s grant on `ttx_id`, read once per request. For reading
    who someone is on an exercise; code that changes grants reads them
    itself."""
    key = ("ttx_access", user_id, ttx_id)
    memo = request_memo(session)
    if key not in memo:
        memo[key] = session.exec(
            select(TTXAccess).where(TTXAccess.user_id == user_id, TTXAccess.ttx_id == ttx_id)
        ).first()
    return memo[key]


def _memberships(
    session: Session, user_id: uuid.UUID, organization_id: uuid.UUID
) -> list[OrganizationMembership]:
    """Every membership row of `user_id` in `organization_id`, read once
    per request (Program Manager? disabled?)."""
    key = ("memberships", user_id, organization_id)
    memo = request_memo(session)
    if key not in memo:
        memo[key] = list(
            session.exec(
                select(OrganizationMembership).where(
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.organization_id == organization_id,
                )
            ).all()
        )
    return memo[key]


def hash_password(plain_password: str) -> str:
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """False for no account or one without a password (single sign-on
    only), after the same work as a wrong password."""
    try:
        matched = _password_hasher.verify(hashed_password or _NO_PASSWORD_HASH, plain_password)
    except VerifyMismatchError:
        return False
    return matched and hashed_password is not None


def client_address(request: Request) -> str | None:
    """The caller's address: behind a proxy, what uvicorn took from
    X-Forwarded-For (FORWARDED_ALLOW_IPS, docs/deployment.md section 4)."""
    return request.client.host if request.client else None


MFA_PENDING_TOKEN_EXPIRE_MINUTES = 5


def create_access_token(user_session: UserSession) -> str:
    """The session cookie's value: who (`sub`) and which server-side session
    (`sid`). It expires with the hard timeout; the soft timeout and any
    revocation are checked against the UserSession row on every request."""
    payload = {
        "sub": str(user_session.user_id),
        "sid": str(user_session.id),
        "type": "access",
        "iat": datetime.now(UTC),
        "exp": user_session.absolute_expires_at,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_mfa_pending_token(user_id: uuid.UUID, jti: str) -> str:
    """Short-lived, single-purpose token issued after password verification
    when the user has TOTP enabled. Distinct `type` from the real access
    token so it's rejected by get_current_user/RequiresOrgAndTTXAccess --
    it cannot be used to call any authenticated endpoint, only to complete
    POST /auth/login/verify-totp. `jti` must
    match User.mfa_pending_jti: only the latest challenge can be answered,
    and too many wrong codes withdraw it (totp_service).
    """
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "type": "mfa_pending",
        "iat": now,
        "exp": now + timedelta(minutes=MFA_PENDING_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AppException(
            "TOKEN_EXPIRED", "Session expired, please log in again.", 401, log_level=logging.WARNING
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise AppException(
            "TOKEN_INVALID", "Invalid authentication token.", 401, log_level=logging.WARNING
        ) from exc

    if payload.get("type") != expected_type:
        raise AppException(
            "TOKEN_INVALID", "Invalid authentication token.", 401, log_level=logging.WARNING
        )
    return payload


def _decode_access_token(token: str) -> dict:
    return _decode_token(token, "access")


def decode_mfa_pending_token(token: str) -> tuple[uuid.UUID, str | None]:
    payload = _decode_token(token, "mfa_pending")
    return uuid.UUID(payload["sub"]), payload.get("jti")


def get_current_user_optional(
    request: Request, session: Session = Depends(get_session)
) -> User | None:
    """Like get_current_user, but returns None instead of raising when
    there's no valid session -- for routes that must accept genuinely
    anonymous requests alongside authenticated ones (e.g. invitation-token
    redemption by a brand-new self-enroller).

    A valid session is a valid token *and* a live UserSession: not revoked,
    not idle past its soft timeout, not past its hard timeout. Every
    request the user makes counts as activity, except the ones the client
    marks as background (BACKGROUND_REQUEST_HEADER).
    """
    token = request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        return None

    try:
        payload = _decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
        session_id = uuid.UUID(payload["sid"])
    except (AppException, KeyError, ValueError):
        return None

    user_session = session.get(UserSession, session_id)
    if (
        user_session is None
        or user_session.user_id != user_id
        or not session_service.is_active(user_session)
        # Opened on the other face (app.core.surface): sign in again here.
        or user_session.surface != surface.current()
    ):
        return None
    background = request.headers.get(
        session_service.BACKGROUND_REQUEST_HEADER
    ) == "1" or request.url.path.endswith(session_service.BACKGROUND_PATH_SUFFIX)
    if not background:
        session_service.touch(session, user_session)

    user = session.get(User, user_id)
    if user is None or not user.is_active or user.suspended_at is not None:
        return None
    request.state.user_session = user_session
    # Carried with this request's User row for the mandatory-TOTP checks
    # (mfa_satisfied), which run deep in services with only the user.
    inspect(user).info["mfa_source"] = user_session.mfa_source
    return user


# What an account with legal documents to accept may still reach: its own
# account (/auth/...: who it is, sign out, security, deleting it), the
# documents themselves, and -- for the operator -- managing them, so
# publishing one doesn't lock Platform before the other is out. Everything
# else waits for the acceptance.
_LEGAL_PENDING_ALLOWED = (
    f"{settings.API_V1_PREFIX}/auth/",
    f"{settings.API_V1_PREFIX}/legal",
    f"{settings.API_V1_PREFIX}/instance/legal",
)


def get_current_user(
    request: Request,
    user: User | None = Depends(get_current_user_optional),
    session: Session = Depends(get_session),
) -> User:
    if user is None:
        raise AppException(
            "NOT_AUTHENTICATED", "Authentication required.", 401, log_level=logging.WARNING
        )
    enforce_account_gates(session, user, request.url.path)
    return user


def enforce_account_gates(session: Session, user: User, path: str) -> None:
    """What an authenticated account must settle before using `path`: a
    temporary or expired password, an unconfirmed or overdue email
    address, legal documents to accept. Shared by the cookie session
    (get_current_user) and the assistant's personal access tokens, so a
    token never reaches what the account itself couldn't."""
    auth_prefix = f"{settings.API_V1_PREFIX}/auth/"
    # A temporary password (reset from Platform), or one past the
    # deployment's maximum age, reaches only the account's own /auth/...
    # routes -- signing out, and choosing its own password.
    if not path.startswith(auth_prefix) and (
        user.password_change_required or _password_expired(session, user)
    ):
        raise AppException(
            "PASSWORD_CHANGE_REQUIRED",
            "Choose a new password to continue.",
            403,
            log_level=logging.WARNING,
        )
    # Signed up while the deployment sends email: the address is confirmed
    # (a link sent to it, account_email_service) before anything but the
    # account itself.
    if (
        user.email_verification_required
        and user.email_verified_at is None
        and not path.startswith(auth_prefix)
    ):
        from app.services import account_email_service

        if account_email_service.verification_pending(session, user):
            raise AppException(
                "EMAIL_VERIFICATION_REQUIRED",
                "Confirm your email address to continue.",
                403,
                log_level=logging.WARNING,
            )
    # Asked to confirm the address again and past the grace period.
    if user.email_reconfirm_deadline is not None and not path.startswith(auth_prefix):
        from app.services import account_email_service

        if account_email_service.reconfirmation_overdue(session, user):
            raise AppException(
                "EMAIL_RECONFIRMATION_REQUIRED",
                "Confirm your email address again to continue.",
                403,
                log_level=logging.WARNING,
            )
    if not path.startswith(_LEGAL_PENDING_ALLOWED) and (
        legal_service.pending_acceptances(session, user)
    ):
        raise AppException(
            "LEGAL_ACCEPTANCE_REQUIRED",
            "Accept the terms of service and the privacy policy to continue.",
            403,
            log_level=logging.WARNING,
        )


def get_current_user_session(
    request: Request, user: User = Depends(get_current_user)
) -> UserSession:
    """The UserSession behind the current request's cookie."""
    return request.state.user_session


def require_recent_authentication(
    user_session: UserSession = Depends(get_current_user_session),
) -> None:
    """Step-up guard for sensitive or irreversible actions: the user must
    have proved who they are on this session in the last STEP_UP_MINUTES
    (signing in counts; otherwise POST /auth/step-up with a TOTP code, or
    the password for an account without TOTP, or a trip to the single
    sign-on provider, POST /auth/oidc/step-up)."""
    if not session_service.is_recently_authenticated(user_session):
        raise AppException(
            "REAUTHENTICATION_REQUIRED",
            "Confirm it's you to continue.",
            403,
            log_level=logging.WARNING,
        )


RequireRecentAuthentication = Depends(require_recent_authentication)


def start_session(
    request: Request,
    response: Response,
    session: Session,
    user: User,
    *,
    mfa_source: str | None = None,
) -> None:
    """Sign `user` in on this browser: a new UserSession plus its cookies.
    Every way a session is issued (login, second factor, single sign-on,
    signup, registration, token redemption with a new account) goes through
    here. `mfa_source` "provider": the single sign-on provider asked for a
    second factor, which counts as the account's own on this session."""
    user_session = session_service.create_session(
        session,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=client_address(request),
        mfa_source=mfa_source,
    )
    set_auth_cookies(response, create_access_token(user_session), user_session)
    from app.core.i18n import get_locale
    from app.services import account_email_service

    # An address confirmed too long ago is asked to confirm again (the
    # periodic reconfirmation; nothing when it's off).
    account_email_service.ask_reconfirmation(
        session, user, get_locale(request.headers.get("accept-language"))
    )


def verify_csrf(request: Request) -> None:
    # No session cookie at all: the session expired (the browser drops the
    # CSRF cookie with it), not a forged request. Answer like any route
    # needing a session, so the client sends the user to sign in again
    # instead of failing silently on a 403.
    if not request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME):
        raise AppException(
            "NOT_AUTHENTICATED", "Authentication required.", 401, log_level=logging.WARNING
        )
    cookie_token = request.cookies.get(settings.CSRF_COOKIE_NAME)
    header_token = request.headers.get(settings.CSRF_HEADER_NAME)
    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(status_code=403, detail="CSRF token missing or invalid.")


def set_auth_cookies(response: Response, access_token: str, user_session: UserSession) -> str:
    csrf_token = secrets.token_urlsafe(32)
    secure = settings.ENVIRONMENT != "development"
    # Both cookies live until the hard timeout; the soft timeout is enforced
    # server-side (an idle session answers 401 while its cookie still exists).
    max_age = max(int((user_session.absolute_expires_at - datetime.now(UTC)).total_seconds()), 0)

    response.set_cookie(
        settings.ACCESS_TOKEN_COOKIE_NAME,
        access_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        settings.CSRF_COOKIE_NAME,
        csrf_token,
        max_age=max_age,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
    )
    return csrf_token


def clear_auth_cookies(response: Response) -> None:
    """Mirrors set_auth_cookies's exact attributes -- a delete_cookie call
    with mismatched path/secure/samesite silently fails to clear the
    cookie in some browsers, since it's treated as a different cookie.
    """
    secure = settings.ENVIRONMENT != "development"

    response.delete_cookie(
        settings.ACCESS_TOKEN_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite="lax",
    )
    response.delete_cookie(
        settings.CSRF_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite="lax",
    )


def is_program_manager(session: Session, user: User, organization_id: uuid.UUID) -> bool:
    """True iff `user` holds a Program Manager OrganizationMembership for
    `organization_id`. Shared by require_program_manager (raises) and
    RequiresOrgAndTTXAccess (a Program Manager reads every TTX in their org,
    not just ones they hold a TTXAccess grant on -- reads only).
    """
    return any(
        m.role == OrgRoleEnum.PROGRAM_MANAGER and m.disabled_at is None
        for m in _memberships(session, user.id, organization_id)
    )


def mfa_satisfied(user: User) -> bool:
    """The account has its own TOTP, or this request's session was opened
    through a single sign-on provider that asked for a second factor
    (UserSession.mfa_source, carried on the User row by
    get_current_user_optional). A User loaded any other way only counts
    its own TOTP."""
    return user.totp_enabled or inspect(user).info.get("mfa_source") == "provider"


def _password_expired(session: Session, user: User) -> bool:
    from app.services.security_policy_service import password_expired

    return password_expired(session, user)


def _require_mfa_for(session: Session, user: User, roles: set[str]) -> None:
    """The second-factor mandate for the roles this action is taken in:
    which roles have one is the deployment's choice (Platform -> Sign-in security,
    security_policy_service; by default every role but Player). One whole
    message per role."""
    from app.services.security_policy_service import effective_mfa_policy

    policy = effective_mfa_policy(session)
    required = {role for role in roles if policy.requires(role)}  # type: ignore[arg-type]
    if "program_manager" in required:
        _require_mfa_enrolled(user, "TOTP enrollment is required for Program Manager accounts.")
    elif "planner" in required:
        _require_mfa_enrolled(user, "TOTP enrollment is required for Planner accounts.")
    elif "evaluator" in required:
        _require_mfa_enrolled(user, "TOTP enrollment is required for Evaluator accounts.")
    elif "observer" in required:
        _require_mfa_enrolled(user, "TOTP enrollment is required for Observer accounts.")
    elif "player" in required:
        _require_mfa_enrolled(user, "TOTP enrollment is required for Player accounts.")


def _require_mfa_enrolled(user: User, message: str) -> None:
    """Shared TOTP-mandate check: raises unless the account has a second
    factor that meets the mandate (mfa_satisfied)."""
    if not mfa_satisfied(user):
        raise AppException(
            "MFA_REQUIRED",
            message,
            403,
            log_level=logging.WARNING,
        )


def require_program_manager(session: Session, user: User, organization_id: uuid.UUID) -> None:
    """Raise 403 unless `user` holds a Program Manager OrganizationMembership
    for `organization_id`. Shared by every Admin route
    (require_program_manager_of, org from the URL) and any service that
    resolves the org another way (e.g. exercise deletion, from the TTX).

    The second-factor mandate (on by default for Program Manager) is
    checked here for every Program Manager-guarded action, so a membership
    match alone isn't enough without one.
    """
    if not is_program_manager(session, user, organization_id):
        raise HTTPException(
            status_code=403, detail="Program Manager access required for this organization."
        )
    _require_mfa_for(session, user, {"program_manager"})


def is_planner(session: Session, user: User, organization_id: uuid.UUID) -> bool:
    """True iff `user` holds a Planner OrganizationMembership for
    `organization_id`. Planner is org-scoped (like Program Manager, unlike
    TTXAccess) specifically so a brand-new Planner can create their
    first TTX without a ttx_id already existing to derive access from.
    """
    membership = session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
            active_membership(),
        )
    ).first()
    return membership is not None


def require_planner(session: Session, user: User, organization_id: uuid.UUID) -> None:
    """Raise 403 unless `user` holds a Planner OrganizationMembership for
    `organization_id`. Mirrors require_program_manager, including the
    mandatory-TOTP enforcement.

    A user can be Planner (and Program Manager) of several orgs at once --
    each org's Program Managers grant it independently. So there is no
    "resolve the org automatically" variant of this for actions with no
    existing ttx_id (e.g. TTX creation): the caller must say which org
    explicitly (`TTXCreateRequest.organization_id`), and this just
    validates that specific org rather than guessing.
    """
    if not is_planner(session, user, organization_id):
        raise HTTPException(
            status_code=403, detail="Planner access required for this organization."
        )
    _require_mfa_for(session, user, {"planner"})


def require_instance_admin(user: User = Depends(get_current_user)) -> User:
    """Guard for Platform (/instance/... administration): the deployment's
    operator, above any organization. TOTP mandatory, like Program
    Manager."""
    if not user.is_instance_admin:
        raise AppException(
            "INSTANCE_ADMIN_REQUIRED",
            "Instance administrator access required.",
            403,
            log_level=logging.WARNING,
        )
    _require_mfa_enrolled(user, "TOTP enrollment is required for instance administrator accounts.")
    return user


_READ_METHODS = frozenset({"GET", "HEAD"})


class RequiresOrgAndTTXAccess:
    """FastAPI dependency: caller must hold a TTXAccess grant for the
    route's `ttx_id` with one of the given roles -- or, on a read (GET/HEAD)
    only, be a Program Manager of the Organization owning it. The Program
    Manager oversees every exercise of their org (mirrors the visibility
    rule in ttx_service.list_ttx_for_user) but doesn't design or run one
    unless they are on its team like anyone else.

    Resolves fresh from the DB on every call
    rather than trusting any embedded JWT claim -- access granted/revoked
    via TTXAccess or InvitationToken redemption takes effect immediately,
    with no stale-claim window until token expiry.

    Roles aren't a hierarchy (Planner/Player are distinct
    capability sets per the architecture, not nested tiers) -- pass every
    role a given route should accept, e.g.
    RequiresOrgAndTTXAccess(RoleEnum.PLANNER, RoleEnum.PLAYER). Roles are
    matched against TTXAccess.context_roles(), so a planning and control
    team member passes PLANNER only while they plan, and
    TTXContextRole.CONTROLLER / FACILITATOR select by the other flags.

    The second-factor mandate applies on both branches (_require_mfa_for):
    the Program Manager read branch and every TTXAccess row, for the roles
    it acts in (security_policy_service.access_mfa_roles).
    """

    def __init__(
        self, *allowed_roles: RoleEnum | TTXContextRole, allow_archived: bool = False
    ) -> None:
        if not allowed_roles:
            raise ValueError("RequiresOrgAndTTXAccess requires at least one allowed role.")
        self.allowed_roles = allowed_roles
        # A write that still makes sense on an archived exercise (following
        # up its improvement plan, duplicating it); reads always pass.
        self.allow_archived = allow_archived

    def __call__(
        self,
        request: Request,
        user: User = Depends(get_current_user),
        session: Session = Depends(get_session),
    ) -> TTX:
        return authorize_ttx(
            session,
            user,
            request.path_params.get("ttx_id"),
            self.allowed_roles,
            read=request.method in _READ_METHODS,
            allow_archived=self.allow_archived,
        )


def authorize_ttx(
    session: Session,
    user: User,
    ttx_id: object,
    allowed_roles: tuple[RoleEnum | TTXContextRole, ...],
    *,
    read: bool,
    allow_archived: bool = False,
) -> TTX:
    """RequiresOrgAndTTXAccess's whole check, for callers outside a route
    (the assistant's tools): the exercise exists (404 otherwise, also for a
    malformed id), the user holds one of `allowed_roles` on it -- or, when
    `read`, is a Program Manager of its organization -- and, unless
    `read` or `allow_archived`, it isn't archived."""
    try:
        parsed_id = ttx_id if isinstance(ttx_id, uuid.UUID) else uuid.UUID(str(ttx_id))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=404, detail="TTX not found.") from exc

    ttx = session.get(TTX, parsed_id)
    if ttx is None:
        raise HTTPException(status_code=404, detail="TTX not found.")

    require_ttx_role(session, user, ttx, allowed_roles, program_manager_may_read=read)
    if not read and not allow_archived:
        require_not_archived(ttx)
    return ttx


def require_not_archived(ttx: TTX) -> None:
    """An archived exercise is read-only: every write behind
    RequiresOrgAndTTXAccess is refused (409 TTX_ARCHIVED) unless the route
    allows it; entry points keyed by something else (an invitation, a
    leave request) call this themselves."""
    if ttx.archived_at is not None:
        raise AppException(
            "TTX_ARCHIVED",
            "This exercise is archived: unarchive it to change it.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )


def is_disabled_in_organization(session: Session, user: User, organization_id: uuid.UUID) -> bool:
    """Removed from the organization while still on its exercises (see
    organization_service.delete_member): no exercise of it opens."""
    return any(m.disabled_at is not None for m in _memberships(session, user.id, organization_id))


def require_ttx_role(
    session: Session,
    user: User,
    ttx: TTX,
    allowed_roles: tuple[RoleEnum | TTXContextRole, ...],
    *,
    program_manager_may_read: bool = False,
) -> None:
    """Core check behind RequiresOrgAndTTXAccess, factored out so callers
    that already have the `ttx` row (not a `ttx_id` route param -- e.g.
    invitation token revocation, keyed by token_id) can reuse the exact
    same TTXAccess-role logic and mandatory-TOTP enforcement without going
    through a FastAPI dependency. `program_manager_may_read` lets a
    Program Manager of the owning org through without a grant -- reads
    only; those callers are writes, so they leave it off.
    """
    if program_manager_may_read and is_program_manager(session, user, ttx.organization_id):
        _require_mfa_for(session, user, {"program_manager"})
        return

    access = ttx_access_of(session, user.id, ttx.id)
    if access is not None and is_disabled_in_organization(session, user, ttx.organization_id):
        raise AppException(
            "MEMBER_DISABLED",
            "Your access to this organization is disabled.",
            403,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    if access is None or not access.context_roles() & {role.value for role in allowed_roles}:
        raise AppException(
            "TTX_ACCESS_DENIED",
            "You do not have the required role for this TTX.",
            403,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    from app.services.security_policy_service import access_mfa_roles

    _require_mfa_for(session, user, access_mfa_roles(access))


def public_surface_guard(
    request: Request,
    user: User | None = Depends(get_current_user_optional),
    session: Session = Depends(get_session),
) -> None:
    """Every route of the public face (app.core.surface): on an exercise,
    the caller must take part as a Player, and act as one (`as`, if given,
    must be "player"). Signed-out callers pass here and meet the route's
    own authentication. The caller comes from the same dependency the
    route's own authentication uses, so a request reads it once."""
    requested = request.query_params.get("as")
    if requested is not None and requested != TTXContextRole.PLAYER.value:
        raise AppException(
            "NOT_ACTING_AS",
            "You don't take part in this session as that role.",
            403,
            log_level=logging.WARNING,
        )
    try:
        ttx_id = uuid.UUID(str(request.path_params["ttx_id"]))
    except (KeyError, ValueError):
        return  # no exercise in the path, or one the route answers 404 for
    if user is None:
        return
    access = ttx_access_of(session, user.id, ttx_id)
    if access is None or TTXContextRole.PLAYER.value not in access.context_roles():
        raise AppException(
            "TTX_ACCESS_DENIED",
            "You do not have the required role for this TTX.",
            403,
            ttx_id=str(ttx_id),
            log_level=logging.WARNING,
        )
