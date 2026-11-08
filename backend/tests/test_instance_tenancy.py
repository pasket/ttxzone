"""The deployment's tenancy rules: "open" (any account founds
organizations), "single" (one, founded once) and "managed" (only an
instance administrator creates them, from Platform) -- pinned by the
environment or set from the web."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import (
    InstanceSettings,
    Organization,
    OrganizationAllowedDomain,
    OrganizationMembership,
    OrgRoleEnum,
    User,
    UserSession,
)
from app.services import account_email_service

PASSWORD = "Correcthorse123!"


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _register(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Pat"},
    )
    assert response.status_code == 201, response.text


def _signup(client: TestClient, email: str, org_name: str):
    return client.post(
        "/api/v1/organizations",
        json={
            "organization": {"name": org_name, "tax_id": None},
            "admin": {"email": email, "password": PASSWORD, "full_name": "Owner"},
        },
    )


def _found(client: TestClient, name: str):
    return client.post("/api/v1/organizations/mine", json={"name": name}, headers=_csrf(client))


def _make_admin(db_session: Session, email: str, totp: bool = True) -> None:
    user = db_session.exec(select(User).where(User.email == email)).one()
    user.is_instance_admin = True
    user.totp_enabled = totp
    db_session.add(user)
    db_session.commit()


def _policy(client: TestClient) -> dict:
    return client.get("/api/v1/instance/policy").json()


def _pin(monkeypatch: pytest.MonkeyPatch, mode: str | None, max_orgs: int | None = None) -> None:
    monkeypatch.setattr(settings, "TENANCY_MODE", mode)
    monkeypatch.setattr(settings, "TENANCY_MAX_ORGANIZATIONS", max_orgs)


def test_a_fresh_deployment_is_managed_with_one_organization(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Drop conftest's "open" stand-in: no env pin, no stored row.
    monkeypatch.undo()
    _pin(monkeypatch, None)
    monkeypatch.setattr(settings, "ORG_CREATION_DOMAIN_POLICY_ENABLED", False)
    assert _policy(client) == {
        "tenancy_mode": "managed",
        "can_found_organization": False,
        "password_reset_available": False,
        "email_invitations_available": False,
        "password_min_length": 8,
        "password_reject_personal": False,
        "assistant_enabled": False,
        "surface": "internal",
    }
    assert _signup(client, "a@acme.com", "Acme").status_code == 403

    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    assert client.get("/api/v1/instance/settings").json() == {
        "tenancy_mode": "managed",
        "max_organizations": 1,
        "pinned_by_env": False,
        "organization_count": 0,
    }


def test_open_without_a_rule(client: TestClient) -> None:
    assert _policy(client) == {
        "tenancy_mode": "open",
        "can_found_organization": True,
        "password_reset_available": False,
        "email_invitations_available": False,
        "password_min_length": 8,
        "password_reject_personal": False,
        "assistant_enabled": False,
        "surface": "internal",
    }
    assert _signup(client, "a@acme.com", "Acme").status_code == 201
    assert _found(client, "Acme Two").status_code == 201


def test_single_lets_the_first_organization_through_then_closes(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, "single")
    assert _policy(client)["can_found_organization"] is True
    assert _signup(client, "a@acme.com", "Acme").status_code == 201

    assert _policy(client) == {
        "tenancy_mode": "single",
        "can_found_organization": False,
        "password_reset_available": False,
        "email_invitations_available": False,
        "password_min_length": 8,
        "password_reject_personal": False,
        "assistant_enabled": False,
        "surface": "internal",
    }
    assert client.get("/api/v1/auth/me").json()["can_found_organization"] is False
    refused = _found(client, "Acme Two")
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "TENANCY_SINGLE_EXISTS"
    with TestClient(app) as other:
        refused = _signup(other, "b@globex.com", "Globex")
        assert refused.status_code == 403
        assert refused.json()["error"]["code"] == "TENANCY_SINGLE_EXISTS"
    # The refused signup created no account either.
    with TestClient(app) as other:
        _register(other, "b@globex.com")


def test_managed_refuses_self_service_founding(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, "managed")
    assert _policy(client) == {
        "tenancy_mode": "managed",
        "can_found_organization": False,
        "password_reset_available": False,
        "email_invitations_available": False,
        "password_min_length": 8,
        "password_reject_personal": False,
        "assistant_enabled": False,
        "surface": "internal",
    }
    refused = _signup(client, "a@acme.com", "Acme")
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "TENANCY_MANAGED_ONLY"
    _register(client, "a@acme.com")
    assert _found(client, "Acme").json()["error"]["code"] == "TENANCY_MANAGED_ONLY"


def test_open_with_a_cap(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _pin(monkeypatch, "open", 1)
    assert _signup(client, "a@acme.com", "Acme").status_code == 201
    refused = _found(client, "Acme Two")
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "TENANCY_ORG_LIMIT"


def test_the_instance_admin_creates_subsidiaries_in_managed_mode(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, "managed", 2)
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    with TestClient(app) as other:
        _register(other, "ciso@iberia.acme.com")
    with TestClient(app) as other:
        _register(other, "ciso@mexico.acme.com")

    created = client.post(
        "/api/v1/instance/organizations",
        json={"name": "Acme Iberia", "program_manager_email": "ciso@iberia.acme.com"},
        headers=_csrf(client),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["domain"] == "iberia.acme.com"
    assert body["program_manager_count"] == 1
    in_org = OrganizationMembership.organization_id == body["id"]
    roles = {m.role for m in db_session.exec(select(OrganizationMembership).where(in_org))}
    assert roles == {OrgRoleEnum.PROGRAM_MANAGER, OrgRoleEnum.PLANNER}

    assert (
        client.post(
            "/api/v1/instance/organizations",
            json={"name": "Acme Mexico", "program_manager_email": "ciso@mexico.acme.com"},
            headers=_csrf(client),
        ).status_code
        == 201
    )
    capped = client.post(
        "/api/v1/instance/organizations",
        json={"name": "Acme Three", "program_manager_email": "ciso@mexico.acme.com"},
        headers=_csrf(client),
    )
    assert capped.status_code == 409
    assert capped.json()["error"]["code"] == "TENANCY_ORG_LIMIT"

    def names(query: str = "") -> list[str]:
        response = client.get(f"/api/v1/instance/organizations{query}").json()
        return [o["name"] for o in response["items"]]

    # Newest first, like every table; by name on request; searched by name or domain.
    assert names() == ["Acme Mexico", "Acme Iberia"]
    assert names("?sort_by=name&sort_dir=asc") == ["Acme Iberia", "Acme Mexico"]
    assert names("?q=iberia") == ["Acme Iberia"]


def test_creating_for_an_unknown_account_is_refused(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    response = client.post(
        "/api/v1/instance/organizations",
        json={"name": "Acme", "program_manager_email": "nobody@acme.com"},
        headers=_csrf(client),
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "USER_NOT_FOUND"


def test_settings_from_the_web(client: TestClient, db_session: Session) -> None:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    assert client.get("/api/v1/instance/settings").json() == {
        "tenancy_mode": "open",
        "max_organizations": None,
        "pinned_by_env": False,
        "organization_count": 0,
    }

    response = client.put(
        "/api/v1/instance/settings",
        json={"tenancy_mode": "managed", "max_organizations": 5},
        headers=_csrf(client),
    )
    assert response.status_code == 200, response.text
    assert response.json()["tenancy_mode"] == "managed"
    stored = db_session.get(InstanceSettings, 1)
    assert stored.tenancy_mode == "managed"
    assert stored.updated_at is not None and stored.updated_at.tzinfo is not None
    assert _policy(client) == {
        "tenancy_mode": "managed",
        "can_found_organization": False,
        "password_reset_available": False,
        "email_invitations_available": False,
        "password_min_length": 8,
        "password_reject_personal": False,
        "assistant_enabled": False,
        "surface": "internal",
    }


def test_settings_pinned_by_the_environment_are_read_only(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, "single")
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    assert client.get("/api/v1/instance/settings").json()["pinned_by_env"] is True
    response = client.put(
        "/api/v1/instance/settings", json={"tenancy_mode": "open"}, headers=_csrf(client)
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TENANCY_PINNED_BY_ENV"


def test_platform_needs_an_instance_admin_with_totp(
    client: TestClient, db_session: Session
) -> None:
    assert _signup(client, "pm@acme.com", "Acme").status_code == 201
    denied = client.get("/api/v1/instance/settings")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "INSTANCE_ADMIN_REQUIRED"
    assert client.get("/api/v1/auth/me").json()["is_instance_admin"] is False

    _make_admin(db_session, "pm@acme.com", totp=False)
    no_totp = client.get("/api/v1/instance/organizations")
    assert no_totp.status_code == 403
    assert no_totp.json()["error"]["code"] == "MFA_REQUIRED"


def test_newcomers_find_their_organization_by_domain(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert _signup(client, "pm@acme.com", "Acme").status_code == 201
    pm = db_session.exec(select(User).where(User.email == "pm@acme.com")).one()
    pm.totp_enabled = True
    db_session.add(pm)
    db_session.commit()
    org_id = client.get("/api/v1/organizations/mine").json()["items"][0]["organization_id"]
    accounts_url = f"/api/v1/organizations/{org_id}/domain-accounts"
    with TestClient(app) as newcomer:
        _register(newcomer, "new@acme.com")
        with TestClient(app) as outsider:
            _register(outsider, "someone@globex.com")
        # "open": anyone can claim a domain, so nothing is revealed.
        assert newcomer.get("/api/v1/instance/domain-organizations").json() == {"items": []}
        assert client.get(accounts_url).json() == {"items": []}

        _pin(monkeypatch, "single")
        [org] = newcomer.get("/api/v1/instance/domain-organizations").json()["items"]
        assert org == {"id": org_id, "name": "Acme"}

    # Only the newcomer: not the Program Manager (holds a role), not the
    # outsider (another domain).
    [account] = client.get(accounts_url).json()["items"]
    assert account["email"] == "new@acme.com"


def test_an_address_still_to_confirm_waits_to_be_found_by_domain(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert _signup(client, "pm@acme.com", "Acme").status_code == 201
    pm = db_session.exec(select(User).where(User.email == "pm@acme.com")).one()
    pm.totp_enabled = True
    db_session.add(pm)
    db_session.commit()
    org_id = client.get("/api/v1/organizations/mine").json()["items"][0]["organization_id"]
    _pin(monkeypatch, "single")
    with TestClient(app) as newcomer:
        _register(newcomer, "new@acme.com")
    account = db_session.exec(select(User).where(User.email == "new@acme.com")).one()
    account.email_verification_required = True
    db_session.add(account)
    db_session.commit()

    def found() -> list[str]:
        items = client.get(f"/api/v1/organizations/{org_id}/domain-accounts").json()["items"]
        return [item["email"] for item in items]

    # Without email the account can't confirm, and nothing holds it back.
    assert found() == ["new@acme.com"]

    monkeypatch.setattr(account_email_service, "available", lambda session: True)
    assert found() == []

    account.email_verified_at = datetime.now(UTC)
    db_session.add(account)
    db_session.commit()
    assert found() == ["new@acme.com"]


def test_deleting_an_instance_admin_drops_the_grant(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    with TestClient(app) as second:
        _register(second, "ops2@acme.com")
        _make_admin(db_session, "ops2@acme.com")
        assert client.get("/api/v1/auth/me").json()["is_last_instance_admin"] is False

        deleted = second.request(
            "DELETE",
            "/api/v1/auth/me",
            json={"confirmation": "delete my account"},
            headers=_csrf(second),
        )
        assert deleted.status_code == 204, deleted.text

    db_session.expire_all()
    gone = db_session.exec(select(User).where(User.full_name == "Deleted user")).one()
    assert gone.is_instance_admin is False
    assert client.get("/api/v1/auth/me").json()["is_last_instance_admin"] is True


def _stale_sign_in(db_session: Session, email: str) -> None:
    user = db_session.exec(select(User).where(User.email == email)).one()
    for user_session in db_session.exec(select(UserSession).where(UserSession.user_id == user.id)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()


def test_platform_manages_an_organization_with_step_up_only_to_delete(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch, "managed")
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    for email in ("ciso@acme.com", "deputy@acme.com"):
        with TestClient(app) as other:
            _register(other, email)
    # Long after sign-in: only the delete asks to confirm it's you.
    _stale_sign_in(db_session, "ops@acme.com")

    created = client.post(
        "/api/v1/instance/organizations",
        json={"name": "Acme", "program_manager_email": "ciso@acme.com"},
        headers=_csrf(client),
    )
    assert created.status_code == 201, created.text
    org_id = created.json()["id"]
    managers_url = f"/api/v1/instance/organizations/{org_id}/program-managers"

    granted = client.post(managers_url, json={"email": "deputy@acme.com"}, headers=_csrf(client))
    assert granted.status_code == 201, granted.text
    assert {m["email"] for m in granted.json()["items"]} == {"ciso@acme.com", "deputy@acme.com"}

    ciso = db_session.exec(select(User).where(User.email == "ciso@acme.com")).one()
    revoked = client.delete(f"{managers_url}/{ciso.id}", headers=_csrf(client))
    assert revoked.status_code == 200, revoked.text
    [last] = revoked.json()["items"]
    last_id = last["user_id"]
    refused = client.delete(f"{managers_url}/{last_id}", headers=_csrf(client))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "LAST_PROGRAM_MANAGER"

    renamed = client.patch(
        f"/api/v1/instance/organizations/{org_id}",
        json={"domain": "Acme-Group.com"},
        headers=_csrf(client),
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["domain"] == "acme-group.com"
    allowed = {
        d.domain
        for d in db_session.exec(
            select(OrganizationAllowedDomain).where(
                OrganizationAllowedDomain.organization_id == org_id
            )
        )
    }
    # The new domain joins the allowlist; the old one stays.
    assert allowed == {"acme.com", "acme-group.com"}

    org_url = f"/api/v1/instance/organizations/{org_id}"
    stale = client.delete(org_url, headers=_csrf(client))
    assert stale.status_code == 403
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    admin = db_session.exec(select(User).where(User.email == "ops@acme.com")).one()
    for user_session in db_session.exec(select(UserSession).where(UserSession.user_id == admin.id)):
        user_session.authenticated_at = datetime.now(UTC)
        db_session.add(user_session)
    db_session.commit()
    deleted = client.delete(org_url, headers=_csrf(client))
    assert deleted.status_code == 204, deleted.text
    db_session.expire_all()
    assert db_session.get(Organization, org_id) is None


def test_platform_organization_routes_need_an_instance_admin(
    client: TestClient, db_session: Session
) -> None:
    assert _signup(client, "pm@acme.com", "Acme").status_code == 201
    pm = db_session.exec(select(User).where(User.email == "pm@acme.com")).one()
    pm.totp_enabled = True
    db_session.add(pm)
    db_session.commit()
    org_id = client.get("/api/v1/organizations/mine").json()["items"][0]["organization_id"]
    base = f"/api/v1/instance/organizations/{org_id}"
    # Its own Program Manager isn't the deployment's operator.
    for response in (
        client.patch(base, json={"domain": "evil.com"}, headers=_csrf(client)),
        client.delete(base, headers=_csrf(client)),
        client.get(f"{base}/program-managers"),
        client.post(
            f"{base}/program-managers", json={"email": "x@acme.com"}, headers=_csrf(client)
        ),
    ):
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "INSTANCE_ADMIN_REQUIRED"
