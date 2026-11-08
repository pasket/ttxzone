"""The AI assistant's scenarios and memory: the Library's scenarios as a
starting point to adapt, past (archived) exercises, and the improvement
plan -- as the person reads them, owners by area, never by name."""

import json
import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.data.scenario_catalog import scenario_catalog
from app.models import TTX, RoleEnum
from tests.assistant_helpers import call, create_token
from tests.test_after_action import _aar, _payload
from tests.test_assistant_after_action import exercise as exercise  # noqa: F401 (fixture)
from tests.test_assistant_after_action import played as played  # noqa: F401 (fixture)
from tests.test_assistant_after_action import written as written  # noqa: F401 (fixture)
from tests.test_assistant_tools import _data, _error_code, _member
from tests.test_ttx_needs_form import _csrf


def test_scenarios_are_found_and_read_as_a_starting_point(
    client: TestClient, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]
    some = next(iter(scenario_catalog()))

    every = _data(call(client, token, "search_scenarios", {}))
    assert every["total"] == len(scenario_catalog())
    assert some in {s["scenario_id"] for s in every["scenarios"]}
    ransomware = _data(call(client, token, "search_scenarios", {"query": "ransom"}))
    assert ransomware["total"] >= 1

    read = _data(call(client, token, "get_scenario", {"scenario_id": "ransomware"}))
    assert read["needs_analysis"]["objectives"]
    msel = read["msel"]
    assert msel["phases"] and msel["injects"]
    phase_codes = {p["code"] for p in msel["phases"]}
    assert all(i["phase"] in phase_codes for i in msel["injects"] if i["phase"])
    assert "propose_needs" in read["how_to_use"]
    spanish = _data(
        call(client, token, "get_scenario", {"scenario_id": "ransomware", "language": "es"})
    )
    assert spanish["language"] == "es"

    unknown = call(client, token, "get_scenario", {"scenario_id": "no-such-scenario"})
    assert _error_code(unknown) == "SCENARIO_NOT_FOUND"
    no_org = call(client, token, "search_scenarios", {"source": "organization"})
    assert _error_code(no_org) == "ASSISTANT_ORGANIZATION_REQUIRED"
    org_id = assistant_planner["owner"]["organization"]["id"]
    own = _data(
        call(
            client,
            token,
            "search_scenarios",
            {"source": "organization", "organization_id": org_id},
        )
    )
    assert own["source"] == "organization"


def test_past_exercises_are_listed_when_asked_and_their_report_read(
    client: TestClient,
    db_session: Session,
    written: dict,  # noqa: F811
) -> None:
    ttx_id = written["ttx_id"]
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    ttx.archived_at = datetime.now(UTC)
    db_session.add(ttx)
    db_session.commit()
    token = written["token"]

    current = _data(call(client, token, "list_exercises", {}))
    assert ttx_id not in {e["ttx_id"] for e in current["exercises"]}
    past = _data(call(client, token, "list_exercises", {"include_archived": True}))
    [listed] = [e for e in past["exercises"] if e["ttx_id"] == ttx_id]
    assert listed["archived"] is True
    report = _data(call(client, token, "get_after_action_report", {"ttx_id": ttx_id}))
    assert report


def test_the_improvement_plan_reads_by_area_and_as_the_person(
    client: TestClient,
    db_session: Session,
    written: dict,  # noqa: F811
) -> None:
    ttx_id, org_id, token = written["ttx_id"], written["org_id"], written["token"]
    actions = [
        {"finding": "Isolation came late", "action": "Write the runbook", "owner": "Laura Pérez",
         "owner_area": "IT operations"},
        {"finding": "F2", "action": "Closed one", "owner": "Sam", "status": "done"},
    ]  # fmt: skip
    saved = client.put(
        _aar(ttx_id), json=_payload(written["report"], actions=actions), headers=_csrf(client)
    )
    assert saved.status_code == 200, saved.text

    plan = _data(call(client, token, "get_improvement_plan", {"organization_id": org_id}))
    assert plan["scope"] == "organization"
    [action] = plan["actions"]
    assert action["action"] == "Write the runbook"
    assert action["owner_area"] == "IT operations"
    assert "Laura" not in json.dumps(plan)
    every = _data(
        call(
            client,
            token,
            "get_improvement_plan",
            {"organization_id": org_id, "open_only": False},
        )
    )
    assert every["total"] == 2

    # A Planner of another exercise sees only their own exercises' actions.
    other_ttx = client.post(
        "/api/v1/ttx",
        json={"name": "Another", "organization_id": org_id},
        headers=_csrf(client),
    ).json()
    outsider = _member(
        db_session, "outsider@acme.com", other_ttx["id"], RoleEnum.PLANNER, plans=True
    )
    theirs = _data(call(client, outsider, "get_improvement_plan", {"organization_id": org_id}))
    assert theirs == {"scope": "your exercises", "actions": [], "total": 0}
