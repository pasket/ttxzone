import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import (
    TTX,
    AccessRequestStatus,
    Inject,
    InvitationToken,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
    User,
)


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _enable_totp(db_session: Session, user_id: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _user(db_session: Session, email: str) -> User:
    user = User(email=email, hashed_password="unused", full_name=email.split("@")[0])
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _now() -> datetime:
    return datetime.now(UTC)


def _seed_org(db_session: Session, organization_id: uuid.UUID, owner_id: uuid.UUID) -> dict:
    """Two exercises: "Big" (2 players + 1 planner, 2 injects) and
    "Small" (1 player who is also in Big, nothing else), plus one
    org-scoped Planner and one exercise-only planner."""
    org_manager = _user(db_session, f"manager-{organization_id}@acme.com")
    db_session.add(
        OrganizationMembership(
            user_id=org_manager.id, organization_id=organization_id, role=OrgRoleEnum.PLANNER
        )
    )
    exercise_only = _user(db_session, f"exercise-eval-{organization_id}@acme.com")
    p1 = _user(db_session, f"p1-{organization_id}@ext.com")
    p2 = _user(db_session, f"p2-{organization_id}@ext.com")
    requester = _user(db_session, f"req-{organization_id}@ext.com")

    big = TTX(
        name="Big",
        organization_id=organization_id,
        created_by_id=owner_id,
        created_at=_now() - timedelta(days=60),
    )
    small = TTX(name="Small", organization_id=organization_id, created_by_id=owner_id)
    db_session.add_all([big, small])
    db_session.commit()

    db_session.add_all(
        [
            TTXAccess(user_id=p1.id, ttx_id=big.id, role=RoleEnum.PLAYER),
            TTXAccess(user_id=p2.id, ttx_id=big.id, role=RoleEnum.PLAYER),
            TTXAccess(user_id=exercise_only.id, ttx_id=big.id, role=RoleEnum.PLANNER, plans=True),
            # p1 again in another exercise: counts once in unique_players.
            TTXAccess(user_id=p1.id, ttx_id=small.id, role=RoleEnum.PLAYER),
            # Org-scoped manager also holding a per-TTX grant is not an
            # "exercise-only" planner.
            TTXAccess(user_id=org_manager.id, ttx_id=small.id, role=RoleEnum.PLANNER, plans=True),
            Inject(ttx_id=big.id, title="A", content="a", created_by_id=owner_id),
            Inject(ttx_id=big.id, title="B", content="b", created_by_id=owner_id),
        ]
    )
    live = InvitationToken(
        token=f"live-{organization_id}",
        ttx_id=big.id,
        role=RoleEnum.PLAYER,
        created_by_id=owner_id,
        expires_at=_now() + timedelta(days=5),
        max_uses=None,
        redemption_count=3,
    )
    revoked = InvitationToken(
        token=f"revoked-{organization_id}",
        ttx_id=big.id,
        role=RoleEnum.PLAYER,
        created_by_id=owner_id,
        expires_at=_now() + timedelta(days=5),
        revoked_at=_now(),
        redemption_count=1,
    )
    past_expiry = InvitationToken(
        token=f"expired-{organization_id}",
        ttx_id=small.id,
        role=RoleEnum.PLAYER,
        created_by_id=owner_id,
        expires_at=_now() - timedelta(days=1),
    )
    used_up = InvitationToken(
        token=f"usedup-{organization_id}",
        ttx_id=small.id,
        role=RoleEnum.PLAYER,
        created_by_id=owner_id,
        expires_at=_now() + timedelta(days=5),
        max_uses=1,
        redemption_count=1,
    )
    db_session.add_all([live, revoked, past_expiry, used_up])
    db_session.commit()

    oldest_pending_at = _now() - timedelta(days=4)
    db_session.add_all(
        [
            TTXAccessRequest(
                ttx_id=big.id,
                user_id=requester.id,
                role=RoleEnum.PLAYER,
                invitation_token_id=live.id,
                created_at=oldest_pending_at,
            ),
            TTXAccessRequest(
                ttx_id=small.id,
                user_id=p2.id,
                role=RoleEnum.PLAYER,
                invitation_token_id=live.id,
            ),
            TTXAccessRequest(
                ttx_id=big.id,
                user_id=p1.id,
                role=RoleEnum.PLAYER,
                invitation_token_id=live.id,
                status=AccessRequestStatus.APPROVED,
            ),
            TTXAccessRequest(
                ttx_id=big.id,
                user_id=p2.id,
                role=RoleEnum.PLAYER,
                invitation_token_id=live.id,
                status=AccessRequestStatus.REJECTED,
            ),
        ]
    )
    db_session.commit()
    return {"big": big.id, "small": small.id, "oldest_pending_at": oldest_pending_at}


def test_dashboard_aggregates_org_activity(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "dash-owner@acme.com", "DashCo")
    _enable_totp(db_session, owner["user"]["id"])
    org_id = uuid.UUID(owner["organization"]["id"])
    seeded = _seed_org(db_session, org_id, uuid.UUID(owner["user"]["id"]))

    response = client.get(f"/api/v1/organizations/{org_id}/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["organization_name"] == "DashCo"
    kpis = body["kpis"]
    assert kpis["planners"] == 2  # the founder is an org Planner too
    assert kpis["exercise_only_planners"] == 1
    assert kpis["exercises"] == 2
    assert kpis["exercises_last_30_days"] == 1
    assert kpis["unique_players"] == 2
    assert kpis["pending_requests"] == 2
    assert kpis["oldest_pending_request_at"].startswith(
        seeded["oldest_pending_at"].isoformat()[:16]
    )

    exercises = {item["name"]: item for item in body["exercises"]}
    assert exercises["Big"] == {
        "ttx_id": str(seeded["big"]),
        "name": "Big",
        "created_at": exercises["Big"]["created_at"],
        "players": 2,
        "planners": 1,
        "injects": 2,
        "pending_requests": 1,
    }
    assert exercises["Small"]["players"] == 1
    assert exercises["Small"]["planners"] == 1
    assert exercises["Small"]["injects"] == 0
    assert exercises["Small"]["pending_requests"] == 1

    assert body["access_requests"] == {"approved": 1, "pending": 2, "rejected": 1}
    assert body["invitations"] == {"active": 1, "revoked": 1, "expired": 2, "redemptions": 5}

    weeks = body["weekly_joins"]
    assert len(weeks) == 12
    assert weeks == sorted(weeks, key=lambda w: w["week_start"])
    # All five TTXAccess rows were created just now -> current week: three
    # Players, two team members (neither created its exercise).
    assert (weeks[-1]["players"], weeks[-1]["team"]) == (3, 2)
    assert sum(w["players"] + w["team"] for w in weeks) == 5


def test_dashboard_for_org_without_exercises_is_all_zero(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "dash-empty@acme.com", "EmptyCo")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.get(f"/api/v1/organizations/{owner['organization']['id']}/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["exercises"] == []
    assert body["kpis"]["exercises"] == 0
    assert body["kpis"]["oldest_pending_request_at"] is None
    assert body["access_requests"] == {"approved": 0, "pending": 0, "rejected": 0}
    assert body["invitations"] == {"active": 0, "revoked": 0, "expired": 0, "redemptions": 0}
    assert [(w["players"], w["team"]) for w in body["weekly_joins"]] == [(0, 0)] * 12


def test_dashboard_of_another_org_is_denied(client: TestClient, db_session: Session) -> None:
    target = _signup(client, "dash-target@acme.com", "TargetCo")

    client.cookies.clear()
    intruder = _signup(client, "dash-intruder@other.com", "IntruderCo")
    _enable_totp(db_session, intruder["user"]["id"])

    response = client.get(f"/api/v1/organizations/{target['organization']['id']}/dashboard")

    assert response.status_code == 403


def test_dashboard_requires_totp(client: TestClient) -> None:
    owner = _signup(client, "dash-nototp@acme.com", "NoTotpCo")

    response = client.get(f"/api/v1/organizations/{owner['organization']['id']}/dashboard")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "MFA_REQUIRED"


def test_dashboard_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/api/v1/organizations/{uuid.uuid4()}/dashboard")

    assert response.status_code == 401
