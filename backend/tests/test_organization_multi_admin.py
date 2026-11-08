import uuid

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import OrganizationMembership, OrgRoleEnum, User
from app.services import totp_service
from tests.org_paths import org_base


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _enable_totp_with_secret(db_session: Session, user_id: str, secret: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    totp_service.store_secret(user, secret)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _login_with_totp(client: TestClient, email: str, secret: str) -> None:
    """Full login + TOTP-verify round trip -- require_program_manager mandates
    TOTP for every Program Manager-gated action (see core/security.py), so a
    bare password login alone never reaches an authenticated session here."""
    login_response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Correcthorse123!"}
    )
    assert login_response.status_code == 200
    mfa_pending_token = login_response.json()["mfa_pending_token"]
    verify_response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token, "code": pyotp.TOTP(secret).now()},
    )
    assert verify_response.status_code == 200


def test_program_manager_of_two_orgs_sees_both_in_organizations_mine(
    client: TestClient, db_session: Session
) -> None:
    first = _signup(client, "multi-admin@acme.com", "FirstOrg")
    second = _signup(client, "multi-admin2@acme.com", "SecondOrg")

    # Grant the first user Program Manager on the second org too -- simulates
    # the "someone makes me program-manager of another org" scenario directly
    # via the membership table (no grant-program-manager endpoint exists yet;
    # this plan's scope is reading/editing/deleting whichever orgs a
    # Program Manager already holds, not adding a new grant flow).
    db_session.add(
        OrganizationMembership(
            user_id=uuid.UUID(first["user"]["id"]),
            organization_id=uuid.UUID(second["organization"]["id"]),
            role=OrgRoleEnum.PROGRAM_MANAGER,
        )
    )
    db_session.commit()

    client.cookies.clear()
    client.post(
        "/api/v1/auth/login", json={"email": "multi-admin@acme.com", "password": "Correcthorse123!"}
    )

    mine = client.get("/api/v1/organizations/mine")
    assert mine.status_code == 200
    org_ids = {item["organization_id"] for item in mine.json()["items"]}
    assert org_ids == {first["organization"]["id"], second["organization"]["id"]}
    for item in mine.json()["items"]:
        assert item["is_program_manager"] is True


def test_explicit_org_id_endpoint_lets_a_multi_org_program_manager_edit_the_second_org(
    client: TestClient, db_session: Session
) -> None:
    first = _signup(client, "multi-admin3@acme.com", "FirstOrg3")
    second = _signup(client, "multi-admin4@acme.com", "SecondOrg3")
    db_session.add(
        OrganizationMembership(
            user_id=uuid.UUID(first["user"]["id"]),
            organization_id=uuid.UUID(second["organization"]["id"]),
            role=OrgRoleEnum.PROGRAM_MANAGER,
        )
    )
    db_session.commit()
    first_secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, first["user"]["id"], first_secret)

    client.cookies.clear()
    _login_with_totp(client, "multi-admin3@acme.com", first_secret)
    headers = _csrf_headers(client)

    # /organizations/current would resolve to whichever membership sorts
    # first and can't be told to act on the second org -- the explicit-id
    # route is exactly what makes the second org reachable at all.
    response = client.patch(
        f"/api/v1/organizations/{second['organization']['id']}",
        json={"description": "Now editable", "tax_id": None, "alias": None},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Now editable"


def test_explicit_org_id_endpoint_rejects_a_non_program_manager(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "multi-admin5@acme.com", "FirstOrg5")
    _signup(client, "multi-admin6@acme.com", "OtherOrg5")

    client.cookies.clear()
    client.post(
        "/api/v1/auth/login",
        json={"email": "multi-admin6@acme.com", "password": "Correcthorse123!"},
    )
    headers = _csrf_headers(client)
    response = client.get(f"/api/v1/organizations/{owner['organization']['id']}", headers=headers)
    assert response.status_code == 403


def test_explicit_org_id_tags_endpoint_returns_the_organizations_tags(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "multi-admin7@acme.com", "FirstOrg7")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, owner["user"]["id"], secret)

    client.cookies.clear()
    _login_with_totp(client, "multi-admin7@acme.com", secret)
    headers = _csrf_headers(client)

    create_response = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=headers,
    )
    assert create_response.status_code == 201

    # This is the same route the Admin Organization table hits per row --
    # explicit-id, not /current, since a multi-org Program Manager's table
    # needs each row's own tags, not whichever org "current" resolves to.
    response = client.get(f"/api/v1/organizations/{owner['organization']['id']}/tags")
    assert response.status_code == 200
    names = {item["name"] for item in response.json()["items"]}
    assert names == {"Pilot"}


def test_explicit_org_id_tags_endpoint_rejects_a_non_program_manager(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "multi-admin8@acme.com", "FirstOrg8")
    _signup(client, "multi-admin9@acme.com", "OtherOrg8")

    client.cookies.clear()
    client.post(
        "/api/v1/auth/login",
        json={"email": "multi-admin9@acme.com", "password": "Correcthorse123!"},
    )
    headers = _csrf_headers(client)
    response = client.get(
        f"/api/v1/organizations/{owner['organization']['id']}/tags", headers=headers
    )
    assert response.status_code == 403


def test_explicit_org_id_tags_endpoint_lets_a_multi_org_program_manager_manage_the_second_orgs_tags(
    client: TestClient, db_session: Session
) -> None:
    first = _signup(client, "multi-admin10@acme.com", "FirstOrg10")
    second = _signup(client, "multi-admin11@acme.com", "SecondOrg10")
    db_session.add(
        OrganizationMembership(
            user_id=uuid.UUID(first["user"]["id"]),
            organization_id=uuid.UUID(second["organization"]["id"]),
            role=OrgRoleEnum.PROGRAM_MANAGER,
        )
    )
    db_session.commit()
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, first["user"]["id"], secret)

    client.cookies.clear()
    _login_with_totp(client, "multi-admin10@acme.com", secret)
    headers = _csrf_headers(client)
    second_org_id = second["organization"]["id"]

    # /organizations/current/tags would only ever reach the first org --
    # this is the only way a multi-org Program Manager can manage the second
    # org's own tags, which AdminOrganizationProfileSection's per-row
    # inline tag CRUD relies on.
    create_response = client.post(
        f"/api/v1/organizations/{second_org_id}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=headers,
    )
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/organizations/{second_org_id}/tags/{tag_id}",
        json={"name": "Pilot renamed", "color": "moss"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Pilot renamed"

    delete_response = client.delete(
        f"/api/v1/organizations/{second_org_id}/tags/{tag_id}", headers=headers
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["result"] == "deleted"
    assert client.get(f"/api/v1/organizations/{second_org_id}/tags").json()["items"] == []


def test_explicit_org_id_tags_mutation_routes_reject_a_non_program_manager(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "multi-admin12@acme.com", "FirstOrg12")
    _signup(client, "multi-admin13@acme.com", "OtherOrg12")

    client.cookies.clear()
    client.post(
        "/api/v1/auth/login",
        json={"email": "multi-admin13@acme.com", "password": "Correcthorse123!"},
    )
    headers = _csrf_headers(client)
    org_id = owner["organization"]["id"]

    create_response = client.post(
        f"/api/v1/organizations/{org_id}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=headers,
    )
    assert create_response.status_code == 403

    fake_tag_id = str(uuid.uuid4())
    assert (
        client.patch(
            f"/api/v1/organizations/{org_id}/tags/{fake_tag_id}",
            json={"name": "X", "color": "violet"},
            headers=headers,
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{org_id}/tags/{fake_tag_id}", headers=headers
        ).status_code
        == 403
    )


def test_explicit_org_id_tags_mutation_routes_require_csrf(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "multi-admin14@acme.com", "FirstOrg14")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, owner["user"]["id"], secret)

    client.cookies.clear()
    _login_with_totp(client, "multi-admin14@acme.com", secret)
    org_id = owner["organization"]["id"]

    response = client.post(
        f"/api/v1/organizations/{org_id}/tags", json={"name": "Pilot", "color": "violet"}
    )
    assert response.status_code == 403
