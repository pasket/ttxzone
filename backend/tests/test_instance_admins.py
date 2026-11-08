"""Platform -> Administrators: an instance administrator grants the role
to another account (from Accounts) and revokes it, never leaving the
deployment without one; the deployment can leave it to the console
(INSTANCE_ADMIN_WEB_GRANTS). Every Platform action lands in its activity
log, which keeps who did what as it read at the time."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import PlatformAuditEvent, User
from app.services.auth_service import DELETE_ACCOUNT_CONFIRMATION_PHRASE, deactivate_account
from app.services.instance_admin_service import grant_instance_admin, revoke_instance_admin
from tests.test_instance_tenancy import _csrf, _make_admin, _pin, _register, _stale_sign_in


def _user(db_session: Session, email: str) -> User:
    db_session.expire_all()
    return db_session.exec(select(User).where(User.email == email)).one()


def _events(db_session: Session, action: str | None = None) -> list[PlatformAuditEvent]:
    db_session.expire_all()
    query = select(PlatformAuditEvent).order_by(PlatformAuditEvent.created_at)
    if action:
        query = query.where(PlatformAuditEvent.action == action)
    else:
        # Administration only: signing up and in is logged too.
        query = query.where(PlatformAuditEvent.action.not_like("auth.%"))
    return list(db_session.exec(query))


def _grant(client: TestClient, user: User, confirmation: str | None = None):
    return client.post(
        "/api/v1/instance/admins",
        json={"user_id": str(user.id), "confirmation": confirmation or user.email},
        headers=_csrf(client),
    )


def _revoke(client: TestClient, user: User):
    return client.delete(f"/api/v1/instance/admins/{user.id}", headers=_csrf(client))


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> TestClient:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    return client


def _another(db_session: Session, email: str = "pat@acme.com") -> User:
    with TestClient(app) as other:
        _register(other, email)
    return _user(db_session, email)


def test_an_admin_grants_the_role_and_it_is_logged(admin: TestClient, db_session: Session) -> None:
    pat = _another(db_session)

    granted = _grant(admin, pat)

    assert granted.status_code == 201, granted.text
    assert {a["email"] for a in granted.json()["items"]} == {"ops@acme.com", "pat@acme.com"}
    assert granted.json()["web_grants_enabled"] is True
    assert _user(db_session, "pat@acme.com").is_instance_admin
    [event] = _events(db_session, "instance_admin.grant")
    assert (event.actor_label, event.target_id, event.target_label) == (
        "ops@acme.com",
        pat.id,
        "pat@acme.com",
    )


def test_granting_asks_for_the_email_and_a_recent_sign_in(
    admin: TestClient, db_session: Session
) -> None:
    pat = _another(db_session)

    mismatch = _grant(admin, pat, "someone@acme.com")
    _stale_sign_in(db_session, "ops@acme.com")
    stale = _grant(admin, pat)

    assert mismatch.json()["error"]["code"] == "CONFIRMATION_MISMATCH"
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    assert not _user(db_session, "pat@acme.com").is_instance_admin
    assert _events(db_session, "instance_admin.grant") == []


def test_never_a_suspended_account_nor_one_already_admin(
    admin: TestClient, db_session: Session
) -> None:
    pat = _another(db_session)
    suspended = admin.post(
        f"/api/v1/instance/accounts/{pat.id}/suspend",
        json={"confirmation": pat.email},
        headers=_csrf(admin),
    )
    assert suspended.status_code == 200, suspended.text
    assert [e.target_label for e in _events(db_session, "account.suspend")] == ["pat@acme.com"]

    assert _grant(admin, pat).json()["error"]["code"] == "ACCOUNT_SUSPENDED"
    assert _grant(admin, _user(db_session, "ops@acme.com")).json()["error"]["code"] == (
        "ALREADY_INSTANCE_ADMIN"
    )


def test_revoking_another_or_yourself_but_never_the_last(
    admin: TestClient, db_session: Session
) -> None:
    ops = _user(db_session, "ops@acme.com")
    pat = _another(db_session)
    assert _grant(admin, pat).status_code == 201

    revoked = _revoke(admin, pat)
    assert revoked.status_code == 200, revoked.text
    assert [a["email"] for a in revoked.json()["items"]] == ["ops@acme.com"]
    last = _revoke(admin, ops)
    assert last.status_code == 409
    assert last.json()["error"]["code"] == "LAST_INSTANCE_ADMIN"

    # With another one around, you can step down yourself.
    assert _grant(admin, _user(db_session, "pat@acme.com")).status_code == 201
    assert _revoke(admin, ops).status_code == 200
    # ... and Platform closes at once.
    assert admin.get("/api/v1/instance/admins").json()["error"]["code"] == (
        "INSTANCE_ADMIN_REQUIRED"
    )


def test_the_deployment_can_leave_grants_to_the_console(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "INSTANCE_ADMIN_WEB_GRANTS", False)
    pat = _another(db_session)

    listed = admin.get("/api/v1/instance/admins").json()
    granted = _grant(admin, pat)
    revoked = _revoke(admin, _user(db_session, "ops@acme.com"))

    assert listed["web_grants_enabled"] is False
    assert granted.json()["error"]["code"] == "INSTANCE_ADMIN_WEB_GRANTS_DISABLED"
    assert revoked.json()["error"]["code"] == "INSTANCE_ADMIN_WEB_GRANTS_DISABLED"
    # The console works either way, and is logged as such.
    grant_instance_admin(db_session, _user(db_session, "pat@acme.com"), None)
    revoke_instance_admin(db_session, _user(db_session, "pat@acme.com"), None)
    assert [(e.action, e.actor_user_id, e.actor_label) for e in _events(db_session)] == [
        ("instance_admin.grant", None, "console"),
        ("instance_admin.revoke", None, "console"),
    ]


def test_only_an_instance_admin_reads_administrators_and_the_log(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "pat@acme.com")
    user = _user(db_session, "pat@acme.com")
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()

    for path in ("/api/v1/instance/admins", "/api/v1/instance/audit"):
        assert client.get(path).json()["error"]["code"] == "INSTANCE_ADMIN_REQUIRED"


def test_the_log_keeps_each_action_as_it_read_at_the_time(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, None)
    _another(db_session, "pm@acme.com")
    created = admin.post(
        "/api/v1/instance/organizations",
        json={"name": "Acme", "program_manager_email": "pm@acme.com"},
        headers=_csrf(admin),
    )
    assert created.status_code == 201, created.text
    org_id = created.json()["id"]
    assert (
        admin.patch(
            f"/api/v1/instance/organizations/{org_id}",
            json={"domain": "acme.org"},
            headers=_csrf(admin),
        ).status_code
        == 200
    )
    assert (
        admin.put(
            "/api/v1/instance/settings",
            json={"tenancy_mode": "managed", "max_organizations": 3},
            headers=_csrf(admin),
        ).status_code
        == 200
    )
    deleted = admin.delete(f"/api/v1/instance/organizations/{org_id}", headers=_csrf(admin))
    assert deleted.status_code == 204, deleted.text

    log = admin.get("/api/v1/instance/audit").json()
    assert [e["action"] for e in log["items"] if not e["action"].startswith("auth.")] == [
        "organization.delete",
        "tenancy.update",
        "organization.domain",
        "organization.create",
    ]
    by_action = {e["action"]: e for e in log["items"]}
    # The organization is gone; its name stays in the log.
    assert by_action["organization.delete"]["target_label"] == "Acme"
    domain = by_action["organization.domain"]["details"]
    assert domain == {"before": "acme.com", "after": "acme.org"}
    assert by_action["tenancy.update"]["details"]["after"] == {
        "mode": "managed",
        "max_organizations": 3,
    }
    filtered = admin.get("/api/v1/instance/audit?action=organization.create").json()
    assert filtered["total"] == 1

    # Deleting the acting account anonymizes it, not the log.
    deactivate_account(
        db_session, _user(db_session, "ops@acme.com"), DELETE_ACCOUNT_CONFIRMATION_PHRASE
    )
    assert {e.actor_label for e in _events(db_session)} == {"ops@acme.com"}
