"""The planning and control team's functions (Planner / Controller /
Facilitator on one TTXAccess row) and the Observer role (org grant, then
exercise assignment)."""

import uuid

import pyotp
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.core.security import require_ttx_role
from app.main import app
from app.models import TTX, OrganizationMembership, OrgRoleEnum, RoleEnum, TTXAccess, User
from tests.test_ttx_evaluation import DESIGN_ENDPOINTS
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager, _to_approved
from tests.test_ttx_planning_team import _login, _user


@pytest.fixture
def team(client: TestClient, db_session: Session) -> dict:
    """The founder's exercise (founder signed in on `client`, Planner and
    Controller of it) plus `colleague`, an org Planner with TOTP not on
    the exercise yet."""
    owner = _manager(client, db_session, "founder@acme.com", "Acme")
    org_id = owner["organization"]["id"]
    ttx = _create_ttx(client, org_id)
    secret = pyotp.random_base32()
    colleague = _user(db_session, "colleague@acme.com", "Cole League", secret)
    db_session.add(
        OrganizationMembership(
            user_id=colleague.id, organization_id=uuid.UUID(org_id), role=OrgRoleEnum.PLANNER
        )
    )
    db_session.commit()
    return {
        "org_id": org_id,
        "ttx_id": ttx["id"],
        "founder_id": owner["user"]["id"],
        "colleague": colleague,
        "secret": secret,
    }


def _team_url(team: dict, suffix: str = "") -> str:
    return f"/api/v1/ttx/{team['ttx_id']}/planning-team{suffix}"


def _functions(client: TestClient, team: dict, user_id, query: str = "", **flags):
    return client.put(
        _team_url(team, f"/{user_id}/functions{query}"), json=flags, headers=_csrf(client)
    )


def _add_colleague(client: TestClient, team: dict, **flags) -> None:
    response = client.post(
        _team_url(team), json={"email": "colleague@acme.com", **flags}, headers=_csrf(client)
    )
    assert response.status_code == 201, response.text


def _members(client: TestClient, team: dict) -> dict:
    return {item["email"]: item for item in client.get(_team_url(team)).json()["items"]}


def _as_colleague(team: dict) -> TestClient:
    other = TestClient(app)
    _login(other, "colleague@acme.com", team["secret"])
    return other


def test_the_creator_plans_and_controls_their_exercise(client: TestClient, team: dict) -> None:
    listed = client.get("/api/v1/ttx").json()["items"]
    member = _members(client, team)["founder@acme.com"]

    assert (listed[0]["plans"], listed[0]["controls"], listed[0]["facilitates"]) == (
        True,
        True,
        False,
    )
    assert (member["plans"], member["controls"], member["is_lead"]) == (True, True, True)


def test_a_member_is_added_with_chosen_functions(client: TestClient, team: dict) -> None:
    _add_colleague(client, team, plans=False, controls=True, facilitates=True)

    member = _members(client, team)["colleague@acme.com"]

    assert (member["plans"], member["controls"], member["facilitates"]) == (False, True, True)


def test_functions_must_make_sense(client: TestClient, team: dict) -> None:
    _add_colleague(client, team)
    colleague_id = team["colleague"].id

    nothing = _functions(client, team, colleague_id, plans=False, controls=False, facilitates=False)
    facilitator_only = _functions(
        client, team, colleague_id, plans=True, controls=False, facilitates=True
    )

    assert nothing.json()["error"]["code"] == "NO_TEAM_FUNCTION"
    assert facilitator_only.json()["error"]["code"] == "FACILITATOR_NEEDS_CONTROLLER"


def test_the_exercise_keeps_a_planner_and_a_controller(client: TestClient, team: dict) -> None:
    founder = team["founder_id"]

    stop_controlling = _functions(
        client, team, founder, plans=True, controls=False, facilitates=False
    )
    stop_planning = _functions(client, team, founder, plans=False, controls=True, facilitates=False)

    assert stop_controlling.status_code == 409
    assert stop_controlling.json()["error"]["code"] == "LAST_CONTROLLER"
    assert stop_planning.status_code == 409
    assert stop_planning.json()["error"]["code"] == "LAST_PLANNER"

    _add_colleague(client, team, plans=False, controls=True)
    handed_over = _functions(client, team, founder, plans=True, controls=False, facilitates=False)
    assert handed_over.status_code == 200, handed_over.text


def test_the_lead_must_plan(client: TestClient, team: dict) -> None:
    _add_colleague(client, team, plans=False, controls=True)
    colleague_id = team["colleague"].id

    to_controller = client.put(
        _team_url(team, "/lead"), json={"user_id": str(colleague_id)}, headers=_csrf(client)
    )
    assert to_controller.json()["error"]["code"] == "LEAD_MUST_PLAN"

    # The lead who stops planning names a successor who plans.
    assert _functions(client, team, colleague_id, plans=True, controls=True, facilitates=False)
    no_successor = _functions(
        client, team, team["founder_id"], plans=False, controls=True, facilitates=False
    )
    handed = _functions(
        client,
        team,
        team["founder_id"],
        query=f"?lead_successor_id={colleague_id}",
        plans=False,
        controls=True,
        facilitates=False,
    )

    assert no_successor.json()["error"]["code"] == "LEAD_SUCCESSOR_REQUIRED"
    assert handed.status_code == 200, handed.text
    leads = [item["email"] for item in handed.json()["items"] if item["is_lead"]]
    assert leads == ["colleague@acme.com"]


def test_a_controller_who_doesnt_plan_reaches_no_design_but_reads_the_eeg(
    client: TestClient, team: dict
) -> None:
    ttx_id = team["ttx_id"]
    _to_approved(client, ttx_id)
    _add_colleague(client, team, plans=False, controls=True, facilitates=True)
    other = _as_colleague(team)

    with other:
        for method, suffix in DESIGN_ENDPOINTS:
            response = other.request(
                method, f"/api/v1/ttx/{ttx_id}{suffix}", json={}, headers=_csrf(other)
            )
            assert response.status_code == 403, (method, suffix, response.status_code)
        assert other.get(f"/api/v1/ttx/{ttx_id}/eeg").status_code == 200
        as_controller = other.get("/api/v1/ttx", params={"role": "controller"}).json()
        as_facilitator = other.get("/api/v1/ttx", params={"role": "facilitator"}).json()
        as_planner = other.get("/api/v1/ttx", params={"role": "planner"}).json()

    assert [item["id"] for item in as_controller["items"]] == [ttx_id]
    assert [item["id"] for item in as_facilitator["items"]] == [ttx_id]
    assert as_planner["items"] == []


def test_controller_and_facilitator_can_be_the_login_default(
    client: TestClient, team: dict
) -> None:
    _add_colleague(client, team, plans=False, controls=True, facilitates=True)
    other = _as_colleague(team)

    with other:
        responses = {
            role: other.put(
                "/api/v1/auth/default-context",
                json={"organization_id": team["org_id"], "role": role, "ttx_id": team["ttx_id"]},
                headers=_csrf(other),
            )
            for role in ("controller", "facilitator", "planner")
        }

    assert responses["controller"].status_code == 204, responses["controller"].text
    assert responses["facilitator"].status_code == 204
    # An org Planner, but not a Planner of this exercise.
    assert responses["planner"].status_code == 404


def test_an_observer_is_granted_in_the_org_then_assigned(
    client: TestClient, db_session: Session, team: dict
) -> None:
    ttx_id = team["ttx_id"]
    _to_approved(client, ttx_id)
    secret = pyotp.random_base32()
    _user(db_session, "watcher@outside.org", "Wanda Watcher", secret)

    not_granted = client.post(
        f"/api/v1/ttx/{ttx_id}/observers",
        json={"email": "watcher@outside.org"},
        headers=_csrf(client),
    )
    granted = client.post(
        f"/api/v1/organizations/{team['org_id']}/observers",
        json={"email": "watcher@outside.org"},
        headers=_csrf(client),
    )
    candidates = client.get(f"/api/v1/ttx/{ttx_id}/observers/candidates").json()["items"]
    assigned = client.post(
        f"/api/v1/ttx/{ttx_id}/observers",
        json={"email": "watcher@outside.org"},
        headers=_csrf(client),
    )

    assert not_granted.json()["error"]["code"] == "NOT_ORG_OBSERVER"
    # Any domain: Observers are often from outside the organization.
    assert granted.status_code == 201, granted.text
    assert [c["email"] for c in candidates] == ["watcher@outside.org"]
    assert assigned.status_code == 201, assigned.text
    access = db_session.exec(
        select(TTXAccess)
        .join(User, User.id == TTXAccess.user_id)
        .where(User.email == "watcher@outside.org")
    ).one()
    assert access.role == RoleEnum.OBSERVER

    observer = TestClient(app)
    with observer:
        _login(observer, "watcher@outside.org", secret)
        items = observer.get("/api/v1/ttx").json()["items"]
        assert [(item["id"], item["role"]) for item in items] == [(ttx_id, "observer")]
        assert observer.get(f"/api/v1/ttx/{ttx_id}/eeg").status_code == 403
        assert observer.get(f"/api/v1/ttx/{ttx_id}/needs-form").status_code == 403


def test_org_observers_and_evaluators_are_listed_and_revoked(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _user(db_session, "watcher@outside.org", "Wanda Watcher")
    base = f"/api/v1/organizations/{team['org_id']}"
    client.post(f"{base}/observers", json={"email": "watcher@outside.org"}, headers=_csrf(client))

    again = client.post(
        f"{base}/observers", json={"email": "watcher@outside.org"}, headers=_csrf(client)
    )
    observers = client.get(f"{base}/observers").json()
    evaluators = client.get(f"{base}/evaluators").json()
    watcher_id = observers["items"][0]["user_id"]
    revoked = client.delete(f"{base}/observers/{watcher_id}", headers=_csrf(client))
    revoked_again = client.delete(f"{base}/observers/{watcher_id}", headers=_csrf(client))

    assert again.json()["error"]["code"] == "ALREADY_OBSERVER"
    assert observers["total"] == 1
    assert evaluators["total"] == 0
    assert revoked.status_code == 204
    assert revoked_again.json()["error"]["code"] == "OBSERVER_NOT_FOUND"


def test_the_observer_needs_a_second_factor(db_session: Session, team: dict) -> None:
    watcher = _user(db_session, "watcher@outside.org", "Wanda Watcher")
    db_session.add(
        TTXAccess(user_id=watcher.id, ttx_id=uuid.UUID(team["ttx_id"]), role=RoleEnum.OBSERVER)
    )
    db_session.commit()
    ttx = db_session.get(TTX, uuid.UUID(team["ttx_id"]))

    with pytest.raises(AppException) as refused:
        require_ttx_role(db_session, watcher, ttx, (RoleEnum.OBSERVER,))

    assert refused.value.code == "MFA_REQUIRED"
