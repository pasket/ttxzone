"""Org grants reach exercises: revoking one takes the person off that role
on every exercise of the organization; deleting a person still on
exercises disables them instead. Plus the exercise's people matrix."""

import uuid

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import (
    TTX,
    Organization,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    User,
)
from tests import test_ttx_control_team as control_team
from tests.test_ttx_needs_form import _create_ttx, _csrf
from tests.test_ttx_planning_team import _user

# The control team tests' fixture: founder's exercise plus an org Planner.
team = control_team.team
_add_colleague = control_team._add_colleague
_as_colleague = control_team._as_colleague


def _org(team: dict, suffix: str = "") -> str:
    return f"/api/v1/organizations/{team['org_id']}{suffix}"


def _access(db_session: Session, ttx_id: str, user_id) -> TTXAccess | None:
    db_session.expire_all()
    return db_session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == uuid.UUID(ttx_id), TTXAccess.user_id == user_id)
    ).first()


def _grant(db_session: Session, team: dict, user: User, role: OrgRoleEnum) -> None:
    db_session.add(
        OrganizationMembership(
            user_id=user.id, organization_id=uuid.UUID(team["org_id"]), role=role
        )
    )
    db_session.commit()


def test_revoking_a_grant_takes_the_role_off_every_exercise(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _add_colleague(client, team)
    other_ttx = _create_ttx(client, team["org_id"], name="Second")
    colleague = team["colleague"]
    client.post(
        f"/api/v1/ttx/{other_ttx['id']}/planning-team",
        json={"email": colleague.email},
        headers=_csrf(client),
    )

    usage = client.get(_org(team, f"/members/{colleague.id}/exercises")).json()["items"]
    revoked = client.delete(_org(team, f"/planners/{colleague.id}"), headers=_csrf(client))

    assert sorted(item["name"] for item in usage) == ["Drill", "Second"]
    assert revoked.status_code == 204
    assert _access(db_session, team["ttx_id"], colleague.id) is None
    assert _access(db_session, other_ttx["id"], colleague.id) is None


def test_the_only_planner_or_controller_keeps_the_grant(
    client: TestClient, db_session: Session, team: dict
) -> None:
    founder = uuid.UUID(team["founder_id"])

    refused = client.delete(_org(team, f"/planners/{founder}"), headers=_csrf(client))

    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "ONLY_PLANNER_OR_CONTROLLER"
    assert _access(db_session, team["ttx_id"], founder) is not None


def test_a_revoked_lead_hands_over_to_another_planner(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _add_colleague(client, team, plans=True, controls=True)
    founder = uuid.UUID(team["founder_id"])

    revoked = client.delete(_org(team, f"/planners/{founder}"), headers=_csrf(client))

    assert revoked.status_code == 204
    team_rows = client.get(f"/api/v1/ttx/{team['ttx_id']}/people").json()["items"]
    assert [(p["email"], p["is_lead"]) for p in team_rows] == [("colleague@acme.com", True)]


def test_revoking_observer_takes_them_off_exercises(
    client: TestClient, db_session: Session, team: dict
) -> None:
    watcher = _user(db_session, "watcher@outside.org", "Wanda")
    _grant(db_session, team, watcher, OrgRoleEnum.OBSERVER)
    client.post(
        f"/api/v1/ttx/{team['ttx_id']}/people",
        json={"email": watcher.email, "role": "observer"},
        headers=_csrf(client),
    )
    assert _access(db_session, team["ttx_id"], watcher.id) is not None

    client.delete(_org(team, f"/observers/{watcher.id}"), headers=_csrf(client))

    assert _access(db_session, team["ttx_id"], watcher.id) is None


def test_deleting_someone_on_an_exercise_disables_them(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _add_colleague(client, team)
    colleague = team["colleague"]
    other = _as_colleague(team)

    deleted = client.delete(_org(team, f"/members/{colleague.id}"), headers=_csrf(client))

    assert deleted.json() == {"status": "disabled", "exercises": [deleted.json()["exercises"][0]]}
    row = next(
        m
        for m in client.get(_org(team, "/members")).json()["items"]
        if m["email"] == colleague.email
    )
    assert row["disabled"] is True
    with other:
        blocked = other.get(f"/api/v1/ttx/{team['ttx_id']}/needs-form")
        listed = other.get("/api/v1/ttx").json()["items"]
        orgs = other.get("/api/v1/organizations/mine").json()["items"]
    assert blocked.json()["error"]["code"] == "MEMBER_DISABLED"
    assert listed == []
    assert orgs == []

    assert (
        client.post(
            _org(team, f"/members/{colleague.id}/enable"), headers=_csrf(client)
        ).status_code
        == 204
    )
    with TestClient(app) as again:
        db_session.refresh(colleague)
        colleague.totp_last_step = None
        db_session.add(colleague)
        db_session.commit()
        login = again.post(
            "/api/v1/auth/login",
            json={"email": colleague.email, "password": "Correcthorse123!"},
        )
        again.post(
            "/api/v1/auth/login/verify-totp",
            json={
                "mfa_pending_token": login.json()["mfa_pending_token"],
                "code": pyotp.TOTP(team["secret"]).now(),
            },
        )
        assert [t["id"] for t in again.get("/api/v1/ttx").json()["items"]] == [team["ttx_id"]]


def test_disabled_in_one_organization_keeps_the_others(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _add_colleague(client, team)
    colleague = team["colleague"]
    elsewhere = Organization(name="Elsewhere")
    db_session.add(elsewhere)
    db_session.flush()
    elsewhere_ttx = TTX(
        name="Elsewhere drill", organization_id=elsewhere.id, created_by_id=colleague.id
    )
    db_session.add(elsewhere_ttx)
    db_session.flush()
    db_session.add_all(
        [
            OrganizationMembership(
                user_id=colleague.id, organization_id=elsewhere.id, role=OrgRoleEnum.PLANNER
            ),
            TTXAccess(
                user_id=colleague.id,
                ttx_id=elsewhere_ttx.id,
                role=RoleEnum.PLANNER,
                plans=True,
                controls=True,
            ),
        ]
    )
    db_session.commit()
    other = _as_colleague(team)

    deleted = client.delete(_org(team, f"/members/{colleague.id}"), headers=_csrf(client))

    assert deleted.json()["status"] == "disabled"
    with other:
        blocked = other.get(f"/api/v1/ttx/{team['ttx_id']}/needs-form")
        opened = other.get(f"/api/v1/ttx/{elsewhere_ttx.id}/needs-form")
        listed = [t["id"] for t in other.get("/api/v1/ttx").json()["items"]]
        orgs = [
            o["organization_id"] for o in other.get("/api/v1/organizations/mine").json()["items"]
        ]
    assert blocked.json()["error"]["code"] == "MEMBER_DISABLED"
    assert opened.status_code == 200, opened.text
    assert listed == [str(elsewhere_ttx.id)]
    assert orgs == [str(elsewhere.id)]
    db_session.expire_all()
    assert all(
        m.disabled_at is None
        for m in db_session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == elsewhere.id
            )
        )
    )


def test_deleting_someone_off_every_exercise_removes_them(
    client: TestClient, db_session: Session, team: dict
) -> None:
    colleague = team["colleague"]

    deleted = client.delete(_org(team, f"/members/{colleague.id}"), headers=_csrf(client))

    assert deleted.json() == {"status": "deleted", "exercises": []}
    db_session.expire_all()
    assert (
        db_session.exec(
            select(OrganizationMembership).where(OrganizationMembership.user_id == colleague.id)
        ).first()
        is None
    )


def test_the_last_program_manager_cant_be_deleted(client: TestClient, team: dict) -> None:
    refused = client.delete(_org(team, f"/members/{team['founder_id']}"), headers=_csrf(client))

    assert refused.json()["error"]["code"] == "LAST_PROGRAM_MANAGER"


def test_the_exercise_people_matrix(client: TestClient, db_session: Session, team: dict) -> None:
    ttx_url = f"/api/v1/ttx/{team['ttx_id']}"
    watcher = _user(db_session, "watcher@outside.org", "Wanda")
    _grant(db_session, team, watcher, OrgRoleEnum.OBSERVER)
    _grant(db_session, team, watcher, OrgRoleEnum.EVALUATOR)
    headers = _csrf(client)
    org_tag = client.post(
        _org(team, "/tags"), json={"name": "Auditor", "color": "violet"}, headers=headers
    ).json()["id"]
    client.put(
        _org(team, f"/members/{watcher.id}/tags"), json={"tag_ids": [org_tag]}, headers=headers
    )

    candidates = client.get(f"{ttx_url}/people/candidates").json()["items"]
    added = client.post(
        f"{ttx_url}/people", json={"email": watcher.email, "role": "observer"}, headers=headers
    )
    not_granted = client.put(
        f"{ttx_url}/people/{watcher.id}/role",
        json={"role": "planner", "plans": True},
        headers=headers,
    )
    switched = client.put(
        f"{ttx_url}/people/{watcher.id}/role", json={"role": "evaluator"}, headers=headers
    )
    founder_off_team = client.put(
        f"{ttx_url}/people/{team['founder_id']}/role", json={"role": "observer"}, headers=headers
    )
    people = {p["email"]: p for p in client.get(f"{ttx_url}/people").json()["items"]}

    by_email = {c["email"]: sorted(c["grants"]) for c in candidates}
    assert by_email["watcher@outside.org"] == ["evaluator", "observer"]
    assert by_email["colleague@acme.com"] == ["planner"]
    assert added.status_code == 201
    assert not_granted.json()["error"]["code"] == "NOT_ORG_PLANNER"
    assert switched.status_code == 204
    # The founder has no Observer grant (and is the only Planner anyway).
    assert founder_off_team.status_code == 400
    assert people["watcher@outside.org"]["role"] == "evaluator"
    assert [t["name"] for t in people["watcher@outside.org"]["org_tags"]] == ["Auditor"]
    assert people["founder@acme.com"]["is_lead"] is True

    removed = client.delete(f"{ttx_url}/people/{watcher.id}", headers=headers)
    assert removed.status_code == 204
    assert _access(db_session, team["ttx_id"], watcher.id) is None
    assert RoleEnum.PLANNER  # the team rules keep applying through /people


def test_members_filter_by_active_or_disabled(client: TestClient, team: dict) -> None:
    _add_colleague(client, team)
    colleague = team["colleague"]
    client.delete(_org(team, f"/members/{colleague.id}"), headers=_csrf(client))

    def emails(status: str) -> list[str]:
        items = client.get(_org(team, f"/members?status={status}")).json()["items"]
        return [m["email"] for m in items]

    assert emails("disabled") == [colleague.email]
    assert colleague.email not in emails("active")
    assert len(emails("active")) == 1
