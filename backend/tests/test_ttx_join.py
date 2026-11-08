"""A Program Manager joining an exercise themselves (Admin -> Exercises):
on its planning and control team, or as its Observer or Evaluator -- only
from their organization grant of that name, with a recent sign-in, and only
in an organization they run."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import (
    OrganizationMembership,
    OrgRoleEnum,
    PlatformAuditEvent,
    RoleEnum,
    TTXAccess,
    User,
    UserSession,
)
from tests.test_ttx_evaluation import _account, _enable_totp, _login
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager


def _planner_client(db_session: Session, org_id: str, email: str) -> TestClient:
    """An org Planner signed in on their own client."""
    planner = _account(db_session, email, "Co Planner")
    db_session.add(
        OrganizationMembership(
            user_id=planner.id, organization_id=uuid.UUID(org_id), role=OrgRoleEnum.PLANNER
        )
    )
    db_session.commit()
    own = TestClient(app)
    _login(own, email)
    _enable_totp(db_session, planner)
    return own


def _exercise_without_the_manager(client: TestClient, db_session: Session) -> dict:
    """An exercise another Planner created: the Program Manager (the
    client, also an org Planner as founder) has no seat on it."""
    owner = _manager(client, db_session, "pm@acme.com", "Acme")
    org_id = owner["organization"]["id"]
    co = _planner_client(db_session, org_id, "co@acme.com")
    return {"org_id": org_id, "ttx": _create_ttx(co, org_id, "Drill")}


def _join(client: TestClient, ttx_id: str, **body):
    return client.post(f"/api/v1/ttx/{ttx_id}/people/me", json=body, headers=_csrf(client))


def _access(db_session: Session, ttx_id: str, email: str) -> TTXAccess | None:
    user = db_session.exec(select(User).where(User.email == email)).one()
    db_session.expire_all()
    return db_session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == uuid.UUID(ttx_id), TTXAccess.user_id == user.id)
    ).first()


def test_a_program_manager_joins_the_team_and_then_works_on_the_exercise(
    client: TestClient, db_session: Session
) -> None:
    ttx_id = _exercise_without_the_manager(client, db_session)["ttx"]["id"]
    listed = {t["id"]: t for t in client.get("/api/v1/ttx").json()["items"]}
    assert listed[ttx_id]["role"] == "program_manager"

    joined = _join(client, ttx_id, role="planner", plans=True, controls=True)

    assert joined.status_code == 201, joined.text
    access = _access(db_session, ttx_id, "pm@acme.com")
    assert (access.role, access.plans, access.controls) == (RoleEnum.PLANNER, True, True)
    listed = {t["id"]: t for t in client.get("/api/v1/ttx").json()["items"]}
    assert (listed[ttx_id]["role"], listed[ttx_id]["plans"]) == ("planner", True)
    # Now a team member: the design endpoints open.
    assert client.get(f"/api/v1/ttx/{ttx_id}/needs-form").status_code == 200
    again = _join(client, ttx_id, role="planner", plans=True)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "ALREADY_ON_PLANNING_TEAM"


def test_observer_and_evaluator_seats_come_from_the_organization_grant(
    client: TestClient, db_session: Session
) -> None:
    built = _exercise_without_the_manager(client, db_session)
    ttx_id = built["ttx"]["id"]

    refused = _join(client, ttx_id, role="observer")
    assert refused.status_code == 400
    assert refused.json()["error"]["code"] == "NOT_ORG_OBSERVER"

    manager = db_session.exec(select(User).where(User.email == "pm@acme.com")).one()
    db_session.add(
        OrganizationMembership(
            user_id=manager.id,
            organization_id=uuid.UUID(built["org_id"]),
            role=OrgRoleEnum.OBSERVER,
        )
    )
    db_session.commit()
    mine = client.get("/api/v1/organizations/mine").json()["items"][0]
    assert (mine["is_observer"], mine["is_evaluator"]) == (True, False)

    assert _join(client, ttx_id, role="observer").status_code == 201
    assert _access(db_session, ttx_id, "pm@acme.com").role == RoleEnum.OBSERVER


def test_only_a_program_manager_of_the_organization_joins_this_way(
    client: TestClient, db_session: Session
) -> None:
    built = _exercise_without_the_manager(client, db_session)
    other = _planner_client(db_session, built["org_id"], "other@acme.com")

    refused = _join(other, built["ttx"]["id"], role="planner", plans=True)

    assert refused.status_code == 403
    assert _access(db_session, built["ttx"]["id"], "other@acme.com") is None


def test_joining_needs_no_step_up_and_is_audited(client: TestClient, db_session: Session) -> None:
    ttx_id = _exercise_without_the_manager(client, db_session)["ttx"]["id"]
    manager = db_session.exec(select(User).where(User.email == "pm@acme.com")).one()
    for user_session in db_session.exec(
        select(UserSession).where(UserSession.user_id == manager.id)
    ):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()

    joined = _join(client, ttx_id, role="planner", plans=True)

    assert joined.status_code == 201, joined.text
    event = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "exercise.member_joined")
    ).one()
    assert event.actor_user_id == manager.id
    assert event.details and event.details["role"] == "planner"
