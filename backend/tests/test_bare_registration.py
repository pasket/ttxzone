import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import User


def test_register_bare_account_succeeds_with_no_org_or_role(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "solo@external.com", "password": "Correcthorse123!", "full_name": "Solo"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["mfa_required"] is False
    assert body["user"]["email"] == "solo@external.com"

    me_response = client.get("/api/v1/auth/me")
    assert me_response.status_code == 200
    me = me_response.json()
    assert me["is_program_manager"] is False
    assert me["is_planner"] is False

    ttx_response = client.get("/api/v1/ttx")
    assert ttx_response.status_code == 200
    assert ttx_response.json()["items"] == []

    organizations_response = client.get("/api/v1/organizations/mine")
    assert organizations_response.status_code == 200
    assert organizations_response.json()["items"] == []


def test_register_bare_account_duplicate_email_is_rejected(client: TestClient) -> None:
    payload = {
        "email": "dup-bare@external.com",
        "password": "Correcthorse123!",
        "full_name": "Dup",
    }
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    client.cookies.clear()
    second = client.post("/api/v1/auth/register", json=payload)

    assert second.status_code == 409
    assert second.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"


def test_register_bare_account_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "short@external.com", "password": "short1", "full_name": "Short"},
    )

    assert response.status_code == 422


def test_player_path_account_records_last_login(client: TestClient, db_session: Session) -> None:
    # A bare account is how a future Player starts (no org, no role).
    # last_login_at lives on User, so it's stamped for every role -- the
    # data is already there for a future players "Last login" column.
    payload = {"email": "future-p@external.com", "password": "Correcthorse123!", "full_name": "P"}
    registered = client.post("/api/v1/auth/register", json=payload).json()
    user_id = uuid.UUID(registered["user"]["id"])

    user = db_session.get(User, user_id)
    assert user.last_login_at is not None
    user.last_login_at = None
    db_session.add(user)
    db_session.commit()

    client.cookies.clear()
    login = client.post(
        "/api/v1/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert login.status_code == 200

    db_session.expire_all()
    assert db_session.get(User, user_id).last_login_at is not None
