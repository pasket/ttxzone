"""Single sign-on through an OpenID Connect provider (docs/architecture/sso.md).

Where the configuration comes from: the environment (Settings.OIDC_PROVIDER
and the OIDC_* values) pins it; otherwise an instance administrator sets it
in Platform -> Single sign-on (OidcSettings, the client secret encrypted);
with neither, there is no single sign-on and the sign-in page shows no
button. Microsoft Entra ID is one tenant, by its id; any other provider is
named by its issuer URL.

The flow is the authorization code flow with PKCE, run by the server: it
sends the browser to the provider with a single-use `state` (an
OidcLoginState row, bound to that browser by a cookie) and a `nonce`, takes
the code back at the callback, exchanges it with the client secret, and
checks the ID token's signature (the provider's published keys), issuer,
audience, expiry and nonce before believing a word of it. Accounts are
matched on the provider's immutable id for the person (ExternalIdentity),
never on the email, which only serves -- when the provider vouches for it
-- to create a new account or to refuse to take over an existing one.
"""

import base64
import hashlib
import json
import logging
import re
import secrets
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from urllib.parse import quote, urlencode, urlsplit

import jwt
from sqlalchemy import delete
from sqlmodel import Session, select

from app.core import crypto
from app.core.config import settings
from app.core.exceptions import AppException
from app.models import (
    OIDC_SETTINGS_ID,
    ExternalIdentity,
    OidcLoginState,
    OidcSettings,
    User,
    UserSession,
)
from app.services import platform_audit_service

logger = logging.getLogger(__name__)

ProviderKind = Literal["entra", "generic"]
Purpose = Literal["login", "step_up", "link"]

# The one provider phase 1 knows: Platform's (or the environment's).
INSTANCE_PROVIDER_KEY = "instance"
ENTRA_AUTHORITY = "https://login.microsoftonline.com"
CALLBACK_PATH = f"{settings.API_V1_PREFIX}/auth/oidc/callback"
# The cookie that binds a trip to the provider to the browser that started it.
BINDING_COOKIE_NAME = "ttx_oidc_binding"
BINDING_COOKIE_PATH = f"{settings.API_V1_PREFIX}/auth/oidc/"
# How long someone has to come back from the provider.
STATE_TTL = timedelta(minutes=10)
# The provider's metadata and keys are fetched again after this long.
DISCOVERY_TTL = timedelta(hours=1)
HTTP_TIMEOUT_SECONDS = 10
# Tolerated clock difference with the provider on exp/iat/auth_time.
CLOCK_LEEWAY_SECONDS = 120
# A step-up through the provider must come from a sign-in this recent.
STEP_UP_MAX_AGE = timedelta(minutes=5)
# The only signature algorithms an ID token may use (asymmetric: the
# client secret never signs anything the server then trusts).
ALLOWED_ALGORITHMS = ["RS256", "RS384", "RS512", "PS256", "ES256"]
USER_AGENT = "TTX-Zone"

_GUID_RE = re.compile(r"^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$")


class OidcError(Exception):
    """A single sign-on that can't go on. `reason` is what the
    authentication log records and the sign-in page explains
    (SSO_<REASON> in the redirect)."""

    def __init__(self, reason: str, detail: str | None = None, *, user: User | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail
        # The account concerned, when known (for the authentication log).
        self.user = user


@dataclass(frozen=True)
class OidcConfig:
    provider_kind: ProviderKind
    display_name: str
    issuer: str
    client_id: str
    client_secret: str
    entra_tenant_id: str | None
    allow_jit: bool
    trust_provider_mfa: bool
    # Set from the deployment's environment: the web can't change it.
    pinned_by_env: bool


# --- Configuration -------------------------------------------------------


def pinned_by_env() -> bool:
    return settings.OIDC_PROVIDER is not None


def get_settings_row(session: Session) -> OidcSettings | None:
    return session.get(OidcSettings, OIDC_SETTINGS_ID)


def issuer_for(kind: str, entra_tenant_id: str | None, issuer_url: str | None) -> str:
    if kind == "entra":
        return f"{ENTRA_AUTHORITY}/{(entra_tenant_id or '').lower()}/v2.0"
    return (issuer_url or "").rstrip("/")


def default_display_name(kind: str) -> str:
    return "Microsoft" if kind == "entra" else "SSO"


def redirect_uri() -> str | None:
    """The callback the provider must know, exactly; None without
    PUBLIC_BASE_URL (no single sign-on then)."""
    if not settings.PUBLIC_BASE_URL:
        return None
    return f"{settings.PUBLIC_BASE_URL}{CALLBACK_PATH}"


def _env_config() -> OidcConfig:
    kind: ProviderKind = settings.OIDC_PROVIDER or "generic"
    return OidcConfig(
        provider_kind=kind,
        display_name=settings.OIDC_DISPLAY_NAME or default_display_name(kind),
        issuer=issuer_for(kind, settings.OIDC_ENTRA_TENANT_ID, settings.OIDC_ISSUER_URL),
        client_id=settings.OIDC_CLIENT_ID or "",
        client_secret=(
            settings.OIDC_CLIENT_SECRET.get_secret_value() if settings.OIDC_CLIENT_SECRET else ""
        ),
        entra_tenant_id=(settings.OIDC_ENTRA_TENANT_ID or "").lower() or None,
        allow_jit=settings.OIDC_ALLOW_JIT,
        trust_provider_mfa=settings.OIDC_TRUST_PROVIDER_MFA,
        pinned_by_env=True,
    )


def stored_secret_readable(row: OidcSettings) -> bool:
    if row.client_secret_encrypted is None:
        return True
    try:
        crypto.decrypt_secret(row.client_secret_encrypted)
    except crypto.SecretUnreadableError:
        return False
    return True


def _row_config(row: OidcSettings) -> OidcConfig | None:
    if row.client_secret_encrypted is None:
        return None
    try:
        secret = crypto.decrypt_secret(row.client_secret_encrypted)
    except crypto.SecretUnreadableError:
        logger.error(
            "Single sign-on: the stored client secret can't be decrypted (DATA_ENCRYPTION_KEY "
            "changed?); single sign-on is off until it's entered again in Platform."
        )
        return None
    return OidcConfig(
        provider_kind=row.provider_kind,  # type: ignore[arg-type]
        display_name=row.display_name,
        issuer=issuer_for(row.provider_kind, row.entra_tenant_id, row.issuer_url),
        client_id=row.client_id,
        client_secret=secret,
        entra_tenant_id=row.entra_tenant_id,
        allow_jit=row.allow_jit,
        trust_provider_mfa=row.trust_provider_mfa,
        pinned_by_env=False,
    )


def effective_config(session: Session) -> OidcConfig | None:
    """None: no single sign-on (nothing set, turned off, no public URL, no
    client secret, or one no key decrypts)."""
    if redirect_uri() is None:
        return None
    if pinned_by_env():
        return _env_config()
    row = get_settings_row(session)
    if row is None or not row.enabled:
        return None
    return _row_config(row)


def configured_config(session: Session) -> OidcConfig | None:
    """The configuration whether or not it's turned on -- for Platform's test."""
    if pinned_by_env():
        return _env_config()
    row = get_settings_row(session)
    return _row_config(row) if row is not None else None


def _invalid(code: str, message: str) -> AppException:
    return AppException(code, message, 422, log_level=logging.WARNING)


def _require_web_editable() -> None:
    if pinned_by_env():
        raise AppException(
            "SSO_PINNED_BY_ENV",
            "Single sign-on is set in the server's configuration and can't be changed here.",
            409,
            log_level=logging.WARNING,
        )
    if not settings.PUBLIC_BASE_URL:
        raise AppException(
            "SSO_PUBLIC_URL_MISSING",
            "Set PUBLIC_BASE_URL on the server before configuring single sign-on.",
            409,
            log_level=logging.WARNING,
        )


def _check_url(url: str) -> None:
    """https (http only with OIDC_ALLOW_INSECURE), a host, no credentials,
    query or fragment."""
    parts = urlsplit(url)
    schemes = {"https", "http"} if settings.OIDC_ALLOW_INSECURE else {"https"}
    if (
        parts.scheme not in schemes
        or not parts.hostname
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
    ):
        raise OidcError("provider_error", f"Unacceptable URL from the provider: {url[:200]}")


def validate_issuer_url(issuer_url: str) -> str:
    issuer_url = issuer_url.strip().rstrip("/")
    try:
        _check_url(issuer_url)
    except OidcError as exc:
        raise _invalid(
            "SSO_ISSUER_URL_INVALID",
            "Enter the provider's issuer URL, starting with https://.",
        ) from exc
    return issuer_url


def validate_tenant_id(tenant_id: str) -> str:
    """One Entra tenant, by its id: "common" or "organizations" would let
    any Microsoft account in the world through."""
    tenant_id = tenant_id.strip().lower()
    if not _GUID_RE.match(tenant_id):
        raise _invalid(
            "SSO_TENANT_ID_INVALID",
            "Enter the directory (tenant) ID, a GUID like 00000000-0000-0000-0000-000000000000.",
        )
    return tenant_id


def save_settings(
    session: Session,
    actor: User,
    *,
    enabled: bool,
    provider_kind: ProviderKind,
    display_name: str | None,
    entra_tenant_id: str | None,
    issuer_url: str | None,
    client_id: str,
    client_secret: str | None,
    allow_jit: bool,
    trust_provider_mfa: bool,
) -> OidcSettings:
    """Creates or updates the web configuration. `client_secret` None keeps
    the stored one, anything else replaces it (encrypted) -- a provider
    always needs one, so it can't be removed, only replaced. Recorded in
    the activity log without the secret."""
    _require_web_editable()
    if provider_kind == "entra":
        entra_tenant_id = validate_tenant_id(entra_tenant_id or "")
        issuer_url = None
    else:
        issuer_url = validate_issuer_url(issuer_url or "")
        entra_tenant_id = None
    client_id = client_id.strip()
    if not client_id:
        raise _invalid("SSO_CLIENT_ID_REQUIRED", "Enter the application (client) ID.")
    display_name = (display_name or "").strip() or default_display_name(provider_kind)

    row = get_settings_row(session)
    created = row is None
    if row is None:
        if not client_secret:
            raise _invalid("SSO_CLIENT_SECRET_REQUIRED", "Enter the client secret.")
        row = OidcSettings(display_name=display_name, client_id=client_id)
    before = _audit_view(row) if not created else None
    row.enabled = enabled
    row.provider_kind = provider_kind
    row.display_name = display_name
    row.entra_tenant_id = entra_tenant_id
    row.issuer_url = issuer_url
    row.client_id = client_id
    row.allow_jit = allow_jit
    row.trust_provider_mfa = trust_provider_mfa
    secret_changed = bool(client_secret)
    if client_secret:
        row.client_secret_encrypted = crypto.encrypt_secret(client_secret)
    row.updated_at = datetime.now(UTC)
    row.updated_by_user_id = actor.id
    session.add(row)
    session.commit()
    platform_audit_service.record(
        session,
        actor,
        "sso.settings_update",
        "instance",
        details={
            "created": created,
            "before": before,
            "after": _audit_view(row),
            "secret_changed": secret_changed,
        },
    )
    return row


def _audit_view(row: OidcSettings) -> dict[str, Any]:
    """What the activity log keeps of a configuration: never the secret."""
    return {
        "enabled": row.enabled,
        "provider_kind": row.provider_kind,
        "display_name": row.display_name,
        "entra_tenant_id": row.entra_tenant_id,
        "issuer_url": row.issuer_url,
        "client_id": row.client_id,
        "allow_jit": row.allow_jit,
        "trust_provider_mfa": row.trust_provider_mfa,
        "has_client_secret": row.client_secret_encrypted is not None,
    }


def delete_settings(session: Session, actor: User) -> None:
    """Single sign-on stops; linked accounts keep their links, which work
    again if the same provider is set up again."""
    _require_web_editable()
    row = get_settings_row(session)
    if row is None:
        raise AppException(
            "SSO_NOT_CONFIGURED",
            "Single sign-on isn't set up.",
            404,
            log_level=logging.WARNING,
        )
    before = _audit_view(row)
    session.delete(row)
    session.commit()
    platform_audit_service.record(
        session, actor, "sso.settings_delete", "instance", details={"before": before}
    )


# --- Talking to the provider ----------------------------------------------


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """The provider answers itself: a redirect could take the client
    secret anywhere."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def _read_json(request: urllib.request.Request) -> dict[str, Any]:
    _check_url(request.full_url)
    try:
        # The scheme was just checked: http(s) only, never file:// or the like.
        with _opener.open(request, timeout=HTTP_TIMEOUT_SECONDS) as response:  # nosec B310
            body = response.read(1_000_000)
    except urllib.error.HTTPError as exc:
        body = exc.read(1_000_000)
        try:
            error = json.loads(body).get("error", "")
        except (ValueError, AttributeError):
            error = ""
        raise OidcError("provider_error", f"HTTP {exc.code} {str(error)[:64]}".strip()) from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise OidcError("provider_unreachable", str(exc)[:200]) from exc
    try:
        data = json.loads(body)
    except ValueError as exc:
        raise OidcError("provider_error", "The provider didn't answer JSON.") from exc
    if not isinstance(data, dict):
        raise OidcError("provider_error", "The provider didn't answer a JSON object.")
    return data


def _http_get_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url, headers={"Accept": "application/json", "User-Agent": USER_AGENT}
    )
    return _read_json(request)


def _http_post_form(url: str, form: dict[str, str], headers: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=urlencode(form).encode(),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
            **headers,
        },
        method="POST",
    )
    return _read_json(request)


_discovery_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_jwk_clients: dict[str, jwt.PyJWKClient] = {}


def discover(config: OidcConfig) -> dict[str, Any]:
    """The provider's metadata (/.well-known/openid-configuration), checked
    and kept for DISCOVERY_TTL."""
    cached = _discovery_cache.get(config.issuer)
    if cached is not None and time.monotonic() - cached[0] < DISCOVERY_TTL.total_seconds():
        return cached[1]
    metadata = _http_get_json(f"{config.issuer}/.well-known/openid-configuration")
    if metadata.get("issuer") != config.issuer:
        raise OidcError(
            "provider_error",
            f"The provider names itself {str(metadata.get('issuer'))[:200]}, not {config.issuer}.",
        )
    for key in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
        value = metadata.get(key)
        if not isinstance(value, str):
            raise OidcError("provider_error", f"The provider's metadata has no {key}.")
        _check_url(value)
    _discovery_cache[config.issuer] = (time.monotonic(), metadata)
    return metadata


def _signing_key(jwks_uri: str, id_token: str) -> Any:
    """The provider's published key that signed `id_token`."""
    _check_url(jwks_uri)
    client = _jwk_clients.get(jwks_uri)
    if client is None:
        client = jwt.PyJWKClient(
            jwks_uri,
            cache_keys=True,
            lifespan=int(DISCOVERY_TTL.total_seconds()),
            timeout=HTTP_TIMEOUT_SECONDS,
            headers={"User-Agent": USER_AGENT},
        )
        _jwk_clients[jwks_uri] = client
    try:
        return client.get_signing_key_from_jwt(id_token).key
    except jwt.PyJWKClientConnectionError as exc:
        raise OidcError("provider_unreachable", str(exc)[:200]) from exc
    except jwt.PyJWKClientError as exc:
        raise OidcError("token_invalid", str(exc)[:200]) from exc


def check_provider(config: OidcConfig) -> None:
    """Platform's test: the metadata and the signing keys can be fetched.
    Raises OidcError."""
    _discovery_cache.pop(config.issuer, None)
    metadata = discover(config)
    keys = _http_get_json(metadata["jwks_uri"])
    if not isinstance(keys.get("keys"), list) or not keys["keys"]:
        raise OidcError("provider_error", "The provider publishes no signing keys.")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def safe_return_to(value: str | None) -> str:
    """A path of the application's own; anything else goes home (no open
    redirect: no scheme, no host, no //host, no backslash tricks)."""
    if (
        not value
        or not value.startswith("/")
        or value.startswith("//")
        or "\\" in value
        or any(ord(c) < 32 for c in value)
        or len(value) > 500
    ):
        return "/"
    return value


def begin(
    session: Session,
    config: OidcConfig,
    purpose: Purpose,
    *,
    return_to: str | None,
    user: User | None = None,
    user_session: UserSession | None = None,
) -> tuple[str, str]:
    """Starts a trip to the provider: returns the URL to send the browser
    to and the binding value for its cookie (BINDING_COOKIE_NAME)."""
    metadata = discover(config)
    now = datetime.now(UTC)
    # Trips never finished go when new ones start.
    session.exec(delete(OidcLoginState).where(OidcLoginState.expires_at < now))
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    binding = secrets.token_urlsafe(32)
    session.add(
        OidcLoginState(
            state=state,
            nonce=nonce,
            code_verifier=verifier,
            browser_binding_hash=_hash(binding),
            purpose=purpose,
            user_id=user.id if user is not None else None,
            session_id=user_session.id if user_session is not None else None,
            return_to=safe_return_to(return_to),
            created_at=now,
            expires_at=now + STATE_TTL,
        )
    )
    session.commit()
    params = {
        "response_type": "code",
        "client_id": config.client_id,
        "redirect_uri": redirect_uri() or "",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": _b64url(hashlib.sha256(verifier.encode()).digest()),
        "code_challenge_method": "S256",
        "response_mode": "query",
    }
    if purpose == "step_up":
        # Prove it again now, not a remembered sign-in at the provider.
        params["prompt"] = "login"
        params["max_age"] = "0"
    elif purpose == "link":
        params["prompt"] = "select_account"
    if user is not None and purpose != "link":
        params["login_hint"] = user.email
    separator = "&" if "?" in metadata["authorization_endpoint"] else "?"
    return f"{metadata['authorization_endpoint']}{separator}{urlencode(params)}", binding


def consume_state(session: Session, state: str | None, binding: str | None) -> OidcLoginState:
    """The trip `state` names, used up: it can't come back twice, from
    another browser or too late."""
    if not state or len(state) > 64:
        raise OidcError("state_invalid")
    row = session.get(OidcLoginState, state)
    if row is None:
        raise OidcError("state_invalid")
    session.delete(row)
    session.commit()
    if not binding or not secrets.compare_digest(row.browser_binding_hash, _hash(binding)):
        raise OidcError("state_invalid", "Another browser started this sign-in.")
    if row.expires_at < datetime.now(UTC):
        raise OidcError("state_expired")
    return row


def exchange_code(config: OidcConfig, login_state: OidcLoginState, code: str) -> dict[str, Any]:
    """The code for tokens at the provider, and the ID token's claims once
    every check passes."""
    if not code or len(code) > 4096:
        raise OidcError("token_invalid", "No authorization code.")
    metadata = discover(config)
    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri() or "",
        "code_verifier": login_state.code_verifier,
        "client_id": config.client_id,
    }
    headers: dict[str, str] = {}
    methods = metadata.get("token_endpoint_auth_methods_supported") or ["client_secret_basic"]
    if "client_secret_basic" in methods:
        credentials = f"{quote(config.client_id, safe='')}:{quote(config.client_secret, safe='')}"
        headers["Authorization"] = "Basic " + base64.b64encode(credentials.encode()).decode()
    else:
        form["client_secret"] = config.client_secret
    tokens = _http_post_form(metadata["token_endpoint"], form, headers)
    id_token = tokens.get("id_token")
    if not isinstance(id_token, str):
        raise OidcError("token_invalid", "The provider returned no ID token.")
    return validate_id_token(config, metadata, id_token, login_state.nonce)


def validate_id_token(
    config: OidcConfig, metadata: dict[str, Any], id_token: str, nonce: str
) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(id_token)
    except jwt.InvalidTokenError as exc:
        raise OidcError("token_invalid", "Malformed ID token.") from exc
    if header.get("alg") not in ALLOWED_ALGORITHMS:
        raise OidcError("token_invalid", f"Algorithm {str(header.get('alg'))[:16]} refused.")
    key = _signing_key(metadata["jwks_uri"], id_token)
    try:
        claims = jwt.decode(
            id_token,
            key,
            algorithms=ALLOWED_ALGORITHMS,
            audience=config.client_id,
            issuer=config.issuer,
            leeway=CLOCK_LEEWAY_SECONDS,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.InvalidTokenError as exc:
        raise OidcError("token_invalid", str(exc)[:200]) from exc
    if not isinstance(claims.get("nonce"), str) or not secrets.compare_digest(
        claims["nonce"], nonce
    ):
        raise OidcError("token_invalid", "Nonce mismatch.")
    if config.provider_kind == "entra":
        if str(claims.get("tid", "")).lower() != config.entra_tenant_id:
            raise OidcError("token_invalid", "Token from another tenant.")
        if not isinstance(claims.get("oid"), str):
            raise OidcError("token_invalid", "No object id (oid) in the token.")
    return claims


# --- Accounts --------------------------------------------------------------


def subject_of(config: OidcConfig, claims: dict[str, Any]) -> str:
    """The provider's immutable id for the person. For Entra `sub` differs
    per application; `oid` is the person in the tenant."""
    return str(claims["oid"] if config.provider_kind == "entra" else claims["sub"])


def verified_email(config: OidcConfig, claims: dict[str, Any]) -> str | None:
    """An email the provider vouches the person owns, or None.

    Entra's `email` claim is whatever the account's mail attribute says,
    which an administrator of any tenant can set: it counts only with the
    optional claim `xms_edov` (the domain's owner is verified). Otherwise a
    member of the one configured tenant is known by `preferred_username`
    (its UPN, whose domain the tenant has verified); a guest's (#EXT#) is
    not. Any other provider must say `email_verified`."""
    if config.provider_kind == "entra":
        email = claims.get("email")
        if isinstance(email, str) and claims.get("xms_edov") in (True, "true", "1", 1):
            return email.strip().lower()
        upn = claims.get("preferred_username")
        if isinstance(upn, str) and "@" in upn and "#ext#" not in upn.lower():
            return upn.strip().lower()
        return None
    email = claims.get("email")
    if isinstance(email, str) and claims.get("email_verified") in (True, "true"):
        return email.strip().lower()
    return None


def provider_did_mfa(config: OidcConfig, claims: dict[str, Any]) -> bool:
    """The provider asked for a second factor, and this deployment takes
    its word for it."""
    amr = claims.get("amr")
    return config.trust_provider_mfa and isinstance(amr, list) and "mfa" in amr


def find_identity(session: Session, config: OidcConfig, subject: str) -> ExternalIdentity | None:
    return session.exec(
        select(ExternalIdentity).where(
            ExternalIdentity.issuer == config.issuer, ExternalIdentity.subject == subject
        )
    ).first()


def identity_of(session: Session, user: User) -> ExternalIdentity | None:
    return session.exec(
        select(ExternalIdentity).where(
            ExternalIdentity.user_id == user.id,
            ExternalIdentity.provider_key == INSTANCE_PROVIDER_KEY,
        )
    ).first()


def _display_name(claims: dict[str, Any], email: str) -> str:
    name = claims.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()[:255]
    return email.split("@", 1)[0][:255]


def resolve_login(
    session: Session, config: OidcConfig, claims: dict[str, Any]
) -> tuple[User, bool]:
    """The account behind a sign-in, and whether it was just created.

    1. Linked before: that account.
    2. An account already has the email: never taken over silently -- its
       owner signs in with the password once and links it (link_required).
    3. New email, and the provider may create accounts: a new account with
       no role and no password (the Waiting Room).
    """
    subject = subject_of(config, claims)
    identity = find_identity(session, config, subject)
    if identity is not None:
        user = session.get(User, identity.user_id)
        if user is None or not user.is_active:
            raise OidcError("account_not_found")
        identity.last_login_at = datetime.now(UTC)
        session.add(identity)
        # The provider vouches for the address again: it counts as
        # confirmed now (the periodic reconfirmation needs nothing more).
        if verified_email(config, claims) == user.email:
            user.email_verified_at = identity.last_login_at
            user.email_reconfirm_deadline = None
            session.add(user)
        session.commit()
        return user, False

    email = verified_email(config, claims)
    if email is None:
        raise OidcError("email_unverified")
    if session.exec(select(User).where(User.email == email)).first() is not None:
        raise OidcError("link_required")
    if not config.allow_jit:
        raise OidcError("account_not_found")

    # The provider vouched for the address (verified_email): confirmed.
    user = User(
        email=email,
        hashed_password=None,
        full_name=_display_name(claims, email),
        email_verified_at=datetime.now(UTC),
    )
    session.add(user)
    session.flush()
    session.add(
        ExternalIdentity(
            user_id=user.id,
            provider_key=INSTANCE_PROVIDER_KEY,
            issuer=config.issuer,
            subject=subject,
            email_at_link=email,
            last_login_at=datetime.now(UTC),
        )
    )
    session.commit()
    session.refresh(user)
    return user, True


def link(session: Session, user: User, config: OidcConfig, claims: dict[str, Any]) -> None:
    """Links the signed-in account to the identity the provider just
    vouched for. The email may differ (it's recorded); the identity can't
    already belong to someone else."""
    subject = subject_of(config, claims)
    existing = find_identity(session, config, subject)
    if existing is not None and existing.user_id != user.id:
        raise OidcError("identity_taken")
    if existing is not None:
        return
    if identity_of(session, user) is not None:
        raise OidcError("already_linked")
    session.add(
        ExternalIdentity(
            user_id=user.id,
            provider_key=INSTANCE_PROVIDER_KEY,
            issuer=config.issuer,
            subject=subject,
            email_at_link=verified_email(config, claims),
        )
    )
    session.commit()


def matches_identity(
    session: Session, user: User, config: OidcConfig, claims: dict[str, Any]
) -> bool:
    identity = find_identity(session, config, subject_of(config, claims))
    return identity is not None and identity.user_id == user.id


def recently_authenticated(claims: dict[str, Any], since: datetime) -> bool:
    """The provider asked who it was after `since` (a step-up asks with
    max_age=0). A provider that doesn't say when (no auth_time) is trusted
    to have honoured prompt=login."""
    auth_time = claims.get("auth_time")
    if auth_time is None:
        return True
    if not isinstance(auth_time, int | float):
        return False
    return auth_time >= since.timestamp() - CLOCK_LEEWAY_SECONDS and (
        datetime.now(UTC).timestamp() - auth_time <= STEP_UP_MAX_AGE.total_seconds()
    )


def unlink(session: Session, user: User) -> None:
    identity = identity_of(session, user)
    if identity is None:
        raise AppException(
            "SSO_NOT_LINKED",
            "This account isn't linked to single sign-on.",
            404,
            log_level=logging.WARNING,
        )
    if user.hashed_password is None:
        raise AppException(
            "SSO_UNLINK_NEEDS_PASSWORD",
            "Set a password before unlinking single sign-on, or you couldn't sign in.",
            409,
            log_level=logging.WARNING,
        )
    session.delete(identity)
    session.commit()


def forget_user(session: Session, user_id: uuid.UUID) -> None:
    """A deleted account's links and trips in flight (account deletion)."""
    session.exec(delete(ExternalIdentity).where(ExternalIdentity.user_id == user_id))
    session.exec(delete(OidcLoginState).where(OidcLoginState.user_id == user_id))
