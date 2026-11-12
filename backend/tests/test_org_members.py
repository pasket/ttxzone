"""Admin -> Users and roles: one row per person with every grant they hold
in the organization, and per-person tags."""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import MembershipTagAssignment, OrganizationMembership, OrgRoleEnum, User
from tests.test_planner_grant import _csrf_headers, _enable_totp, _signup

# Grants straight to other domains: see conftest.direct_grants.
pytestmark = pytest.mark.usefixtures("direct_grants")


def _account(db_session: Session, email: str, name: str, last_login: datetime | None = None):
    user = User(email=email, hashed_password="unused", full_name=name, last_login_at=last_login)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _grant(client: TestClient, org_id: str, segment: str, email: str) -> None:
    response = client.post(
        f"/api/v1/organizations/{org_id}/{segment}",
        json={"email": email},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 201, response.text


def _setup(client: TestClient, db_session: Session) -> str:
    """Founder Ada (Program Manager + Planner), Bea (Planner + Observer),
    Cy (Evaluator, never logged in)."""
    owner = _signup(client, "ada@acme.com", "Acme")
    _enable_totp(db_session, owner["user"]["id"])
    org_id = owner["organization"]["id"]
    _account(db_session, "bea@acme.com", "Bea", datetime(2026, 9, 1, tzinfo=UTC))
    _account(db_session, "cy@outside.org", "Cy")
    _grant(client, org_id, "planners", "bea@acme.com")
    _grant(client, org_id, "observers", "bea@acme.com")
    _grant(client, org_id, "evaluators", "cy@outside.org")
    return org_id


def _members(client: TestClient, org_id: str, **params) -> dict:
    response = client.get(f"/api/v1/organizations/{org_id}/members", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_one_row_per_person_with_every_grant(client: TestClient, db_session: Session) -> None:
    org_id = _setup(client, db_session)

    body = _members(client, org_id, sort_by="name", sort_dir="asc")

    assert [(m["full_name"], sorted(m["roles"])) for m in body["items"]] == [
        ("Ada", ["planner", "program_manager"]),
        ("Bea", ["observer", "planner"]),
        ("Cy", ["evaluator"]),
    ]
    assert body["total"] == 3
    assert body["role_counts"] == {
        "program_manager": 1,
        "planner": 2,
        "observer": 1,
        "evaluator": 1,
    }


def test_search_role_filter_sort_and_pages(client: TestClient, db_session: Session) -> None:
    org_id = _setup(client, db_session)

    planners = _members(client, org_id, role="planner", sort_by="name", sort_dir="desc")
    found = _members(client, org_id, q="outside")
    by_login = _members(client, org_id, sort_by="last_login", sort_dir="asc")
    page = _members(client, org_id, limit=2, offset=2, sort_by="name", sort_dir="asc")

    assert [m["full_name"] for m in planners["items"]] == ["Bea", "Ada"]
    assert planners["total"] == 2
    # Counts stay the organization's, whatever the filter.
    assert planners["role_counts"]["evaluator"] == 1
    assert [m["full_name"] for m in found["items"]] == ["Cy"]
    # Never logged in is the least recent.
    assert by_login["items"][0]["full_name"] == "Cy"
    assert [m["full_name"] for m in page["items"]] == ["Cy"]
    assert page["total"] == 3


def test_tags_are_per_person(client: TestClient, db_session: Session) -> None:
    org_id = _setup(client, db_session)
    headers = _csrf_headers(client)
    tag_id = client.post(
        f"/api/v1/organizations/{org_id}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=headers,
    ).json()["id"]
    bea = db_session.exec(select(User).where(User.email == "bea@acme.com")).one()

    response = client.put(
        f"/api/v1/organizations/{org_id}/members/{bea.id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert [t["name"] for t in response.json()] == ["Pilot"]
    grants = db_session.exec(
        select(OrganizationMembership.id).where(OrganizationMembership.user_id == bea.id)
    ).all()
    tagged = db_session.exec(
        select(MembershipTagAssignment.organization_membership_id).where(
            MembershipTagAssignment.organization_membership_id.in_(grants)
        )
    ).all()
    assert sorted(tagged) == sorted(grants)  # both of Bea's grants
    row = next(m for m in _members(client, org_id)["items"] if m["full_name"] == "Bea")
    assert [t["name"] for t in row["tags"]] == ["Pilot"]

    unknown = client.put(
        f"/api/v1/organizations/{org_id}/members/{uuid.uuid4()}/tags",
        json={"tag_ids": []},
        headers=headers,
    )
    assert unknown.json()["error"]["code"] == "MEMBER_NOT_FOUND"


def test_only_the_organizations_program_managers(client: TestClient, db_session: Session) -> None:
    org_id = _setup(client, db_session)
    other_client = TestClient(app)
    other = _signup(other_client, "zed@other.com", "Other")
    _enable_totp(db_session, other["user"]["id"])

    with other_client:
        denied = other_client.get(f"/api/v1/organizations/{org_id}/members")
        own = other_client.get(f"/api/v1/organizations/{other['organization']['id']}/members")

    assert denied.status_code == 403
    assert [m["email"] for m in own.json()["items"]] == ["zed@other.com"]
    assert OrgRoleEnum.PLANNER.value in own.json()["items"][0]["roles"]
