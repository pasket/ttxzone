import uuid

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import User
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


def _planner_client_with_ttx(client: TestClient, db_session: Session, email: str, org: str) -> str:
    body = _signup(client, email, org)
    _enable_totp_with_secret(db_session, body["user"]["id"], pyotp.random_base32())
    created = client.post(
        "/api/v1/ttx",
        json={"name": "Ransomware Drill", "organization_id": body["organization"]["id"]},
        headers=_csrf_headers(client),
    )
    assert created.status_code == 201
    return created.json()["id"]


def test_planner_updates_ttx_name_and_description(client: TestClient, db_session: Session) -> None:
    ttx_id = _planner_client_with_ttx(client, db_session, "owner@acme.com", "Acme")

    response = client.patch(
        f"/api/v1/ttx/{ttx_id}",
        json={"name": "Updated Drill", "description": "New scope"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Updated Drill"
    assert body["description"] == "New scope"

    list_response = client.get("/api/v1/ttx")
    items = {item["id"]: item["name"] for item in list_response.json()["items"]}
    assert items[ttx_id] == "Updated Drill"


def test_update_ttx_rejects_empty_name(client: TestClient, db_session: Session) -> None:
    ttx_id = _planner_client_with_ttx(client, db_session, "owner2@acme.com", "Acme2")

    response = client.patch(
        f"/api/v1/ttx/{ttx_id}",
        json={"name": "", "description": None},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422


def test_update_ttx_without_access_is_denied(client: TestClient, db_session: Session) -> None:
    ttx_id = _planner_client_with_ttx(client, db_session, "owner3@acme.com", "Acme3")

    other = _signup(client, "owner4@acme.com", "Acme4")
    _enable_totp_with_secret(db_session, other["user"]["id"], pyotp.random_base32())

    response = client.patch(
        f"/api/v1/ttx/{ttx_id}",
        json={"name": "Hijacked", "description": None},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403


def test_update_ttx_without_csrf_is_denied(client: TestClient, db_session: Session) -> None:
    ttx_id = _planner_client_with_ttx(client, db_session, "owner5@acme.com", "Acme5")

    response = client.patch(
        f"/api/v1/ttx/{ttx_id}",
        json={"name": "Updated Drill", "description": None},
    )

    assert response.status_code == 403


def test_the_content_language_starts_as_the_creators_and_planners_change_it(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner@acme.com", "Acme")
    _enable_totp_with_secret(db_session, body["user"]["id"], pyotp.random_base32())
    created = client.post(
        "/api/v1/ttx",
        json={"name": "Simulacro", "organization_id": body["organization"]["id"]},
        headers={**_csrf_headers(client), "Accept-Language": "es-ES,es;q=0.9"},
    ).json()
    assert created["content_language"] == "es"

    url = f"/api/v1/ttx/{created['id']}"
    # Left out, it's kept.
    kept = client.patch(url, json={"name": "Simulacro"}, headers=_csrf_headers(client))
    assert kept.json()["content_language"] == "es"
    changed = client.patch(
        url, json={"name": "Drill", "content_language": "en"}, headers=_csrf_headers(client)
    )
    assert changed.json()["content_language"] == "en"
    refused = client.patch(
        url, json={"name": "Drill", "content_language": "fr"}, headers=_csrf_headers(client)
    )
    assert refused.status_code == 422
    chosen = client.post(
        "/api/v1/ttx",
        json={
            "name": "Drill",
            "organization_id": body["organization"]["id"],
            "content_language": "en",
        },
        headers={**_csrf_headers(client), "Accept-Language": "es"},
    )
    assert chosen.json()["content_language"] == "en"
