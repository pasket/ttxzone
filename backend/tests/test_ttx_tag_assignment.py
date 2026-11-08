import uuid
from datetime import UTC, datetime, timedelta

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


def _signup_planner(
    client: TestClient, db_session: Session, email: str, org_name: str
) -> tuple[dict, str]:
    """A Program Manager-only owner cannot create a TTX (see
    test_ttx_create.py::test_program_manager_without_planner_membership_is_denied)
    and Planner-gated actions require TOTP to already be enrolled (see
    core/security.py's mandatory-MFA mandate), so every test here that needs
    POST /ttx or a PUT .../tags call grants Planner org-membership and
    enables TOTP (with a real secret, so a later re-login can complete the
    second factor) directly -- same shape as test_ttx_create.py's own
    reference tests. Returns the signup body plus the TOTP secret, since a
    caller that needs to log this user back in after switching sessions
    needs it to generate a valid code."""
    owner = _signup(client, email, org_name)
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, owner["user"]["id"], secret)
    return owner, secret


def _create_ttx(client: TestClient, organization_id: str, name: str = "Drill") -> str:
    response = client.post(
        "/api/v1/ttx",
        json={"name": name, "description": None, "organization_id": organization_id},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_tag(client: TestClient, ttx_id: str, name: str, color: str = "rose") -> str:
    response = client.post(
        f"/api/v1/ttx/{ttx_id}/tags",
        json={"name": name, "color": color},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_token(client: TestClient, ttx_id: str) -> str:
    response = client.post(
        f"/api/v1/ttx/{ttx_id}/invitation-tokens",
        json={
            "role": "player",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "max_uses": 1,
        },
        headers=_csrf_headers(client),
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_set_and_clear_tags_on_a_ttx(client: TestClient, db_session: Session) -> None:
    owner, _secret = _signup_planner(client, db_session, "owner1@acme.com", "Acme1")
    headers = _csrf_headers(client)
    ttx_id = _create_ttx(client, owner["organization"]["id"])
    tag_id = _create_tag(client, ttx_id, "Ransomware")

    set_response = client.put(
        f"/api/v1/ttx/{ttx_id}/tags/apply", json={"tag_ids": [tag_id]}, headers=headers
    )
    assert set_response.status_code == 200
    assert [t["name"] for t in set_response.json()["tags"]] == ["Ransomware"]

    list_response = client.get("/api/v1/ttx")
    assert [t["name"] for t in list_response.json()["items"][0]["tags"]] == ["Ransomware"]

    clear_response = client.put(
        f"/api/v1/ttx/{ttx_id}/tags/apply", json={"tag_ids": []}, headers=headers
    )
    assert clear_response.json()["tags"] == []


def test_set_tags_keeping_an_already_assigned_tag_and_adding_another(
    client: TestClient, db_session: Session
) -> None:
    """Re-saving with a tag_ids list that re-includes an already-assigned
    tag alongside a new one must not violate ttx_tag_assignment's
    UniqueConstraint: SQLAlchemy's unit of work flushes inserts before
    deletes by default, so set_ttx_tags can't rely on session.commit() to
    order its delete-old-rows / insert-new-rows pair."""
    owner, _secret = _signup_planner(client, db_session, "owner6@acme.com", "Acme6")
    headers = _csrf_headers(client)
    ttx_id = _create_ttx(client, owner["organization"]["id"])
    tag_a = _create_tag(client, ttx_id, "Kept", "indigo")
    tag_b = _create_tag(client, ttx_id, "Added")

    first = client.put(
        f"/api/v1/ttx/{ttx_id}/tags/apply", json={"tag_ids": [tag_a]}, headers=headers
    )
    assert first.status_code == 200

    second = client.put(
        f"/api/v1/ttx/{ttx_id}/tags/apply", json={"tag_ids": [tag_a, tag_b]}, headers=headers
    )
    assert second.status_code == 200
    assert {t["name"] for t in second.json()["tags"]} == {"Kept", "Added"}


def test_set_tags_on_an_invitation_token(client: TestClient, db_session: Session) -> None:
    owner, _secret = _signup_planner(client, db_session, "owner2@acme.com", "Acme2")
    headers = _csrf_headers(client)
    ttx_id = _create_ttx(client, owner["organization"]["id"])
    tag_id = _create_tag(client, ttx_id, "VIP", "indigo")
    token_id = _create_token(client, ttx_id)

    set_response = client.put(
        f"/api/v1/invitation-tokens/{token_id}/tags", json={"tag_ids": [tag_id]}, headers=headers
    )
    assert set_response.status_code == 200
    assert [t["name"] for t in set_response.json()["tags"]] == ["VIP"]

    list_response = client.get(f"/api/v1/ttx/{ttx_id}/invitation-tokens")
    assert [t["name"] for t in list_response.json()["items"][0]["tags"]] == ["VIP"]


def test_set_invitation_token_tags_keeping_one_and_adding_another(
    client: TestClient, db_session: Session
) -> None:
    """Same regression as test_set_tags_keeping_an_already_assigned_tag_and_adding_another,
    for set_invitation_token_tags -- the two functions share the identical
    delete-then-insert shape."""
    owner, _secret = _signup_planner(client, db_session, "owner7@acme.com", "Acme7")
    headers = _csrf_headers(client)
    ttx_id = _create_ttx(client, owner["organization"]["id"])
    tag_a = _create_tag(client, ttx_id, "Kept", "indigo")
    tag_b = _create_tag(client, ttx_id, "Added")
    token_id = _create_token(client, ttx_id)

    first = client.put(
        f"/api/v1/invitation-tokens/{token_id}/tags", json={"tag_ids": [tag_a]}, headers=headers
    )
    assert first.status_code == 200

    second = client.put(
        f"/api/v1/invitation-tokens/{token_id}/tags",
        json={"tag_ids": [tag_a, tag_b]},
        headers=headers,
    )
    assert second.status_code == 200
    assert {t["name"] for t in second.json()["tags"]} == {"Kept", "Added"}


def test_an_exercise_only_carries_its_own_tags(client: TestClient, db_session: Session) -> None:
    """Exercise tags belong to one exercise: another exercise's tag -- even
    in the same organization -- can't be applied to it or to its tokens."""
    owner, _secret = _signup_planner(client, db_session, "owner3@acme.com", "Acme3")
    headers = _csrf_headers(client)
    organization_id = owner["organization"]["id"]
    ttx_id = _create_ttx(client, organization_id, "Drill")
    other_ttx_id = _create_ttx(client, organization_id, "Other drill")
    foreign_tag_id = _create_tag(client, other_ttx_id, "Foreign", "slate")
    token_id = _create_token(client, ttx_id)

    response = client.put(
        f"/api/v1/ttx/{ttx_id}/tags/apply", json={"tag_ids": [foreign_tag_id]}, headers=headers
    )
    assert response.status_code == 404
    response = client.put(
        f"/api/v1/invitation-tokens/{token_id}/tags",
        json={"tag_ids": [foreign_tag_id]},
        headers=headers,
    )
    assert response.status_code == 404
    # Nor can it be edited through the wrong exercise.
    response = client.patch(
        f"/api/v1/ttx/{ttx_id}/tags/{foreign_tag_id}",
        json={"name": "Mine", "color": "slate"},
        headers=headers,
    )
    assert response.status_code == 404
