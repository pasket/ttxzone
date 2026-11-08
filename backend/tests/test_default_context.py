import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import TTX, RoleEnum, TTXAccess, User


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _setup(client: TestClient, db_session: Session, suffix: str) -> tuple[str, str, str, str]:
    """Owner is Program Manager of their org, Player of one exercise there
    and Planner (per-TTX Planner) of another."""
    owner = _signup(client, f"dc-owner{suffix}@acme.com", f"DefaultCo{suffix}")
    user_id = uuid.UUID(owner["user"]["id"])
    org_id = owner["organization"]["id"]
    played = TTX(name="Played", organization_id=uuid.UUID(org_id), created_by_id=user_id)
    managed = TTX(name="Managed", organization_id=uuid.UUID(org_id), created_by_id=user_id)
    db_session.add_all([played, managed])
    db_session.commit()
    db_session.add_all(
        [
            TTXAccess(user_id=user_id, ttx_id=played.id, role=RoleEnum.PLAYER),
            TTXAccess(user_id=user_id, ttx_id=managed.id, role=RoleEnum.PLANNER, plans=True),
        ]
    )
    db_session.commit()
    return owner["user"]["id"], org_id, str(played.id), str(managed.id)


def _put(client: TestClient, body: dict):
    return client.put("/api/v1/auth/default-context", json=body, headers=_csrf(client))


def test_save_and_read_back_a_full_default_context(client: TestClient, db_session: Session) -> None:
    _, org_id, played_id, _ = _setup(client, db_session, "1")

    response = _put(client, {"organization_id": org_id, "role": "player", "ttx_id": played_id})

    assert response.status_code == 204
    me = client.get("/api/v1/auth/me").json()
    assert me["default_organization_id"] == org_id
    assert me["default_role"] == "player"
    assert me["default_ttx_id"] == played_id


def test_program_manager_default_has_no_exercise(client: TestClient, db_session: Session) -> None:
    _, org_id, played_id, _ = _setup(client, db_session, "2")

    assert _put(client, {"organization_id": org_id, "role": "program_manager"}).status_code == 204
    rejected = _put(
        client, {"organization_id": org_id, "role": "program_manager", "ttx_id": played_id}
    )
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "INVALID_DEFAULT_CONTEXT"


def test_rejects_an_exercise_not_held_with_that_role(
    client: TestClient, db_session: Session
) -> None:
    _, org_id, played_id, managed_id = _setup(client, db_session, "3")

    # "Played" is a Player exercise, not a Planner one.
    wrong_role = _put(client, {"organization_id": org_id, "role": "planner", "ttx_id": played_id})
    assert wrong_role.status_code == 404
    assert wrong_role.json()["error"]["code"] == "TTX_NOT_FOUND"
    ok = _put(client, {"organization_id": org_id, "role": "planner", "ttx_id": managed_id})
    assert ok.status_code == 204


def test_rejects_incomplete_or_foreign_combinations(
    client: TestClient, db_session: Session
) -> None:
    _, org_id, played_id, _ = _setup(client, db_session, "4")
    other = TestClient(client.app)
    foreign_org = _signup(other, "dc-foreign@other.com", "ForeignCo")["organization"]["id"]

    assert _put(client, {"role": "player"}).status_code == 400
    assert _put(client, {"organization_id": org_id, "ttx_id": played_id}).status_code == 400
    assert _put(client, {"organization_id": foreign_org}).status_code == 404


def test_role_not_held_is_rejected(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "dc-plain@acme.com", "PlainCo")

    response = _put(client, {"organization_id": owner["organization"]["id"], "role": "player"})

    assert response.status_code == 400


def test_clearing_everything_falls_back_to_first_available(
    client: TestClient, db_session: Session
) -> None:
    _, org_id, played_id, _ = _setup(client, db_session, "5")
    _put(client, {"organization_id": org_id, "role": "player", "ttx_id": played_id})

    assert _put(client, {}).status_code == 204

    me = client.get("/api/v1/auth/me").json()
    assert (me["default_organization_id"], me["default_role"], me["default_ttx_id"]) == (
        None,
        None,
        None,
    )


def test_changing_only_the_default_organization_clears_role_and_exercise(
    client: TestClient, db_session: Session
) -> None:
    user_id, org_id, played_id, _ = _setup(client, db_session, "6")
    _put(client, {"organization_id": org_id, "role": "player", "ttx_id": played_id})
    user = db_session.get(User, uuid.UUID(user_id))
    user.default_organization_id = None
    db_session.add(user)
    db_session.commit()

    response = client.patch(
        "/api/v1/auth/default-organization",
        json={"organization_id": org_id},
        headers=_csrf(client),
    )

    assert response.status_code == 204
    me = client.get("/api/v1/auth/me").json()
    assert me["default_role"] is None
    assert me["default_ttx_id"] is None
