"""GET /organizations/{organization_id}/planner-overview -- Creator's
organization-wide exercise counts for a Planner."""

import uuid
from datetime import UTC, datetime, timedelta

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import hash_password
from app.models import (
    TTX,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    User,
)
from app.services import totp_service


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Owner"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _user(db_session: Session, email: str, secret: str | None = None) -> User:
    user = User(
        email=email,
        hashed_password=hash_password("Correcthorse123!"),
        full_name=email.split("@")[0],
    )
    if secret:
        totp_service.store_secret(user, secret)
        user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _login(client: TestClient, email: str, secret: str) -> None:
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Correcthorse123!"})
    assert login.status_code == 200
    verify = client.post(
        "/api/v1/auth/login/verify-totp",
        json={
            "mfa_pending_token": login.json()["mfa_pending_token"],
            "code": pyotp.TOTP(secret).now(),
        },
    )
    assert verify.status_code == 200


def _grant_manager(db_session: Session, user: User, org_id: uuid.UUID) -> None:
    db_session.add(
        OrganizationMembership(user_id=user.id, organization_id=org_id, role=OrgRoleEnum.PLANNER)
    )
    db_session.commit()


def _setup(client: TestClient, db_session: Session, suffix: str) -> dict:
    """`me` (org Planner, signed in) owns "Mine", co-plans "Shared"
    (created by `other`), and has no access to "Theirs"; one player
    sits in two exercises."""
    owner = _signup(client, f"ov-owner{suffix}@acme.com", f"OvCo{suffix}")
    org_id = uuid.UUID(owner["organization"]["id"])
    client.cookies.clear()

    secret = pyotp.random_base32()
    me = _user(db_session, f"ov-me{suffix}@acme.com", secret)
    other = _user(db_session, f"ov-other{suffix}@acme.com")
    player = _user(db_session, f"ov-player{suffix}@ext.com")
    _grant_manager(db_session, me, org_id)
    _grant_manager(db_session, other, org_id)

    mine = TTX(name="Mine", organization_id=org_id, created_by_id=me.id)
    shared = TTX(name="Shared", organization_id=org_id, created_by_id=other.id)
    theirs = TTX(
        name="Theirs",
        organization_id=org_id,
        created_by_id=other.id,
        created_at=datetime.now(UTC) - timedelta(days=45),
    )
    db_session.add_all([mine, shared, theirs])
    db_session.commit()
    db_session.add_all(
        [
            TTXAccess(user_id=me.id, ttx_id=mine.id, role=RoleEnum.PLANNER, plans=True),
            TTXAccess(user_id=me.id, ttx_id=shared.id, role=RoleEnum.PLANNER, plans=True),
            TTXAccess(user_id=other.id, ttx_id=shared.id, role=RoleEnum.PLANNER, plans=True),
            TTXAccess(user_id=other.id, ttx_id=theirs.id, role=RoleEnum.PLANNER, plans=True),
            TTXAccess(user_id=player.id, ttx_id=shared.id, role=RoleEnum.PLAYER),
            TTXAccess(user_id=player.id, ttx_id=theirs.id, role=RoleEnum.PLAYER),
        ]
    )
    db_session.commit()
    _login(client, me.email, secret)
    return {"org_id": org_id, "me": me, "other": other}


def test_overview_counts_org_exercises_and_the_callers_share(
    client: TestClient, db_session: Session
) -> None:
    seeded = _setup(client, db_session, "-counts")

    response = client.get(f"/api/v1/organizations/{seeded['org_id']}/planner-overview")

    assert response.status_code == 200
    body = response.json()
    assert body["organization_name"] == "OvCo-counts"
    assert body["exercises"] == 3
    assert body["exercises_last_30_days"] == 2
    assert body["owned_by_you"] == 1
    assert body["co_planned_by_you"] == 1
    assert body["planners"] == 3  # the founder is an org Planner too
    assert body["unique_players"] == 1
    # The Program Manager's panels, over the caller's own exercises only:
    # never another manager's exercise names.
    mine = {e["name"]: e for e in body["my_exercises"]}
    assert set(mine) == {"Mine", "Shared"}
    assert (mine["Shared"]["players"], mine["Shared"]["planners"]) == (1, 2)
    assert "Theirs" not in response.text
    assert body["access_requests"] == {"approved": 0, "pending": 0, "rejected": 0}
    weeks = body["weekly_joins"]
    assert len(weeks) == 12
    # On those exercises: the Player, and the caller added to "Shared"
    # (each creator's own access isn't counted).
    assert (weeks[-1]["players"], weeks[-1]["team"]) == (1, 1)


def test_overview_for_manager_without_exercises(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "ov-empty-owner@acme.com", "OvEmpty")
    org_id = uuid.UUID(owner["organization"]["id"])
    client.cookies.clear()
    secret = pyotp.random_base32()
    me = _user(db_session, "ov-empty-me@acme.com", secret)
    _grant_manager(db_session, me, org_id)
    _login(client, me.email, secret)

    response = client.get(f"/api/v1/organizations/{org_id}/planner-overview")

    assert response.status_code == 200
    body = response.json()
    assert (body["exercises"], body["owned_by_you"], body["co_planned_by_you"]) == (0, 0, 0)
    assert body["planners"] == 2  # the founder is an org Planner too
    assert body["my_exercises"] == []
    assert [(w["players"], w["team"]) for w in body["weekly_joins"]] == [(0, 0)] * 12


def test_overview_denied_without_planner_membership(
    client: TestClient, db_session: Session
) -> None:
    seeded = _setup(client, db_session, "-deny")
    client.cookies.clear()
    intruder = _signup(client, "ov-intruder@other.com", "OvIntruder")
    intruder_user = db_session.get(User, uuid.UUID(intruder["user"]["id"]))
    intruder_user.totp_enabled = True
    db_session.add(intruder_user)
    db_session.commit()

    response = client.get(f"/api/v1/organizations/{seeded['org_id']}/planner-overview")

    assert response.status_code == 403


def test_overview_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/api/v1/organizations/{uuid.uuid4()}/planner-overview")

    assert response.status_code == 401
