"""Any signed-in account founds an organization of its own from the
avatar menu: it becomes its Program Manager and one of its Planners,
whatever roles it holds elsewhere."""

from datetime import UTC, datetime, timedelta

import dns.resolver
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import OrganizationMembership, OrgRoleEnum, PlatformAuditEvent, User, UserSession

PASSWORD = "Correcthorse123!"
FOUND_URL = "/api/v1/organizations/mine"


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _register(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Pat Player"},
    )
    assert response.status_code == 201, response.text


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    response = client.post(
        "/api/v1/organizations",
        json={
            "organization": {"name": org_name, "tax_id": None},
            "admin": {"email": email, "password": PASSWORD, "full_name": "Owner"},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _found(client: TestClient, name: str):
    return client.post(FOUND_URL, json={"name": name}, headers=_csrf(client))


def test_an_account_without_roles_founds_an_organization(client: TestClient) -> None:
    _register(client, "pat@globex.com")

    response = _found(client, "Globex Security")

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Globex Security"
    assert body["domain"] == "globex.com"
    [org] = client.get(FOUND_URL).json()["items"]
    assert org["organization_id"] == body["id"]
    assert org["is_program_manager"] is True
    assert org["is_planner"] is True


def test_a_program_manager_founds_a_second_organization(
    client: TestClient, db_session: Session
) -> None:
    first = _signup(client, "ana@initech.com", "Initech")

    response = _found(client, "Initech Labs")

    assert response.status_code == 201, response.text
    items = {item["organization_name"]: item for item in client.get(FOUND_URL).json()["items"]}
    assert set(items) == {"Initech", "Initech Labs"}
    assert items["Initech"]["organization_id"] == first["organization"]["id"]
    assert all(item["is_program_manager"] and item["is_planner"] for item in items.values())


def test_founding_needs_a_work_email(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ORG_CREATION_DOMAIN_POLICY_ENABLED", True)
    monkeypatch.setattr(dns.resolver.Resolver, "resolve", lambda self, domain, rtype: ["ok"])
    _register(client, "pat@gmail.com")

    response = _found(client, "Pat's Org")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "FREE_EMAIL_DOMAIN_BLOCKED"
    assert client.get(FOUND_URL).json()["items"] == []


def test_founding_stops_at_the_cap(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "MAX_ORGANIZATIONS_PER_PROGRAM_MANAGER", 2)
    _register(client, "max@umbrella.com")

    assert _found(client, "One").status_code == 201
    assert _found(client, "Two").status_code == 201
    third = _found(client, "Three")

    assert third.status_code == 409
    assert third.json()["error"]["code"] == "ORG_LIMIT_REACHED"
    assert len(client.get(FOUND_URL).json()["items"]) == 2


def test_founding_needs_csrf_but_no_step_up(client: TestClient, db_session: Session) -> None:
    _register(client, "late@hooli.com")
    user = db_session.exec(select(User).where(User.email == "late@hooli.com")).one()

    without_csrf = client.post(FOUND_URL, json={"name": "Hooli"})
    assert without_csrf.status_code == 403

    for user_session in db_session.exec(select(UserSession).where(UserSession.user_id == user.id)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()
    # A sign-in an hour old founds it: the activity log records who.
    founded = _found(client, "Hooli")

    assert founded.status_code == 201, founded.text
    assert (
        db_session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
            )
        ).first()
        is not None
    )
    assert db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "organization.create")
    ).first()
