"""Admin actions must land in the organization the caller selected, not in
whichever one the server would pick. Scenario:
Pat owns Abc, Sam owns Globex, Pat makes Sam a Program Manager of
Abc, and Sam -- with Abc selected -- adds a Planner. The grant has
to be created in Abc."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import OrganizationAllowedDomain, OrganizationMembership, OrgRoleEnum, User


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Owner"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _enable_totp(db_session: Session, user_id: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _two_org_program_manager(
    client: TestClient, db_session: Session
) -> tuple[TestClient, str, str]:
    """Returns (sam_client, abc_id, globex_id), with Sam Program Manager
    of both -- Globex first, so a "first membership" lookup picks Globex."""
    pat = _signup(client, "pat@abc-scope.com", "Abc")
    _enable_totp(db_session, pat["user"]["id"])
    abc_id = pat["organization"]["id"]

    sam_client = TestClient(app)
    sam = _signup(sam_client, "sam@globex-scope.com", "Globex")
    _enable_totp(db_session, sam["user"]["id"])
    globex_id = sam["organization"]["id"]

    # Pat allowlists Sam's domain in Abc and makes them Program Manager.
    assert (
        client.post(
            f"/api/v1/organizations/{abc_id}/allowed-domains",
            json={"domain": "globex-scope.com", "allows_program_manager": True},
            headers=_csrf(client),
        ).status_code
        == 201
    )
    assert (
        client.post(
            f"/api/v1/organizations/{abc_id}/program-managers",
            json={"email": "sam@globex-scope.com"},
            headers=_csrf(client),
        ).status_code
        == 201
    )
    return sam_client, abc_id, globex_id


def test_planner_grant_lands_in_the_selected_organization(
    client: TestClient, db_session: Session
) -> None:
    sam_client, abc_id, globex_id = _two_org_program_manager(client, db_session)
    new_manager = User(
        email="new-manager@globex-scope.com", hashed_password="unused", full_name="New"
    )
    db_session.add(new_manager)
    db_session.commit()

    with sam_client:
        response = sam_client.post(
            f"/api/v1/organizations/{abc_id}/planners",
            json={"email": "new-manager@globex-scope.com"},
            headers=_csrf(sam_client),
        )
        assert response.status_code == 201

        listed = sam_client.get(f"/api/v1/organizations/{abc_id}/planners").json()
        # Each founder is also a Planner of their own organization.
        assert [item["email"] for item in listed["items"]] == [
            "new-manager@globex-scope.com",
            "pat@abc-scope.com",
        ]
        other = sam_client.get(f"/api/v1/organizations/{globex_id}/planners").json()
        assert [item["email"] for item in other["items"]] == ["sam@globex-scope.com"]

    grant = db_session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == new_manager.id,
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
        )
    ).one()
    assert grant.organization_id == uuid.UUID(abc_id)


def test_allowed_domain_lands_in_the_selected_organization(
    client: TestClient, db_session: Session
) -> None:
    sam_client, abc_id, globex_id = _two_org_program_manager(client, db_session)

    with sam_client:
        response = sam_client.post(
            f"/api/v1/organizations/{abc_id}/allowed-domains",
            json={"domain": "partner-scope.com"},
            headers=_csrf(sam_client),
        )
        assert response.status_code == 201

    rows = db_session.exec(
        select(OrganizationAllowedDomain).where(
            OrganizationAllowedDomain.domain == "partner-scope.com"
        )
    ).all()
    assert [row.organization_id for row in rows] == [uuid.UUID(abc_id)]


def test_there_are_no_server_resolved_organization_routes(
    client: TestClient, db_session: Session
) -> None:
    """The server never infers which organization a Program Manager means:
    there are no /organizations/current/* or /organizations/planners
    routes that could silently act on the wrong org."""
    sam_client, _, _ = _two_org_program_manager(client, db_session)

    with sam_client:
        for path in (
            "/api/v1/organizations/current",
            "/api/v1/organizations/current/allowed-domains",
            "/api/v1/organizations/current/tags",
            "/api/v1/organizations/planners",
        ):
            response = sam_client.get(path)
            # "current"/"planners" isn't an organization id.
            assert response.status_code in (404, 422), path


def test_explicit_routes_reject_an_organization_the_caller_does_not_manage(
    client: TestClient, db_session: Session
) -> None:
    other = _signup(client, "owner@elsewhere-scope.com", "Elsewhere")
    other_id = other["organization"]["id"]

    client.cookies.clear()
    caller = _signup(client, "caller@caller-scope.com", "CallerCo")
    _enable_totp(db_session, caller["user"]["id"])

    assert client.get(f"/api/v1/organizations/{other_id}/planners").status_code == 403
    assert client.get(f"/api/v1/organizations/{other_id}/allowed-domains").status_code == 403
    grant = client.post(
        f"/api/v1/organizations/{other_id}/planners",
        json={"email": "caller@caller-scope.com"},
        headers=_csrf(client),
    )
    assert grant.status_code == 403
