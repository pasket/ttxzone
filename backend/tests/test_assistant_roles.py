"""The AI assistant per organization and role (Admin -> Organization), and
what the roles other than the Planner get from it: the programme for a
Program Manager, the conduct brief for a Controller, their own EEGs and
notes for an Evaluator."""

import json

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import Organization, PlatformAuditEvent, RoleEnum, TTXAccess, User
from tests.assistant_helpers import call, create_token, mcp
from tests.test_assistant_tools import _member
from tests.test_ttx_needs_form import _csrf

ORGS = "/api/v1/organizations"


def _data(result: dict) -> dict:
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


def _code(result: dict) -> str:
    assert result["isError"] is True, result
    return result["content"][0]["text"].split(":", 1)[0]


def _set_roles(client: TestClient, organization_id: str, roles: list[str]):
    return client.put(
        f"{ORGS}/{organization_id}/assistant", json={"roles": roles}, headers=_csrf(client)
    )


def _tools(client: TestClient, token: str) -> set[str]:
    listed = mcp(client, token, "tools/list").json()["result"]["tools"]
    return {t["name"] for t in listed}


def test_a_program_manager_chooses_the_roles_and_it_is_recorded(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    organization_id = assistant_planner["owner"]["organization"]["id"]

    read = client.get(f"{ORGS}/{organization_id}/assistant").json()
    assert read == {"roles": ["program_manager", "planner", "evaluator"], "instance_enabled": True}

    saved = _set_roles(client, organization_id, ["controller", "planner"])
    assert saved.status_code == 200, saved.text
    assert saved.json()["roles"] == ["planner", "controller"]
    event = db_session.exec(
        select(PlatformAuditEvent).where(
            PlatformAuditEvent.action == "assistant.organization_roles_update"
        )
    ).one()
    assert event.details["after"] == ["planner", "controller"]
    assert _set_roles(client, organization_id, ["observer"]).status_code == 422


def test_a_role_turned_off_stops_its_tools(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    organization_id = assistant_planner["owner"]["organization"]["id"]
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    assert "propose_injects" in _tools(client, token)

    _set_roles(client, organization_id, ["program_manager"])

    # Still a Program Manager: reads, proposes nothing.
    assert _data(call(client, token, "get_exercise_overview", {"ttx_id": ttx_id}))
    refused = call(client, token, "propose_exercise", {"ttx_id": ttx_id, "name": "Renamed"})
    assert _code(refused) == "ASSISTANT_ROLE_DISABLED"
    assert "propose_injects" not in _tools(client, token)
    assert "get_program_overview" in _tools(client, token)

    _set_roles(client, organization_id, [])
    assert _code(call(client, token, "get_exercise_overview", {"ttx_id": ttx_id})) == (
        "ASSISTANT_ROLE_DISABLED"
    )
    assert _data(call(client, token, "list_exercises"))["exercises"] == []
    assert _tools(client, token) == set()
    asked = client.get(f"/api/v1/ttx/{ttx_id}/assistant/requests").json()
    assert asked["enabled"] is False


def test_the_program_overview_is_the_program_managers(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    organization_id = assistant_planner["owner"]["organization"]["id"]
    ttx = assistant_planner["ttx"]
    token = create_token(client)["token"]

    overview = _data(
        call(client, token, "get_program_overview", {"organization_id": organization_id})
    )

    assert [e["code"] for e in overview["exercises"]] == [ttx["code"]]
    assert overview["exercises"][0]["session"] == "not_started"
    assert len(overview["never_exercised"]) == len(overview["capabilities"])
    assert overview["improvement_plan"]["overdue_actions"] == []

    controller = _member(
        db_session, "c@acme.com", ttx["id"], RoleEnum.PLANNER, plans=False, controls=True
    )
    refused = call(client, controller, "get_program_overview", {"organization_id": organization_id})
    assert _code(refused) == "HTTP_403"


def test_a_controller_reads_the_conduct_brief_once_the_organization_allows_it(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    organization_id = assistant_planner["owner"]["organization"]["id"]
    ttx_id = assistant_planner["ttx"]["id"]
    controller = _member(
        db_session, "c@acme.com", ttx_id, RoleEnum.PLANNER, plans=False, controls=True
    )

    off = call(client, controller, "get_conduct_brief", {"ttx_id": ttx_id})
    assert _code(off) == "ASSISTANT_ROLE_DISABLED"
    assert _tools(client, controller) == set()

    _set_roles(client, organization_id, ["planner", "controller"])

    brief = _data(call(client, controller, "get_conduct_brief", {"ttx_id": ttx_id}))
    assert brief["msel"] is None
    assert "get_conduct_brief" in _tools(client, controller)
    assert "get_msel" not in _tools(client, controller)
    # The design stays the Planners'.
    assert _code(call(client, controller, "get_msel", {"ttx_id": ttx_id})) == "TTX_ACCESS_DENIED"
    # A Planner who doesn't control gets no brief.
    founder = db_session.exec(select(User).where(User.email == "planner@acme.com")).one()
    seat = db_session.exec(select(TTXAccess).where(TTXAccess.user_id == founder.id)).one()
    seat.controls = False
    db_session.add(seat)
    db_session.commit()
    planner = create_token(client)["token"]
    assert _code(call(client, planner, "get_conduct_brief", {"ttx_id": ttx_id})) == (
        "TTX_ACCESS_DENIED"
    )


def test_an_evaluator_reads_their_own_evaluation(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    evaluator = _member(db_session, "e@acme.com", ttx_id, RoleEnum.EVALUATOR)

    mine = _data(call(client, evaluator, "get_my_evaluation", {"ttx_id": ttx_id}))

    assert mine["eeg"] is None and "session plan" in mine["note"]
    assert _tools(client, evaluator) >= {"get_my_evaluation", "list_exercises"}
    assert "get_conduct_brief" not in _tools(client, evaluator)
    player = _member(db_session, "p@acme.com", ttx_id, RoleEnum.PLAYER)
    assert _code(call(client, player, "get_my_evaluation", {"ttx_id": ttx_id})) == (
        "TTX_ACCESS_DENIED"
    )
    assert _tools(client, player) == set()


def test_a_new_organization_starts_without_the_controllers(db_session: Session) -> None:
    organization = Organization(name="Fresh")
    db_session.add(organization)
    db_session.commit()
    db_session.refresh(organization)
    assert organization.assistant_roles == ["program_manager", "planner", "evaluator"]
