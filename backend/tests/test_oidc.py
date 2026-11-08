"""Single sign-on through an OpenID Connect provider: the sign-in page's
button, the trip to the provider and back (state single-use and bound to
the browser, PKCE, every check on the ID token), accounts matched on the
provider's id and never taken over by email, accounts created on first
sign-in without a password, the provider's second factor standing in for
TOTP, step-up through the provider, linking and unlinking, and Platform ->
Single sign-on (the secret never returned, the environment's pin).

The provider is faked in process: its metadata, token endpoint and keys
(an RSA key made here) replace oidc_service's HTTP calls."""

import time
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any
from urllib.parse import parse_qs, urlsplit

import jwt
import pyotp
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlmodel import Session, select

from app.core import crypto
from app.core.config import settings
from app.main import app
from app.models import ExternalIdentity, OidcSettings, PlatformAuditEvent, User, UserSession
from app.services import oidc_service, totp_service
from tests.test_instance_tenancy import _csrf, _make_admin, _register, _stale_sign_in

TENANT = "11111111-2222-3333-4444-555555555555"
ISSUER = f"https://login.microsoftonline.com/{TENANT}/v2.0"
CLIENT_ID = "ttx-client-id"
SECRET = "client-s3cret-value"
PASSWORD = "Correcthorse123!"
AUTHORIZE = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/authorize"


class FakeProvider:
    """An Entra tenant: metadata, a token endpoint that hands out the next
    ID token, and the key that signs it."""

    def __init__(self) -> None:
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.claims: dict[str, Any] = {}
        self.token_requests: list[dict[str, Any]] = []
        self.signing: tuple[Any, str] | None = None
        self.metadata = {
            "issuer": ISSUER,
            "authorization_endpoint": AUTHORIZE,
            "token_endpoint": f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token",
            "jwks_uri": f"https://login.microsoftonline.com/{TENANT}/discovery/v2.0/keys",
            "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
        }

    def get_json(self, url: str) -> dict[str, Any]:
        if url.endswith("/.well-known/openid-configuration"):
            return self.metadata
        if url == self.metadata["jwks_uri"]:
            return {"keys": [{"kid": "k1", "kty": "RSA"}]}
        raise AssertionError(f"unexpected GET {url}")

    def post_form(self, url: str, form: dict[str, str], headers: dict[str, str]) -> dict:
        assert url == self.metadata["token_endpoint"]
        self.token_requests.append({"form": form, "headers": headers})
        key, alg = self.signing or (self.key, "RS256")
        return {"id_token": jwt.encode(self.claims, key, algorithm=alg, headers={"kid": "k1"})}


@pytest.fixture
def provider(monkeypatch: pytest.MonkeyPatch) -> FakeProvider:
    fake = FakeProvider()
    monkeypatch.setattr(oidc_service, "_http_get_json", fake.get_json)
    monkeypatch.setattr(oidc_service, "_http_post_form", fake.post_form)
    monkeypatch.setattr(oidc_service, "_signing_key", lambda jwks_uri, token: fake.key.public_key())
    return fake


def _configure(db_session: Session, **overrides) -> None:
    """Single sign-on on, as if set from Platform."""
    values = {
        "provider_kind": "entra",
        "display_name": "Microsoft",
        "entra_tenant_id": TENANT,
        "client_id": CLIENT_ID,
        "client_secret_encrypted": crypto.encrypt_secret(SECRET),
        "allow_jit": True,
        **overrides,
    }
    db_session.add(OidcSettings(**values))
    db_session.commit()


def _claims(expected_nonce: str, **overrides) -> dict[str, Any]:
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": CLIENT_ID,
        "tid": TENANT,
        "oid": "oid-pat",
        "sub": "pairwise-sub",
        "iat": now,
        "exp": now + 600,
        "nonce": expected_nonce,
        "name": "Pat Smith",
        "preferred_username": "pat@acme.com",
        "amr": ["pwd", "mfa"],
    }
    claims.update(overrides)
    return {k: v for k, v in claims.items() if v is not None}


def _query(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


def _start(client: TestClient, return_to: str = "/") -> dict[str, str]:
    response = client.get(
        "/api/v1/auth/oidc/start", params={"return_to": return_to}, follow_redirects=False
    )
    assert response.status_code == 302, response.text
    assert response.headers["location"].startswith(
        FakeProvider().metadata["authorization_endpoint"]
    )
    return _query(response.headers["location"])


def _back(client: TestClient, provider: FakeProvider, params: dict[str, str], **claims):
    provider.claims = _claims(params["nonce"], **claims)
    return client.get(
        "/api/v1/auth/oidc/callback",
        params={"code": "auth-code", "state": params["state"]},
        follow_redirects=False,
    )


def _sign_in(client: TestClient, provider: FakeProvider, return_to: str = "/", **claims):
    return _back(client, provider, _start(client, return_to), **claims)


def _sso_error(response) -> str | None:
    assert response.status_code == 302, response.text
    return _query(response.headers["location"]).get("sso_error")


def _user(db_session: Session, email: str) -> User | None:
    db_session.expire_all()
    return db_session.exec(select(User).where(User.email == email)).first()


def _actions(db_session: Session) -> list[str]:
    db_session.expire_all()
    return [e.action for e in db_session.exec(select(PlatformAuditEvent))]


# --- The sign-in page ------------------------------------------------------


def test_the_sign_in_page_offers_it_only_once_configured(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert client.get("/api/v1/auth/oidc/config").json() == {
        "enabled": False,
        "display_name": None,
        "provider_kind": None,
    }
    unavailable = client.get("/api/v1/auth/oidc/start", follow_redirects=False)
    assert _sso_error(unavailable) == "SSO_UNAVAILABLE"

    _configure(db_session)
    assert client.get("/api/v1/auth/oidc/config").json() == {
        "enabled": True,
        "display_name": "Microsoft",
        "provider_kind": "entra",
    }
    # Without the address the provider sends people back to, it's off.
    monkeypatch.setattr(settings, "PUBLIC_BASE_URL", None)
    assert client.get("/api/v1/auth/oidc/config").json()["enabled"] is False


def test_the_trip_to_the_provider_uses_pkce_state_and_nonce(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)

    params = _start(client)

    assert params["response_type"] == "code"
    assert params["client_id"] == CLIENT_ID
    assert params["redirect_uri"] == "https://ttx.acme.com/api/v1/auth/oidc/callback"
    assert params["code_challenge_method"] == "S256"
    assert params["scope"] == "openid email profile"
    assert len(params["state"]) >= 32 and len(params["nonce"]) >= 32
    assert oidc_service.BINDING_COOKIE_NAME in client.cookies

    _back(client, provider, params)
    form = provider.token_requests[0]["form"]
    assert form["grant_type"] == "authorization_code"
    assert form["code_verifier"]
    assert "client_secret" not in form
    assert provider.token_requests[0]["headers"]["Authorization"].startswith("Basic ")


# --- Accounts --------------------------------------------------------------


def test_a_first_sign_in_creates_an_account_without_a_password(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)

    response = _sign_in(client, provider, "/creator")

    assert response.status_code == 302
    assert response.headers["location"] == "https://ttx.acme.com/auth/sso?return_to=%2Fcreator"
    assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies
    user = _user(db_session, "pat@acme.com")
    assert (user.full_name, user.hashed_password) == ("Pat Smith", None)
    # The provider vouched for the address: nothing to confirm.
    assert user.email_verified_at is not None
    me = client.get("/api/v1/auth/me").json()
    assert (me["has_password"], me["sso_linked"], me["session"]["mfa_source"]) == (
        False,
        True,
        "provider",
    )
    assert "auth.register" in _actions(db_session)
    identity = db_session.exec(select(ExternalIdentity)).one()
    assert (identity.issuer, identity.subject) == (ISSUER, "oid-pat")

    # The next sign-in finds it by the provider's id, whatever the email says now.
    client.cookies.clear()
    again = _sign_in(client, provider, preferred_username="pat.smith@acme.com")
    assert _sso_error(again) is None
    assert client.get("/api/v1/auth/me").json()["email"] == "pat@acme.com"


def test_each_sign_in_confirms_the_address_again(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    """The provider vouches for the address every time: the periodic
    reconfirmation never has to ask a single sign-on account."""
    _configure(db_session)
    _sign_in(client, provider)
    user = _user(db_session, "pat@acme.com")
    user.email_verified_at = datetime.now(UTC) - timedelta(days=400)
    user.email_reconfirm_deadline = datetime.now(UTC) - timedelta(days=1)
    db_session.add(user)
    db_session.commit()

    client.cookies.clear()
    _sign_in(client, provider)

    db_session.expire_all()
    user = _user(db_session, "pat@acme.com")
    assert user.email_verified_at > datetime.now(UTC) - timedelta(minutes=1)
    assert user.email_reconfirm_deadline is None


def test_without_account_creation_an_unknown_person_is_refused(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session, allow_jit=False)

    assert _sso_error(_sign_in(client, provider)) == "SSO_ACCOUNT_NOT_FOUND"
    assert _user(db_session, "pat@acme.com") is None
    assert "auth.login_failed" in _actions(db_session)


def test_an_existing_account_is_never_taken_over_by_its_email(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _register(client, "pat@acme.com")
    client.cookies.clear()
    _configure(db_session)

    assert _sso_error(_sign_in(client, provider)) == "SSO_LINK_REQUIRED"
    assert db_session.exec(select(ExternalIdentity)).first() is None


@pytest.mark.parametrize(
    "claims",
    [
        # Entra's email claim alone is whatever the mail attribute says.
        {"preferred_username": None, "email": "pat@acme.com"},
        # A guest's UPN isn't a domain the tenant verified.
        {"preferred_username": "pat_gmail.com#EXT#@acme.onmicrosoft.com"},
    ],
)
def test_an_email_the_provider_doesnt_vouch_for_creates_nothing(
    client: TestClient, db_session: Session, provider: FakeProvider, claims: dict
) -> None:
    _configure(db_session)

    assert _sso_error(_sign_in(client, provider, **claims)) == "SSO_EMAIL_UNVERIFIED"
    assert db_session.exec(select(User)).first() is None


def test_a_verified_email_claim_counts(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)

    _sign_in(client, provider, preferred_username=None, email="Pat@Acme.com", xms_edov=True)

    assert _user(db_session, "pat@acme.com") is not None


@pytest.mark.parametrize(
    ("claims", "expected"),
    [
        ({"email": "Pat@Acme.com", "email_verified": True}, "pat@acme.com"),
        # Some providers send the flag as text.
        ({"email": "pat@acme.com", "email_verified": "true"}, "pat@acme.com"),
        ({"email": "pat@acme.com", "email_verified": False}, None),
        ({"email": "pat@acme.com", "email_verified": "false"}, None),
        ({"email": "pat@acme.com"}, None),
        ({"email_verified": True}, None),
        ({"email": ["pat@acme.com"], "email_verified": True}, None),
        # Entra's way of vouching means nothing from anyone else.
        ({"email": "pat@acme.com", "xms_edov": True}, None),
        ({"preferred_username": "pat@acme.com"}, None),
    ],
)
def test_any_other_provider_vouches_only_with_email_verified(
    claims: dict, expected: str | None
) -> None:
    config = SimpleNamespace(provider_kind="generic")

    assert oidc_service.verified_email(config, claims) == expected


def test_entra_ignores_the_generic_email_verified_claim() -> None:
    config = SimpleNamespace(provider_kind="entra")
    claims = {"email": "pat@acme.com", "email_verified": True}

    assert oidc_service.verified_email(config, claims) is None


def test_a_suspended_account_is_refused(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _sign_in(client, provider)
    user = _user(db_session, "pat@acme.com")
    user.suspended_at = datetime.now(UTC)
    db_session.add(user)
    db_session.commit()
    client.cookies.clear()

    response = _sign_in(client, provider)

    assert _sso_error(response) == "SSO_SUSPENDED"
    assert settings.ACCESS_TOKEN_COOKIE_NAME not in response.cookies


def test_a_password_sign_in_to_an_account_without_one_is_a_plain_failure(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _sign_in(client, provider)
    client.cookies.clear()

    response = client.post("/api/v1/auth/login", json={"email": "pat@acme.com", "password": "x"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"
    event = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "auth.login_failed")
    ).one()
    assert event.details == {"reason": "no_password"}


# --- The trip's checks -----------------------------------------------------


def test_a_state_is_single_use_and_bound_to_its_browser(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    params = _start(client)

    # Another browser (no binding cookie) with the same callback URL.
    with TestClient(app) as other:
        assert _sso_error(_back(other, provider, params)) == "SSO_STATE_INVALID"
    # The state was spent by that attempt: the real browser can't use it either.
    assert _sso_error(_back(client, provider, params)) == "SSO_STATE_INVALID"
    assert _sso_error(_back(client, provider, {"state": "made-up", "nonce": "x"})) == (
        "SSO_STATE_INVALID"
    )


def test_an_old_state_has_expired(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    params = _start(client)
    from app.models import OidcLoginState

    row = db_session.get(OidcLoginState, params["state"])
    row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.add(row)
    db_session.commit()

    assert _sso_error(_back(client, provider, params)) == "SSO_STATE_EXPIRED"


@pytest.mark.parametrize(
    "claims",
    [
        {"nonce": "another-nonce"},
        {"aud": "another-client"},
        {"iss": "https://login.microsoftonline.com/other/v2.0"},
        {"tid": "99999999-2222-3333-4444-555555555555"},
        {"exp": int(time.time()) - 3600, "iat": int(time.time()) - 7200},
        {"oid": None},
    ],
    ids=["nonce", "audience", "issuer", "tenant", "expired", "no-oid"],
)
def test_an_id_token_that_fails_a_check_signs_no_one_in(
    client: TestClient, db_session: Session, provider: FakeProvider, claims: dict
) -> None:
    _configure(db_session)

    response = _sign_in(client, provider, **claims)

    assert _sso_error(response) == "SSO_TOKEN_INVALID"
    assert settings.ACCESS_TOKEN_COOKIE_NAME not in response.cookies


def test_a_token_signed_with_a_shared_secret_is_refused(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    """HS256 with a value the attacker might know (the client secret)."""
    _configure(db_session)
    provider.signing = (SECRET, "HS256")

    assert _sso_error(_sign_in(client, provider)) == "SSO_TOKEN_INVALID"


def test_the_provider_cancelling_says_so(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    params = _start(client)

    response = client.get(
        "/api/v1/auth/oidc/callback",
        params={"state": params["state"], "error": "access_denied"},
        follow_redirects=False,
    )

    assert _sso_error(response) == "SSO_CANCELLED"


def test_return_to_never_leaves_the_application(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)

    response = _sign_in(client, provider, "//evil.example/steal")

    assert response.headers["location"] == "https://ttx.acme.com/auth/sso?return_to=%2F"


# --- Second factor ---------------------------------------------------------


def _founder_linked(client: TestClient, db_session: Session, provider: FakeProvider) -> str:
    """A Program Manager (TOTP mandatory, none enrolled) linked to the
    provider; returns the organization's id."""
    founded = client.post(
        "/api/v1/organizations",
        json={
            "organization": {"name": "Acme", "tax_id": None},
            "admin": {"email": "pat@acme.com", "password": PASSWORD, "full_name": "Pat"},
        },
    )
    assert founded.status_code == 201, founded.text
    linked = client.post(
        "/api/v1/auth/oidc/link", json={"return_to": "/account"}, headers=_csrf(client)
    )
    assert linked.status_code == 200, linked.text
    params = _query(linked.json()["authorize_url"])
    assert _back(client, provider, params).headers["location"] == (
        "https://ttx.acme.com/account?sso_linked=1"
    )
    client.cookies.clear()
    return founded.json()["organization"]["id"]


def test_the_providers_second_factor_stands_in_for_totp(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    org_id = _founder_linked(client, db_session, provider)

    _sign_in(client, provider)
    with_mfa = client.get(f"/api/v1/organizations/{org_id}/members")
    client.cookies.clear()
    _sign_in(client, provider, amr=["pwd"])
    without = client.get(f"/api/v1/organizations/{org_id}/members")

    assert with_mfa.status_code == 200, with_mfa.text
    assert without.json()["error"]["code"] == "MFA_REQUIRED"
    # Each sign-in's event says whether the provider's factor counted.
    db_session.expire_all()
    logins = db_session.exec(
        select(PlatformAuditEvent)
        .where(PlatformAuditEvent.action == "auth.login")
        .order_by(PlatformAuditEvent.created_at)
    ).all()
    assert [e.details.get("provider_mfa") for e in logins][-2:] == [True, False]


def test_not_trusting_the_provider_leaves_totp_mandatory(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session, trust_provider_mfa=False)
    org_id = _founder_linked(client, db_session, provider)

    _sign_in(client, provider)

    assert client.get(f"/api/v1/organizations/{org_id}/members").json()["error"]["code"] == (
        "MFA_REQUIRED"
    )


def test_without_the_providers_second_factor_the_account_totp_finishes_it(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _founder_linked(client, db_session, provider)
    user = _user(db_session, "pat@acme.com")
    secret = pyotp.random_base32()
    totp_service.store_secret(user, secret)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()

    response = _sign_in(client, provider, amr=["pwd"])

    location = urlsplit(response.headers["location"])
    assert location.path == "/login"
    assert settings.ACCESS_TOKEN_COOKIE_NAME not in response.cookies
    token = location.fragment.removeprefix("mfa=")
    verified = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": token, "code": pyotp.TOTP(secret).now()},
    )
    assert verified.status_code == 200, verified.text


# --- Step-up, linking ------------------------------------------------------


def test_an_account_without_a_password_steps_up_through_the_provider(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _sign_in(client, provider)
    _stale_sign_in(db_session, "pat@acme.com")

    refused = client.post("/api/v1/auth/step-up", json={}, headers=_csrf(client))
    assert refused.json()["error"]["code"] == "SSO_STEP_UP_REQUIRED"

    started = client.post(
        "/api/v1/auth/oidc/step-up", json={"return_to": "/admin"}, headers=_csrf(client)
    )
    params = _query(started.json()["authorize_url"])
    assert (params["prompt"], params["max_age"], params["login_hint"]) == (
        "login",
        "0",
        "pat@acme.com",
    )
    done = _back(client, provider, params, auth_time=int(time.time()))

    assert done.headers["location"] == "https://ttx.acme.com/admin?sso_confirmed=1"
    db_session.expire_all()
    user_session = db_session.exec(select(UserSession)).one()
    assert datetime.now(UTC) - user_session.authenticated_at < timedelta(minutes=1)
    assert "auth.step_up" in _actions(db_session)


def test_a_step_up_counts_only_for_the_session_that_asked(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _sign_in(client, provider)
    started = client.post(
        "/api/v1/auth/oidc/step-up", json={"return_to": "/"}, headers=_csrf(client)
    )
    params = _query(started.json()["authorize_url"])
    binding = client.cookies.get(oidc_service.BINDING_COOKIE_NAME)

    # The same person signed in elsewhere, with this trip's cookie.
    with TestClient(app) as other:
        _sign_in(other, provider)
        other.cookies.set(
            oidc_service.BINDING_COOKIE_NAME, binding, path=oidc_service.BINDING_COOKIE_PATH
        )
        assert _sso_error(_back(other, provider, params)) == "SSO_SESSION_MISMATCH"


def test_a_step_up_as_someone_else_at_the_provider_is_refused(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _sign_in(client, provider)
    started = client.post(
        "/api/v1/auth/oidc/step-up", json={"return_to": "/"}, headers=_csrf(client)
    )

    response = _back(client, provider, _query(started.json()["authorize_url"]), oid="oid-other")

    assert _sso_error(response) == "SSO_IDENTITY_MISMATCH"


def test_an_identity_belongs_to_one_account(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _sign_in(client, provider)
    client.cookies.clear()
    _register(client, "other@acme.com")

    linked = client.post("/api/v1/auth/oidc/link", json={}, headers=_csrf(client))
    response = _back(client, provider, _query(linked.json()["authorize_url"]))

    assert _sso_error(response) == "SSO_IDENTITY_TAKEN"


def test_unlinking_needs_a_password_first(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _sign_in(client, provider)

    refused = client.delete("/api/v1/auth/oidc/link", headers=_csrf(client))
    set_password = client.post(
        "/api/v1/auth/password", json={"new_password": PASSWORD}, headers=_csrf(client)
    )
    unlinked = client.delete("/api/v1/auth/oidc/link", headers=_csrf(client))

    assert refused.json()["error"]["code"] == "SSO_UNLINK_NEEDS_PASSWORD"
    assert set_password.status_code == 204, set_password.text
    assert unlinked.status_code == 204
    assert client.get("/api/v1/auth/me").json()["sso_linked"] is False
    assert {"auth.password_change", "auth.sso_unlink"} <= set(_actions(db_session))


def test_a_deleted_account_frees_its_identity(
    client: TestClient, db_session: Session, provider: FakeProvider
) -> None:
    _configure(db_session)
    _sign_in(client, provider)

    deleted = client.request(
        "DELETE",
        "/api/v1/auth/me",
        json={"confirmation": "delete my account"},
        headers=_csrf(client),
    )

    assert deleted.status_code == 204, deleted.text
    assert db_session.exec(select(ExternalIdentity)).first() is None


# --- Platform -> Single sign-on --------------------------------------------


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> TestClient:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    return client


def _body(**overrides) -> dict:
    return {
        "provider_kind": "entra",
        "entra_tenant_id": TENANT,
        "client_id": CLIENT_ID,
        "client_secret": SECRET,
        "allow_jit": True,
        **overrides,
    }


def test_platform_saves_it_with_step_up_and_never_returns_the_secret(
    admin: TestClient, db_session: Session
) -> None:
    empty = admin.get("/api/v1/instance/oidc").json()
    saved = admin.put("/api/v1/instance/oidc", json=_body(), headers=_csrf(admin))
    kept = admin.put(
        "/api/v1/instance/oidc",
        json=_body(client_secret=None, display_name="Acme"),
        headers=_csrf(admin),
    )
    _stale_sign_in(db_session, "ops@acme.com")
    stale = admin.put("/api/v1/instance/oidc", json=_body(), headers=_csrf(admin))

    assert (empty["configured"], empty["redirect_uri"]) == (
        False,
        "https://ttx.acme.com/api/v1/auth/oidc/callback",
    )
    assert saved.status_code == 200, saved.text
    assert SECRET not in saved.text
    body = kept.json()
    assert (body["active"], body["has_client_secret"], body["display_name"]) == (
        True,
        True,
        "Acme",
    )
    row = db_session.get(OidcSettings, 1)
    assert crypto.decrypt_secret(row.client_secret_encrypted) == SECRET
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    events = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "sso.settings_update")
    ).all()
    assert len(events) == 2 and SECRET not in str([e.details for e in events])


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"entra_tenant_id": "common"}, "SSO_TENANT_ID_INVALID"),
        (
            {"provider_kind": "generic", "issuer_url": "http://idp.acme.com"},
            "SSO_ISSUER_URL_INVALID",
        ),
        ({"client_secret": None}, "SSO_CLIENT_SECRET_REQUIRED"),
    ],
)
def test_platform_validates_the_provider(admin: TestClient, overrides: dict, code: str) -> None:
    response = admin.put("/api/v1/instance/oidc", json=_body(**overrides), headers=_csrf(admin))

    assert response.json()["error"]["code"] == code


def test_platform_tests_the_provider(admin: TestClient, provider: FakeProvider) -> None:
    admin.put("/api/v1/instance/oidc", json=_body(), headers=_csrf(admin))

    ok = admin.post("/api/v1/instance/oidc/test", headers=_csrf(admin)).json()
    provider.metadata["issuer"] = "https://impostor.example"
    oidc_service._discovery_cache.clear()
    wrong = admin.post("/api/v1/instance/oidc/test", headers=_csrf(admin)).json()

    assert ok == {"ok": True, "error": None, "detail": None}
    assert (wrong["ok"], wrong["error"]) == (False, "provider_error")


def test_the_environment_pins_it_and_platform_only_reads_it(
    admin: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    for name, value in {
        "OIDC_PROVIDER": "generic",
        "OIDC_ISSUER_URL": "https://idp.corp.example/realms/ttx",
        "OIDC_CLIENT_ID": "from-env",
        "OIDC_CLIENT_SECRET": SecretStr("env-secret"),
        "OIDC_DISPLAY_NAME": "Corp SSO",
    }.items():
        monkeypatch.setattr(settings, name, value)

    read = admin.get("/api/v1/instance/oidc")
    refused = admin.put("/api/v1/instance/oidc", json=_body(), headers=_csrf(admin))

    body = read.json()
    assert (body["pinned_by_env"], body["active"], body["issuer_url"]) == (
        True,
        True,
        "https://idp.corp.example/realms/ttx",
    )
    assert "env-secret" not in read.text
    assert refused.json()["error"]["code"] == "SSO_PINNED_BY_ENV"
    assert admin.get("/api/v1/auth/oidc/config").json()["display_name"] == "Corp SSO"


def test_only_an_instance_administrator_reaches_it(client: TestClient) -> None:
    _register(client, "pat@acme.com")

    response = client.get("/api/v1/instance/oidc")

    assert response.json()["error"]["code"] == "INSTANCE_ADMIN_REQUIRED"


def test_a_pinned_configuration_is_checked_at_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import Settings

    # Whatever the local deployment's environment sets.
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)

    base = {
        "POSTGRES_USER": "u",
        "POSTGRES_PASSWORD": "p",
        "POSTGRES_DB": "d",
        "SECRET_KEY": "k",
    }
    with pytest.raises(ValueError, match="PUBLIC_BASE_URL is required"):
        Settings(**base, OIDC_PROVIDER="entra", OIDC_ENTRA_TENANT_ID=TENANT, OIDC_CLIENT_ID="c")
    ok = Settings(
        **base,
        PUBLIC_BASE_URL="https://ttx.acme.com/",
        OIDC_PROVIDER="entra",
        OIDC_ENTRA_TENANT_ID=TENANT,
        OIDC_CLIENT_ID="c",
        OIDC_CLIENT_SECRET="s",
    )
    assert ok.PUBLIC_BASE_URL == "https://ttx.acme.com"


def test_a_safe_return_to() -> None:
    for unsafe in (None, "", "https://evil.example", "//evil.example", "/\\evil", "/a\nb"):
        assert oidc_service.safe_return_to(unsafe) == "/"
    assert oidc_service.safe_return_to("/admin?x=1") == "/admin?x=1"
