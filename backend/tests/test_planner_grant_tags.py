import uuid

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import MembershipTagAssignment, OrganizationMembership, OrgRoleEnum, User
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


def _enable_totp_with_secret(db_session: Session, user_id: str, secret: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    totp_service.store_secret(user, secret)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _signup_program_manager(
    client: TestClient, db_session: Session, email: str, org_name: str
) -> dict:
    """require_program_manager_org mandates TOTP for every Program Manager-gated
    action, same as _signup_planner in test_ttx_tag_assignment.py."""
    owner = _signup(client, email, org_name)
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, owner["user"]["id"], secret)
    return {**owner, "totp_secret": secret}


def _register_and_grant_planner(
    client: TestClient, db_session: Session, owner_headers: dict, organization_id: str, email: str
) -> str:
    """Creates a plain, unrelated account for `email` directly via the DB
    (grant_planner only needs an existing account to find, same pattern
    as test_planner_grant.py's own target-user setup -- going through
    POST /auth/register instead would set auth cookies for the new user on
    the shared TestClient cookie jar, silently hijacking the caller's own
    Program Manager session) and grants it Planner via the real endpoint --
    returns the new user's id."""
    target = User(email=email, hashed_password="unused", full_name="Grantee")
    db_session.add(target)
    db_session.commit()
    db_session.refresh(target)

    grant_response = client.post(
        f"{org_base(client)}/planners",
        json={"email": email},
        headers=owner_headers,
    )
    assert grant_response.status_code == 201
    assert grant_response.json()["tags"] == []
    return str(target.id)


def test_set_and_clear_tags_on_an_planner_grant(client: TestClient, db_session: Session) -> None:
    owner = _signup_program_manager(client, db_session, "owner1@acme.com", "Acme1")
    organization_id = owner["organization"]["id"]
    headers = _csrf_headers(client)

    user_id = _register_and_grant_planner(
        client, db_session, headers, organization_id, "grantee1@acme.com"
    )

    tag_id = client.post(
        f"/api/v1/organizations/{organization_id}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=headers,
    ).json()["id"]

    set_response = client.put(
        f"{org_base(client)}/planners/{user_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )
    assert set_response.status_code == 200
    assert [t["name"] for t in set_response.json()["tags"]] == ["Pilot"]

    list_response = client.get(f"{org_base(client)}/planners")
    matching = [item for item in list_response.json()["items"] if item["user_id"] == user_id]
    assert len(matching) == 1
    assert [t["name"] for t in matching[0]["tags"]] == ["Pilot"]

    clear_response = client.put(
        f"{org_base(client)}/planners/{user_id}/tags",
        json={"tag_ids": []},
        headers=headers,
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["tags"] == []


def test_set_tags_keeping_one_and_adding_another(client: TestClient, db_session: Session) -> None:
    owner = _signup_program_manager(client, db_session, "owner2@acme.com", "Acme2")
    organization_id = owner["organization"]["id"]
    headers = _csrf_headers(client)

    user_id = _register_and_grant_planner(
        client, db_session, headers, organization_id, "grantee2@acme.com"
    )

    tag_a = client.post(
        f"/api/v1/organizations/{organization_id}/tags",
        json={"name": "Kept", "color": "indigo"},
        headers=headers,
    ).json()["id"]
    tag_b = client.post(
        f"/api/v1/organizations/{organization_id}/tags",
        json={"name": "Added", "color": "rose"},
        headers=headers,
    ).json()["id"]

    first = client.put(
        f"{org_base(client)}/planners/{user_id}/tags",
        json={"tag_ids": [tag_a]},
        headers=headers,
    )
    assert first.status_code == 200

    second = client.put(
        f"{org_base(client)}/planners/{user_id}/tags",
        json={"tag_ids": [tag_a, tag_b]},
        headers=headers,
    )
    assert second.status_code == 200
    assert {t["name"] for t in second.json()["tags"]} == {"Kept", "Added"}


def test_set_tags_rejects_a_tag_id_from_another_organization(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup_program_manager(client, db_session, "owner3@acme.com", "Acme3")
    organization_id = owner["organization"]["id"]
    headers = _csrf_headers(client)

    user_id = _register_and_grant_planner(
        client, db_session, headers, organization_id, "grantee3@acme.com"
    )

    client.cookies.clear()
    other_owner = _signup_program_manager(client, db_session, "owner4@other.com", "Other4")
    foreign_tag_id = client.post(
        f"/api/v1/organizations/{other_owner['organization']['id']}/tags",
        json={"name": "Foreign", "color": "slate"},
        headers=_csrf_headers(client),
    ).json()["id"]

    client.cookies.clear()
    login_response = client.post(
        "/api/v1/auth/login", json={"email": "owner3@acme.com", "password": "Correcthorse123!"}
    )
    assert login_response.status_code == 200
    verify_response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={
            "mfa_pending_token": login_response.json()["mfa_pending_token"],
            "code": pyotp.TOTP(owner["totp_secret"]).now(),
        },
    )
    assert verify_response.status_code == 200

    response = client.put(
        f"{org_base(client)}/planners/{user_id}/tags",
        json={"tag_ids": [foreign_tag_id]},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 404


def test_set_tags_for_a_user_without_an_planner_grant_returns_404(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup_program_manager(client, db_session, "owner5@acme.com", "Acme5")
    organization_id = owner["organization"]["id"]
    headers = _csrf_headers(client)

    tag_id = client.post(
        f"/api/v1/organizations/{organization_id}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=headers,
    ).json()["id"]

    response = client.put(
        f"{org_base(client)}/planners/{uuid.uuid4()}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )
    assert response.status_code == 404


def test_set_planner_tags_requires_csrf(client: TestClient, db_session: Session) -> None:
    owner = _signup_program_manager(client, db_session, "owner6@acme.com", "Acme6")
    organization_id = owner["organization"]["id"]
    headers = _csrf_headers(client)

    user_id = _register_and_grant_planner(
        client, db_session, headers, organization_id, "grantee6@acme.com"
    )

    response = client.put(f"{org_base(client)}/planners/{user_id}/tags", json={"tag_ids": []})
    assert response.status_code == 403


def test_revoke_planner_cleans_up_tag_assignments(client: TestClient, db_session: Session) -> None:
    owner = _signup_program_manager(client, db_session, "owner7@acme.com", "Acme7")
    organization_id = owner["organization"]["id"]
    headers = _csrf_headers(client)

    user_id = _register_and_grant_planner(
        client, db_session, headers, organization_id, "grantee7@acme.com"
    )
    tag_id = client.post(
        f"/api/v1/organizations/{organization_id}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=headers,
    ).json()["id"]
    client.put(
        f"{org_base(client)}/planners/{user_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )

    membership_id = db_session.exec(
        select(OrganizationMembership.id).where(
            OrganizationMembership.user_id == uuid.UUID(user_id),
            OrganizationMembership.organization_id == uuid.UUID(organization_id),
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
        )
    ).one()
    assert (
        len(
            db_session.exec(
                select(MembershipTagAssignment).where(
                    MembershipTagAssignment.organization_membership_id == membership_id
                )
            ).all()
        )
        == 1
    )

    revoke_response = client.delete(f"{org_base(client)}/planners/{user_id}", headers=headers)
    assert revoke_response.status_code == 204

    remaining = db_session.exec(
        select(MembershipTagAssignment).where(
            MembershipTagAssignment.organization_membership_id == membership_id
        )
    ).all()
    assert remaining == []
