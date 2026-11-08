"""GET /ttx/{ttx_id}/dashboard -- Creator's per-exercise aggregates."""

import uuid
from datetime import UTC, datetime, timedelta

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import hash_password
from app.models import (
    TTX,
    AccessRequestStatus,
    Inject,
    InvitationToken,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
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


def _now() -> datetime:
    return datetime.now(UTC)


def _setup(client: TestClient, db_session: Session, suffix: str) -> dict:
    """An exercise ("Drill") managed by `manager` (signed in on `client`)
    with 2 players, 2 injects, two invitation tokens and four access
    requests; a second exercise ("Other") in the same org that must not
    leak into Drill's figures."""
    owner = _signup(client, f"td-owner{suffix}@acme.com", f"TdCo{suffix}")
    org_id = uuid.UUID(owner["organization"]["id"])
    client.cookies.clear()

    secret = pyotp.random_base32()
    manager = _user(db_session, f"td-manager{suffix}@acme.com", secret)
    p1 = _user(db_session, f"td-p1{suffix}@ext.com")
    p2 = _user(db_session, f"td-p2{suffix}@ext.com")
    requester = _user(db_session, f"td-req{suffix}@ext.com")

    drill = TTX(name="Drill", organization_id=org_id, created_by_id=manager.id)
    other = TTX(name="Other", organization_id=org_id, created_by_id=manager.id)
    db_session.add_all([drill, other])
    db_session.commit()

    db_session.add_all(
        [
            TTXAccess(user_id=manager.id, ttx_id=drill.id, role=RoleEnum.PLANNER, plans=True),
            TTXAccess(user_id=p1.id, ttx_id=drill.id, role=RoleEnum.PLAYER),
            TTXAccess(user_id=p2.id, ttx_id=drill.id, role=RoleEnum.PLAYER),
            TTXAccess(user_id=p1.id, ttx_id=other.id, role=RoleEnum.PLAYER),
            Inject(ttx_id=drill.id, title="A", content="a", created_by_id=manager.id),
            Inject(ttx_id=drill.id, title="B", content="b", created_by_id=manager.id),
            Inject(ttx_id=other.id, title="C", content="c", created_by_id=manager.id),
        ]
    )
    live = InvitationToken(
        token=f"td-live{suffix}",
        ttx_id=drill.id,
        role=RoleEnum.PLAYER,
        description="Board members",
        created_by_id=manager.id,
        expires_at=_now() + timedelta(days=5),
        redemption_count=3,
        created_at=_now() - timedelta(days=1),
    )
    revoked = InvitationToken(
        token=f"td-revoked{suffix}",
        ttx_id=drill.id,
        role=RoleEnum.PLAYER,
        created_by_id=manager.id,
        expires_at=_now() + timedelta(days=5),
        revoked_at=_now(),
        redemption_count=1,
    )
    elsewhere = InvitationToken(
        token=f"td-other{suffix}",
        ttx_id=other.id,
        role=RoleEnum.PLAYER,
        created_by_id=manager.id,
        expires_at=_now() + timedelta(days=5),
        redemption_count=7,
    )
    db_session.add_all([live, revoked, elsewhere])
    db_session.commit()

    oldest_pending_at = _now() - timedelta(days=2)
    db_session.add_all(
        [
            TTXAccessRequest(
                ttx_id=drill.id,
                user_id=requester.id,
                role=RoleEnum.PLAYER,
                invitation_token_id=live.id,
                created_at=oldest_pending_at,
            ),
            TTXAccessRequest(
                ttx_id=drill.id,
                user_id=p1.id,
                role=RoleEnum.PLAYER,
                invitation_token_id=live.id,
                status=AccessRequestStatus.APPROVED,
            ),
            TTXAccessRequest(
                ttx_id=drill.id,
                user_id=p2.id,
                role=RoleEnum.PLAYER,
                invitation_token_id=revoked.id,
                status=AccessRequestStatus.REJECTED,
            ),
            TTXAccessRequest(
                ttx_id=other.id,
                user_id=p2.id,
                role=RoleEnum.PLAYER,
                invitation_token_id=elsewhere.id,
            ),
        ]
    )
    db_session.commit()
    _login(client, manager.email, secret)
    return {
        "drill": drill.id,
        "other": other.id,
        "live": live.id,
        "revoked": revoked.id,
        "p1": p1,
        "manager": manager,
        "oldest_pending_at": oldest_pending_at,
    }


def test_dashboard_aggregates_one_exercise(client: TestClient, db_session: Session) -> None:
    seeded = _setup(client, db_session, "-agg")

    response = client.get(f"/api/v1/ttx/{seeded['drill']}/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["ttx_name"] == "Drill"
    kpis = body["kpis"]
    assert kpis["players"] == 2
    assert kpis["planners"] == 1
    assert kpis["injects"] == 2
    assert kpis["pending_requests"] == 1
    assert kpis["oldest_pending_request_at"].startswith(
        seeded["oldest_pending_at"].isoformat()[:16]
    )
    assert body["access_requests"] == {"approved": 1, "pending": 1, "rejected": 1}
    assert body["invitations"] == {"active": 1, "revoked": 1, "expired": 0, "redemptions": 4}

    # Newest token first; each carries its own request outcomes.
    breakdown = body["invitation_breakdown"]
    assert [item["token_id"] for item in breakdown] == [
        str(seeded["revoked"]),
        str(seeded["live"]),
    ]
    assert breakdown[0] | {"created_at": None} == {
        "token_id": str(seeded["revoked"]),
        "description": None,
        "role": "player",
        "status": "revoked",
        "created_at": None,
        "redemptions": 1,
        "approved": 0,
        "pending": 0,
        "rejected": 1,
    }
    assert breakdown[1]["description"] == "Board members"
    assert breakdown[1]["status"] == "active"
    assert (breakdown[1]["approved"], breakdown[1]["pending"], breakdown[1]["rejected"]) == (
        1,
        1,
        0,
    )

    weeks = body["weekly_joins"]
    assert len(weeks) == 12
    # Drill's two Players, not Other's; its creator's own access isn't
    # access being granted.
    assert (weeks[-1]["players"], weeks[-1]["team"]) == (2, 0)
    assert sum(w["players"] + w["team"] for w in weeks) == 2


def test_dashboard_of_empty_exercise_is_all_zero(client: TestClient, db_session: Session) -> None:
    seeded = _setup(client, db_session, "-empty")
    empty = TTX(
        name="Empty",
        organization_id=db_session.get(TTX, seeded["drill"]).organization_id,
        created_by_id=seeded["p1"].id,
    )
    db_session.add(empty)
    db_session.commit()
    db_session.add(
        TTXAccess(user_id=seeded["manager"].id, ttx_id=empty.id, role=RoleEnum.PLANNER, plans=True)
    )
    db_session.commit()

    response = client.get(f"/api/v1/ttx/{empty.id}/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["kpis"] == {
        "players": 0,
        "planners": 1,
        "injects": 0,
        "pending_requests": 0,
        "oldest_pending_request_at": None,
    }
    assert body["invitation_breakdown"] == []
    assert body["access_requests"] == {"approved": 0, "pending": 0, "rejected": 0}
    # The manager was added to someone else's exercise: team access.
    assert [(w["players"], w["team"]) for w in body["weekly_joins"]] == [(0, 0)] * 11 + [(0, 1)]


def test_dashboard_of_exercise_not_managed_is_denied(
    client: TestClient, db_session: Session
) -> None:
    # The manager has no TTXAccess on "Other" and no org-level role that
    # would bypass it.
    seeded = _setup(client, db_session, "-deny")

    response = client.get(f"/api/v1/ttx/{seeded['other']}/dashboard")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "TTX_ACCESS_DENIED"


def test_dashboard_denied_to_player(client: TestClient, db_session: Session) -> None:
    seeded = _setup(client, db_session, "-player")
    client.cookies.clear()
    secret = pyotp.random_base32()
    player = seeded["p1"]
    totp_service.store_secret(player, secret)
    player.totp_enabled = True
    db_session.add(player)
    db_session.commit()
    _login(client, player.email, secret)

    response = client.get(f"/api/v1/ttx/{seeded['drill']}/dashboard")

    assert response.status_code == 403


def test_dashboard_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/api/v1/ttx/{uuid.uuid4()}/dashboard")

    assert response.status_code == 401
