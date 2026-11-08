"""A member of an exercise's planning and control team can also be its
Evaluator and/or Observer -- the usual Controller/Evaluator of a small
exercise -- from the org grants of those names, on their one row per
exercise (`evaluates` / `observes` flags)."""

# ruff: noqa: F811 -- `team` is the control-team fixture, imported.

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import RoleEnum, TTXAccess
from tests.test_ttx_control_team import _add_colleague, _as_colleague, team  # noqa: F401
from tests.test_ttx_needs_form import _csrf


def _grant(client: TestClient, team: dict, role: str, email: str = "colleague@acme.com"):
    response = client.post(
        f"/api/v1/organizations/{team['org_id']}/{role}s",
        json={"email": email},
        headers=_csrf(client),
    )
    assert response.status_code == 201, response.text


def _assign(client: TestClient, team: dict, role: str, email: str = "colleague@acme.com"):
    return client.post(
        f"/api/v1/ttx/{team['ttx_id']}/{role}s", json={"email": email}, headers=_csrf(client)
    )


def _row(db_session: Session, team: dict) -> TTXAccess:
    db_session.expire_all()
    return db_session.exec(select(TTXAccess).where(TTXAccess.user_id == team["colleague"].id)).one()


def test_a_team_member_is_also_assigned_evaluator_and_observer(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _add_colleague(client, team, plans=False, controls=True)

    # The org grant is still what authorizes the role.
    refused = _assign(client, team, "evaluator")
    assert refused.json()["error"]["code"] == "NOT_ORG_EVALUATOR"

    _grant(client, team, "evaluator")
    _grant(client, team, "observer")
    candidates = client.get(f"/api/v1/ttx/{team['ttx_id']}/evaluators/candidates").json()
    assert [c["email"] for c in candidates["items"]] == ["colleague@acme.com"]
    assert _assign(client, team, "evaluator").status_code == 201
    again = _assign(client, team, "evaluator")
    assert again.json()["error"]["code"] == "ALREADY_ON_EXERCISE"
    # Observer or Evaluator, never both: one watches, the other rates.
    both = _assign(client, team, "observer")
    assert both.json()["error"]["code"] == "OBSERVER_OR_EVALUATOR"

    row = _row(db_session, team)
    assert (row.role, row.controls, row.evaluates, row.observes) == (
        RoleEnum.PLANNER,
        True,
        True,
        False,
    )
    evaluators = client.get(f"/api/v1/ttx/{team['ttx_id']}/evaluators").json()["items"]
    assert [e["email"] for e in evaluators] == ["colleague@acme.com"]

    colleague = _as_colleague(team)
    with colleague:
        [item] = colleague.get("/api/v1/ttx").json()["items"]
        assert (item["role"], item["controls"], item["evaluates"], item["observes"]) == (
            "planner",
            True,
            True,
            False,
        )
        as_evaluator = colleague.get("/api/v1/ttx?role=evaluator").json()["items"]
        assert [i["id"] for i in as_evaluator] == [team["ttx_id"]]
        # A Controller who evaluates reads the EEG, still no design.
        assert colleague.get(f"/api/v1/ttx/{team['ttx_id']}/eeg").status_code == 200
        assert colleague.get(f"/api/v1/ttx/{team['ttx_id']}/needs-form").status_code == 403


def test_a_team_member_who_evaluates_can_lead_and_stops_with_the_role(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _add_colleague(client, team, plans=True, controls=False)
    _grant(client, team, "evaluator")
    assert _assign(client, team, "evaluator").status_code == 201
    user_id = str(team["colleague"].id)
    lead = client.put(
        f"/api/v1/ttx/{team['ttx_id']}/evaluators/lead",
        json={"user_id": user_id},
        headers=_csrf(client),
    )
    assert lead.status_code in (200, 204), lead.text
    assert _row(db_session, team).leads is True

    removed = client.delete(
        f"/api/v1/ttx/{team['ttx_id']}/evaluators/{user_id}", headers=_csrf(client)
    )
    assert removed.status_code == 204, removed.text
    row = _row(db_session, team)
    # Still on the team; no longer Evaluator nor its lead.
    assert (row.role, row.plans, row.evaluates, row.leads) == (RoleEnum.PLANNER, True, False, False)


def test_the_people_matrix_sets_both_roles_from_their_grants(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _add_colleague(client, team, plans=True, controls=False)
    url = f"/api/v1/ttx/{team['ttx_id']}/people/{team['colleague'].id}/role"
    body = {"role": "planner", "plans": True, "observes": True}

    refused = client.put(url, json=body, headers=_csrf(client))
    assert refused.json()["error"]["code"] == "NOT_ORG_OBSERVER"
    _grant(client, team, "observer")
    assert client.put(url, json=body, headers=_csrf(client)).status_code == 204

    both = client.put(url, json={**body, "evaluates": True}, headers=_csrf(client))
    assert both.json()["error"]["code"] == "OBSERVER_OR_EVALUATOR"

    people = client.get(f"/api/v1/ttx/{team['ttx_id']}/people").json()["items"]
    person = next(p for p in people if p["email"] == "colleague@acme.com")
    assert (person["role"], person["observes"], person["evaluates"]) == ("planner", True, False)
    observers = client.get(f"/api/v1/ttx/{team['ttx_id']}/observers").json()["items"]
    assert [o["email"] for o in observers] == ["colleague@acme.com"]


def test_revoking_a_grant_keeps_the_other_role(
    client: TestClient, db_session: Session, team: dict
) -> None:
    _add_colleague(client, team, plans=True, controls=False)
    _grant(client, team, "evaluator")
    assert _assign(client, team, "evaluator").status_code == 201
    base = f"/api/v1/organizations/{team['org_id']}"
    user_id = team["colleague"].id

    # The org Evaluator grant goes: still on the team.
    assert client.delete(f"{base}/evaluators/{user_id}", headers=_csrf(client)).status_code == 204
    row = _row(db_session, team)
    assert (row.role, row.evaluates) == (RoleEnum.PLANNER, False)

    # The org Planner grant goes: still the exercise's Evaluator.
    _grant(client, team, "evaluator")
    assert _assign(client, team, "evaluator").status_code == 201
    assert client.delete(f"{base}/planners/{user_id}", headers=_csrf(client)).status_code == 204
    row = _row(db_session, team)
    assert (row.role, row.plans, row.evaluates) == (RoleEnum.EVALUATOR, False, False)
