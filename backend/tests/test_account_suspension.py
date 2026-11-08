"""Platform -> Accounts: an instance administrator suspends an account on
the whole deployment (no sign-in, every session ended, nothing deleted)
and reactivates it."""

import pyotp
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.main import app
from app.models import User
from app.services import totp_service
from app.services.account_suspension_service import suspend_account
from tests.test_instance_tenancy import (
    PASSWORD,
    _csrf,
    _make_admin,
    _register,
    _signup,
    _stale_sign_in,
)


def _user(db_session: Session, email: str) -> User:
    db_session.expire_all()
    return db_session.exec(select(User).where(User.email == email)).one()


def _suspend(client: TestClient, user: User, confirmation: str | None = None):
    return client.post(
        f"/api/v1/instance/accounts/{user.id}/suspend",
        json={"confirmation": confirmation or user.email},
        headers=_csrf(client),
    )


def _login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> TestClient:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    return client


def test_a_suspended_account_loses_its_sessions_and_cant_sign_in(
    admin: TestClient, db_session: Session
) -> None:
    with TestClient(app) as other:
        assert _signup(other, "pm@acme.com", "Acme").status_code == 201
        pm = _user(db_session, "pm@acme.com")

        suspended = _suspend(admin, pm)

        assert suspended.status_code == 200, suspended.text
        assert suspended.json()["suspended_at"] is not None
        assert other.get("/api/v1/auth/me").status_code == 401
    with TestClient(app) as again:
        refused = _login(again, "pm@acme.com")
        wrong_password = _login(again, "pm@acme.com", "Wrongpassword123!")
        taken = again.post(
            "/api/v1/auth/register",
            json={"email": "pm@acme.com", "password": PASSWORD, "full_name": "Pat"},
        )
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "ACCOUNT_SUSPENDED"
    # Only the right password learns the account is suspended.
    assert wrong_password.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert taken.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"

    reactivated = admin.post(f"/api/v1/instance/accounts/{pm.id}/reactivate", headers=_csrf(admin))
    assert reactivated.json()["suspended_at"] is None
    with TestClient(app) as back:
        assert _login(back, "pm@acme.com").status_code == 200
        # Nothing was deleted: the organization is still theirs.
        orgs = back.get("/api/v1/organizations/mine").json()["items"]
        assert [o["organization_name"] for o in orgs] == ["Acme"]


def test_a_login_waiting_on_its_second_factor_cant_finish(
    admin: TestClient, db_session: Session
) -> None:
    secret = pyotp.random_base32()
    with TestClient(app) as other:
        _register(other, "pat@acme.com")
    pat = _user(db_session, "pat@acme.com")
    totp_service.store_secret(pat, secret)
    pat.totp_enabled = True
    db_session.add(pat)
    db_session.commit()
    with TestClient(app) as other:
        pending = _login(other, "pat@acme.com").json()["mfa_pending_token"]
        _suspend(admin, pat)
        verified = other.post(
            "/api/v1/auth/login/verify-totp",
            json={"mfa_pending_token": pending, "code": pyotp.TOTP(secret).now()},
        )
    assert verified.json()["error"]["code"] == "ACCOUNT_SUSPENDED"


def test_suspending_asks_for_the_email_and_a_recent_sign_in(
    admin: TestClient, db_session: Session
) -> None:
    with TestClient(app) as other:
        _register(other, "pat@acme.com")
    pat = _user(db_session, "pat@acme.com")

    mismatch = _suspend(admin, pat, "someone@acme.com")
    _stale_sign_in(db_session, "ops@acme.com")
    stale = _suspend(admin, pat)

    assert mismatch.json()["error"]["code"] == "CONFIRMATION_MISMATCH"
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    assert _user(db_session, "pat@acme.com").suspended_at is None


def test_never_yourself_nor_the_last_instance_admin(admin: TestClient, db_session: Session) -> None:
    ops = _user(db_session, "ops@acme.com")

    yourself = _suspend(admin, ops)
    # From the console there's no "yourself": the last one is refused.
    with pytest.raises(AppException) as last:
        suspend_account(db_session, ops, None)

    assert yourself.json()["error"]["code"] == "CANNOT_SUSPEND_YOURSELF"
    assert last.value.code == "LAST_INSTANCE_ADMIN"


def test_accounts_list_warns_of_organizations_left_without_a_program_manager(
    admin: TestClient, db_session: Session
) -> None:
    with TestClient(app) as other:
        assert _signup(other, "pm@acme.com", "Acme").status_code == 201

    items = admin.get("/api/v1/instance/accounts?q=pm@").json()["items"]

    [pm] = items
    [acme] = pm["organizations"]
    assert acme["name"] == "Acme"
    assert set(acme["roles"]) == {"program_manager", "planner"}
    assert acme["sole_program_manager"] is True


def test_a_suspended_account_cant_be_made_program_manager(
    admin: TestClient, db_session: Session
) -> None:
    with TestClient(app) as other:
        _register(other, "ciso@acme.com")
    _suspend(admin, _user(db_session, "ciso@acme.com"))

    created = admin.post(
        "/api/v1/instance/organizations",
        json={"name": "Acme", "program_manager_email": "ciso@acme.com"},
        headers=_csrf(admin),
    )

    assert created.json()["error"]["code"] == "ACCOUNT_SUSPENDED"


def test_accounts_need_an_instance_admin(client: TestClient, db_session: Session) -> None:
    assert _signup(client, "pm@acme.com", "Acme").status_code == 201
    pm = _user(db_session, "pm@acme.com")
    pm.totp_enabled = True
    db_session.add(pm)
    db_session.commit()

    listed = client.get("/api/v1/instance/accounts")
    suspended = _suspend(client, pm)

    assert listed.json()["error"]["code"] == "INSTANCE_ADMIN_REQUIRED"
    assert suspended.json()["error"]["code"] == "INSTANCE_ADMIN_REQUIRED"
