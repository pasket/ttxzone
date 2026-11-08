"""Each allowlisted domain says whether it applies to Program Manager grants,
Planner grants, or both -- and each grant checks only its own flag."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import User


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Owner"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _owner(client: TestClient, db_session: Session, suffix: str) -> str:
    owner = _signup(client, f"scope-owner{suffix}@acme.com", f"ScopeCo{suffix}")
    user = db_session.get(User, uuid.UUID(owner["user"]["id"]))
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    return owner["organization"]["id"]


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _account(db_session: Session, email: str) -> None:
    db_session.add(User(email=email, hashed_password="unused", full_name=email.split("@")[0]))
    db_session.commit()


def _add_domain(client: TestClient, org_id: str, domain: str, **scopes: bool):
    return client.post(
        f"/api/v1/organizations/{org_id}/allowed-domains",
        json={"domain": domain, **scopes},
        headers=_csrf(client),
    )


def _grant(client: TestClient, org_id: str, kind: str, email: str):
    return client.post(
        f"/api/v1/organizations/{org_id}/{kind}", json={"email": email}, headers=_csrf(client)
    )


def test_new_domains_default_to_planners_only(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session, "1")

    created = _add_domain(client, org_id, "managers-default.com")

    assert created.status_code == 201
    # Program Manager is opt-in per domain.
    assert created.json()["allows_program_manager"] is False
    assert created.json()["allows_planner"] is True
    # The org's own domain, seeded at signup, is the exception: both.
    seeded = client.get(f"/api/v1/organizations/{org_id}/allowed-domains").json()["items"]
    own = next(item for item in seeded if item["domain"] == "acme.com")
    assert (own["allows_program_manager"], own["allows_planner"]) == (True, True)


def test_planner_only_domain(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session, "2")
    _add_domain(client, org_id, "managers.com", allows_program_manager=False)
    _account(db_session, "m1@managers.com")
    _account(db_session, "m2@managers.com")

    manager = _grant(client, org_id, "planners", "m1@managers.com")
    program_manager = _grant(client, org_id, "program-managers", "m2@managers.com")

    assert manager.status_code == 201
    assert program_manager.status_code == 403
    assert program_manager.json()["error"]["code"] == "DOMAIN_NOT_ALLOWED"
    assert "Program Managers" in program_manager.json()["error"]["message"]


def test_program_manager_only_domain(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session, "3")
    _add_domain(client, org_id, "admins.com", allows_program_manager=True, allows_planner=False)
    _account(db_session, "a1@admins.com")
    _account(db_session, "a2@admins.com")

    program_manager = _grant(client, org_id, "program-managers", "a1@admins.com")
    manager = _grant(client, org_id, "planners", "a2@admins.com")

    assert program_manager.status_code == 201
    assert manager.status_code == 403
    assert "Planners" in manager.json()["error"]["message"]


def test_a_domain_must_allow_something(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session, "4")

    response = _add_domain(
        client, org_id, "nothing.com", allows_program_manager=False, allows_planner=False
    )

    assert response.status_code == 422


def test_edit_a_domains_scopes(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session, "5")
    domain_id = _add_domain(client, org_id, "editable.com").json()["id"]
    _account(db_session, "e1@editable.com")
    url = f"/api/v1/organizations/{org_id}/allowed-domains/{domain_id}"

    updated = client.patch(
        url, json={"allows_program_manager": False, "allows_planner": True}, headers=_csrf(client)
    )

    assert updated.status_code == 200
    assert (updated.json()["allows_program_manager"], updated.json()["allows_planner"]) == (
        False,
        True,
    )
    assert _grant(client, org_id, "program-managers", "e1@editable.com").status_code == 403

    rejected = client.patch(
        url, json={"allows_program_manager": False, "allows_planner": False}, headers=_csrf(client)
    )
    assert rejected.status_code == 422


def test_cannot_edit_another_organizations_domain(client: TestClient, db_session: Session) -> None:
    other_org = _owner(client, db_session, "6")
    foreign_id = _add_domain(client, other_org, "foreign.com").json()["id"]

    client.cookies.clear()
    org_id = _owner(client, db_session, "7")

    response = client.patch(
        f"/api/v1/organizations/{org_id}/allowed-domains/{foreign_id}",
        json={"allows_program_manager": True, "allows_planner": False},
        headers=_csrf(client),
    )

    assert response.status_code == 404
