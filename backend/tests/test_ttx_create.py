import uuid

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import hash_password
from app.models import TTX, OrganizationMembership, OrgRoleEnum, RoleEnum, TTXAccess, User
from app.services import totp_service


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


def test_planner_with_totp_creates_ttx(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "owner@acme.com", "Acme")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, body["user"]["id"], secret)

    response = client.post(
        "/api/v1/ttx",
        json={
            "name": "Ransomware Drill",
            "description": "Q1 exercise",
            "organization_id": body["organization"]["id"],
        },
        headers=_csrf_headers(client),
    )

    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Ransomware Drill"
    assert created["organization_id"] == body["organization"]["id"]
    assert created["created_by_id"] == body["user"]["id"]
    assert created["role"] == "planner"

    list_response = client.get("/api/v1/ttx")
    assert list_response.status_code == 200
    items = {item["id"]: item["role"] for item in list_response.json()["items"]}
    assert items[created["id"]] == "planner"


def test_planner_without_totp_is_denied(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "owner2@acme.com", "Acme2")

    response = client.post(
        "/api/v1/ttx",
        json={"name": "Ransomware Drill", "organization_id": body["organization"]["id"]},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "MFA_REQUIRED"


def test_the_founder_is_program_manager_and_planner(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "founder@acme.com", "AcmeFounder")

    roles = set(
        db_session.exec(
            select(OrganizationMembership.role).where(
                OrganizationMembership.user_id == uuid.UUID(body["user"]["id"])
            )
        )
    )

    assert roles == {OrgRoleEnum.PROGRAM_MANAGER, OrgRoleEnum.PLANNER}


def test_program_manager_without_planner_membership_is_denied(
    client: TestClient, db_session: Session
) -> None:
    # A plain Program Manager -- no Planner membership -- can't create a
    # TTX; that capability belongs to Planner.
    body = _signup(client, "owner3super@acme.com", "AcmeSuper")
    for membership in db_session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == uuid.UUID(body["user"]["id"]),
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
        )
    ):
        db_session.delete(membership)
    db_session.commit()

    response = client.post(
        "/api/v1/ttx",
        json={"name": "Ransomware Drill", "organization_id": body["organization"]["id"]},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] != "MFA_REQUIRED"


def test_create_ttx_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.post(
        "/api/v1/ttx", json={"name": "Ransomware Drill", "organization_id": str(uuid.uuid4())}
    )

    assert response.status_code in (401, 403)


def test_create_ttx_without_csrf_is_denied(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "owner3@acme.com", "Acme3")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, body["user"]["id"], secret)

    response = client.post(
        "/api/v1/ttx",
        json={"name": "Ransomware Drill", "organization_id": body["organization"]["id"]},
    )

    assert response.status_code == 403


def test_ttx_access_holder_without_membership_is_denied(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner4@acme.com", "Acme4")
    ttx = TTX(
        name="Existing Drill",
        organization_id=owner["organization"]["id"],
        created_by_id=owner["user"]["id"],
    )
    db_session.add(ttx)
    db_session.commit()
    db_session.refresh(ttx)

    # A user with only a TTXAccess grant -- no OrganizationMembership at
    # all, unlike every _signup'd user (which always gets one for its own
    # fresh org) -- created directly rather than via signup/redeem.
    planner = User(
        email="eval@external.com",
        hashed_password=hash_password("Correcthorse123!"),
        full_name="Planner",
    )
    db_session.add(planner)
    db_session.commit()
    db_session.refresh(planner)
    db_session.add(TTXAccess(user_id=planner.id, ttx_id=ttx.id, role=RoleEnum.PLANNER, plans=True))
    db_session.commit()

    client.cookies.clear()
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "eval@external.com", "password": "Correcthorse123!"},
    )
    assert login_response.status_code == 200

    response = client.post(
        "/api/v1/ttx",
        json={"name": "Another Drill", "organization_id": owner["organization"]["id"]},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403


def test_create_ttx_rejects_empty_name(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "owner5@acme.com", "Acme5")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, body["user"]["id"], secret)

    response = client.post(
        "/api/v1/ttx",
        json={"name": "", "organization_id": body["organization"]["id"]},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422


def test_a_long_formatted_description_is_kept_up_to_its_limit(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner@acme.com", "Acme")
    _enable_totp_with_secret(db_session, body["user"]["id"], pyotp.random_base32())
    brief = "**Scope**\n\n- Ransomware on the OT network\n- _Crisis_ communication\n" * 100

    def create(description: str):
        return client.post(
            "/api/v1/ttx",
            json={
                "name": "Drill",
                "description": description,
                "organization_id": body["organization"]["id"],
            },
            headers=_csrf_headers(client),
        )

    created = create(brief)
    assert created.status_code == 201, created.text
    assert created.json()["description"] == brief
    assert create("x" * 10001).status_code == 422
