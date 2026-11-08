"""Free email domains: in an "open" deployment an account on one of them
can't found an organization of its own; under "single" and "managed" the
list doesn't apply. The instance administrator adds domains to the
built-in list, or switches built-in ones off, from Platform."""

from datetime import UTC, datetime, timedelta

import dns.resolver
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import PlatformAuditEvent, User, UserSession

PASSWORD = "Correcthorse123!"
URL = "/api/v1/instance/free-email-domains"


@pytest.fixture(autouse=True)
def _policy_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ORG_CREATION_DOMAIN_POLICY_ENABLED", True)
    monkeypatch.setattr(dns.resolver.Resolver, "resolve", lambda self, domain, rtype: ["ok"])


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _register(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Pat"},
    )
    assert response.status_code == 201, response.text


def _signup(client: TestClient, email: str, org_name: str = "Acme"):
    return client.post(
        "/api/v1/organizations",
        json={
            "organization": {"name": org_name, "tax_id": None},
            "admin": {"email": email, "password": PASSWORD, "full_name": "Owner"},
        },
    )


def _admin(client: TestClient, db_session: Session, email: str = "ops@acme.com") -> None:
    _register(client, email)
    user = db_session.exec(select(User).where(User.email == email)).one()
    user.is_instance_admin = True
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _pin(monkeypatch: pytest.MonkeyPatch, mode: str) -> None:
    monkeypatch.setattr(settings, "TENANCY_MODE", mode)
    monkeypatch.setattr(settings, "TENANCY_MAX_ORGANIZATIONS", None)


def _blocked(response) -> bool:
    return (
        response.status_code == 422
        and response.json()["error"]["code"] == "FREE_EMAIL_DOMAIN_BLOCKED"
    )


@pytest.mark.parametrize(
    "email", ["a@gmail.com", "a@yahoo.es", "a@ymail.com", "a@proton.me", "a@pm.me", "a@msn.com"]
)
def test_open_refuses_founding_with_a_built_in_free_domain(client: TestClient, email: str) -> None:
    assert _blocked(_signup(client, email))


def test_single_bootstrap_ignores_the_list(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, "single")
    assert _signup(client, "owner@gmail.com").status_code == 201


def test_managed_lets_the_admin_create_one_for_a_free_domain_account(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, "managed")
    _admin(client, db_session)
    with TestClient(app) as other:
        _register(other, "founder@gmail.com")

    created = client.post(
        "/api/v1/instance/organizations",
        json={"name": "Pat's Org", "program_manager_email": "founder@gmail.com"},
        headers=_csrf(client),
    )

    assert created.status_code == 201, created.text


def test_the_admin_adds_disables_and_removes_domains(
    client: TestClient, db_session: Session
) -> None:
    _admin(client, db_session)

    listing = client.get(URL).json()
    assert listing["applies"] is True
    gmail = next(item for item in listing["items"] if item["domain"] == "gmail.com")
    assert gmail == {"domain": "gmail.com", "builtin": True, "active": True}

    added = client.post(URL, json={"domain": "Hotmail.ES"}, headers=_csrf(client))
    assert added.status_code == 201, added.text
    assert added.json() == {"domain": "hotmail.es", "builtin": False, "active": True}
    switched_off = client.put(f"{URL}/gmail.com", json={"active": False}, headers=_csrf(client))
    assert switched_off.json() == {"domain": "gmail.com", "builtin": True, "active": False}

    with TestClient(app) as other:
        assert _blocked(_signup(other, "a@hotmail.es"))
    with TestClient(app) as other:
        assert _signup(other, "a@gmail.com").status_code == 201

    # Adding a switched-off built-in domain switches it back on.
    again = client.post(URL, json={"domain": "gmail.com"}, headers=_csrf(client))
    assert again.json() == {"domain": "gmail.com", "builtin": True, "active": True}
    with TestClient(app) as other:
        assert _blocked(_signup(other, "b@gmail.com"))

    assert client.delete(f"{URL}/hotmail.es", headers=_csrf(client)).status_code == 204
    with TestClient(app) as other:
        assert _signup(other, "a@hotmail.es").status_code == 201

    actions = [
        (event.action, event.target_label)
        for event in db_session.exec(
            select(PlatformAuditEvent)
            .where(PlatformAuditEvent.action.startswith("free_email_domain."))  # type: ignore[attr-defined]
            .order_by(PlatformAuditEvent.created_at)  # type: ignore[arg-type]
        )
    ]
    assert actions == [
        ("free_email_domain.add", "hotmail.es"),
        ("free_email_domain.disable", "gmail.com"),
        ("free_email_domain.enable", "gmail.com"),
        ("free_email_domain.remove", "hotmail.es"),
    ]


def test_duplicates_and_built_in_removal_are_refused(
    client: TestClient, db_session: Session
) -> None:
    _admin(client, db_session)
    assert client.post(URL, json={"domain": "corp-mail.example"}, headers=_csrf(client)).is_success

    for domain in ("gmail.com", "corp-mail.example"):
        duplicate = client.post(URL, json={"domain": domain}, headers=_csrf(client))
        assert duplicate.status_code == 409
        assert duplicate.json()["error"]["code"] == "FREE_EMAIL_DOMAIN_EXISTS"
    builtin = client.delete(f"{URL}/gmail.com", headers=_csrf(client))
    assert builtin.status_code == 409
    assert builtin.json()["error"]["code"] == "FREE_EMAIL_DOMAIN_BUILTIN"
    assert client.delete(f"{URL}/nowhere.example", headers=_csrf(client)).status_code == 404
    toggle_added = client.put(
        f"{URL}/corp-mail.example", json={"active": False}, headers=_csrf(client)
    )
    assert toggle_added.status_code == 404


def test_the_list_says_when_it_does_not_apply(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, "managed")
    _admin(client, db_session)
    assert client.get(URL).json()["applies"] is False


def test_changes_ask_to_confirm_it_is_you(client: TestClient, db_session: Session) -> None:
    _admin(client, db_session)
    user = db_session.exec(select(User).where(User.email == "ops@acme.com")).one()
    for user_session in db_session.exec(select(UserSession).where(UserSession.user_id == user.id)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()

    for response in (
        client.post(URL, json={"domain": "hotmail.es"}, headers=_csrf(client)),
        client.put(f"{URL}/gmail.com", json={"active": False}, headers=_csrf(client)),
        client.delete(f"{URL}/hotmail.es", headers=_csrf(client)),
    ):
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    assert client.get(URL).status_code == 200


def test_only_an_instance_admin_manages_the_list(client: TestClient, db_session: Session) -> None:
    assert _signup(client, "pm@acme.com").status_code == 201
    pm = db_session.exec(select(User).where(User.email == "pm@acme.com")).one()
    pm.totp_enabled = True
    db_session.add(pm)
    db_session.commit()

    for response in (
        client.get(URL),
        client.post(URL, json={"domain": "hotmail.es"}, headers=_csrf(client)),
        client.put(f"{URL}/gmail.com", json={"active": False}, headers=_csrf(client)),
        client.delete(f"{URL}/hotmail.es", headers=_csrf(client)),
    ):
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "INSTANCE_ADMIN_REQUIRED"
