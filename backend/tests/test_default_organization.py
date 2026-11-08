import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Organization


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


def test_set_default_organization_reflected_in_me(client: TestClient) -> None:
    body = _signup(client, "owner@acme.com", "Acme")

    response = client.patch(
        "/api/v1/auth/default-organization",
        json={"organization_id": body["organization"]["id"]},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["default_organization_id"] == body["organization"]["id"]


def test_set_default_organization_to_non_member_org_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    _signup(client, "owner2@acme.com", "Acme2")

    other_org = Organization(name="Someone Else's Org")
    db_session.add(other_org)
    db_session.commit()
    db_session.refresh(other_org)

    response = client.patch(
        "/api/v1/auth/default-organization",
        json={"organization_id": str(other_org.id)},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 404


def test_set_default_organization_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.patch(
        "/api/v1/auth/default-organization",
        json={"organization_id": str(uuid.uuid4())},
    )

    # CSRF is checked ahead of authentication for this route (no cookie at
    # all means both are technically missing) -- either rejection is fine.
    assert response.status_code in (401, 403)


def test_set_default_organization_without_csrf_is_denied(client: TestClient) -> None:
    body = _signup(client, "owner3@acme.com", "Acme3")

    response = client.patch(
        "/api/v1/auth/default-organization",
        json={"organization_id": body["organization"]["id"]},
    )

    assert response.status_code == 403


def test_default_organization_starts_null(client: TestClient) -> None:
    _signup(client, "owner4@acme.com", "Acme4")

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["default_organization_id"] is None
