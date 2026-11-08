"""The AI assistant on the session plan: it reads the plan (people by what
they do, never by name) and any document's validation report, and
proposes observation points of the definitive EEGs, checked like the rest
and accepted on the Session plan page."""

import json
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import TTX, AssistantProposal
from app.services.assistant import proposals_prep
from app.services.ttx_conduct_prep_service import find_prep, prep_read
from tests.assistant_helpers import call, create_token
from tests.test_assistant_msel_rows import _round_trip
from tests.test_assistant_proposals import _list
from tests.test_assistant_tools import _data, _error_code
from tests.test_ttx_conduct_prep import _add_evaluator, _get, _ready_msel
from tests.test_ttx_needs_form import _to_approved


def _with_plan(client: TestClient, db_session: Session, planner: dict) -> tuple[str, dict]:
    ttx_id = planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    _ready_msel(client, ttx_id)
    _add_evaluator(
        client, db_session, planner["owner"]["organization"]["id"], ttx_id, "ot.expert@audit.org"
    )
    read = _get(client, ttx_id).json()
    return ttx_id, read


def test_the_plan_is_read_without_names(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    assert (
        _data(call(client, token, "get_session_plan", {"ttx_id": ttx_id}))["session_plan"] is None
    )

    ttx_id, read = _with_plan(client, db_session, assistant_planner)
    plan = _data(call(client, token, "get_session_plan", {"ttx_id": ttx_id}))

    assert plan["status"] == "draft"
    assert [o["objective"] for o in plan["eeg"]] == [o["code"] for o in read["eeg"]]
    point = plan["eeg"][0]["points"][0]
    assert point["point_id"] == read["eeg"][0]["points"][0]["id"]
    assert set(point["criteria"]) == {"P", "S", "M", "U"}
    assert plan["calendar"]["days_after_session"]["draft_report"] == read["draft_aar_days"]
    # Nobody is named: the evaluator is there by what they cover.
    text = json.dumps(plan)
    assert "ot.expert@audit.org" not in text
    assert "full_name" not in text
    overview = _data(call(client, token, "get_exercise_overview", {"ttx_id": ttx_id}))
    assert overview["session_plan"]["status"] == "draft"


def test_the_validation_report_names_rows_by_code(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    needs = _data(
        call(
            client,
            token,
            "get_validation_report",
            {"ttx_id": ttx_id, "document": "needs_analysis"},
        )
    )
    assert needs["status"] == "draft" and needs["blocks_ready"]
    assert all({"code", "section", "field", "item"} <= set(i) for i in needs["blocks_ready"])
    no_msel = call(client, token, "get_validation_report", {"ttx_id": ttx_id, "document": "msel"})
    assert _error_code(no_msel) == "ASSISTANT_MSEL_NOT_OPEN"

    ttx_id, read = _with_plan(client, db_session, assistant_planner)
    msel = _data(
        call(client, token, "get_validation_report", {"ttx_id": ttx_id, "document": "msel"})
    )
    assert msel["status"] == "ready"
    plan = _data(
        call(client, token, "get_validation_report", {"ttx_id": ttx_id, "document": "session_plan"})
    )
    items = [i["item"] for level in ("blocks_ready", "warnings") for i in plan[level] if i["item"]]
    # Rows are named by their codes, never by a raw id.
    assert all(not _is_uuid(item) for item in items)


def _is_uuid(text: str) -> bool:
    try:
        uuid.UUID(text)
    except ValueError:
        return False
    return True


def test_points_are_proposed_checked_and_read_back_once_saved(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id, read = _with_plan(client, db_session, assistant_planner)
    token = create_token(client)["token"]
    eeg = read["eeg"][0]
    seeded = next(p for p in eeg["points"] if p["kind"] != "custom")

    made = _data(
        call(
            client,
            token,
            "propose_eeg_points",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "objective": eeg["code"],
                        "text": "The crisis cell names who speaks to the press.",
                        "criteria_p": "Named within 20 minutes, with a holding statement.",
                        "criteria_u": "Nobody is named.",
                        "summary": "Communication is the objective's weak point.",
                    },
                    {"point_id": seeded["id"], "criteria_s": "Named late, without a statement."},
                ],
            },
        )
    )
    created, changed = (
        db_session.get(AssistantProposal, uuid.UUID(p["id"])) for p in made["proposals"]
    )
    assert (created.target, created.operation) == ("eeg_point", "create")
    assert created.patch["eeg_id"] == eeg["id"]
    assert changed.target_id == uuid.UUID(seeded["id"])
    assert changed.patch == {"criteria_s": "Named late, without a statement."}
    assert [p["id"] for p in _list(client, ttx_id, target="eeg_point")] == [
        str(created.id),
        str(changed.id),
    ]

    db_session.expire_all()
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    payload = proposals_prep.payload_from_prep(
        prep_read(db_session, ttx, find_prep(db_session, ttx.id))
    )

    _round_trip(
        client,
        db_session,
        ttx_id,
        [created, changed],
        payload=payload,
        apply=proposals_prep.apply_point,
        path="conduct-prep",
    )


def test_what_stays_with_people_or_follows_a_source_is_refused(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    not_open = call(
        client,
        token,
        "propose_eeg_points",
        {"ttx_id": ttx_id, "items": [{"objective": "OBJ-01", "text": "x"}]},
    )
    assert _error_code(not_open) == "ASSISTANT_SESSION_PLAN_NOT_OPEN"

    ttx_id, read = _with_plan(client, db_session, assistant_planner)
    seeded = next(p for p in read["eeg"][0]["points"] if p["kind"] != "custom")

    def propose(item: dict) -> dict:
        return call(client, token, "propose_eeg_points", {"ttx_id": ttx_id, "items": [item]})

    assert _error_code(propose({"point_id": seeded["id"], "text": "Reworded"})) == (
        "ASSISTANT_PROPOSAL_NOT_UPDATABLE"
    )
    assert _error_code(propose({"objective": "OBJ-99", "text": "x"})) == (
        "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"
    )
    assert _error_code(propose({"objective": read["eeg"][0]["code"]})) == (
        "ASSISTANT_PROPOSAL_INCOMPLETE"
    )
    assert _error_code(propose({"point_id": str(uuid.uuid4()), "criteria_p": "x"})) == (
        "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"
    )
    # Dates, people and READY aren't in the schema at all.
    assert (
        _error_code(
            propose(
                {"objective": read["eeg"][0]["code"], "text": "x", "session_date": "2027-01-01"}
            )
        )
        == "INVALID_ARGUMENTS"
    )


def test_a_seeded_point_leaves_with_its_source_never_from_the_plan(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id, read = _with_plan(client, db_session, assistant_planner)
    token = create_token(client)["token"]
    points = [p for o in read["eeg"] for p in o["points"]]
    criterion = next(p for p in points if p["kind"] == "criterion")
    action = next(p for p in points if p["kind"] == "expected_action")

    def delete(point: dict) -> dict:
        return call(
            client,
            token,
            "propose_eeg_points",
            {"ttx_id": ttx_id, "items": [{"point_id": point["id"], "delete": True}]},
        )

    from_criterion = delete(criterion)
    assert _error_code(from_criterion) == "ASSISTANT_PROPOSAL_NOT_UPDATABLE"
    assert "success_criterion" in from_criterion["content"][0]["text"]
    from_action = delete(action)
    assert action["source_action_code"] in from_action["content"][0]["text"]
    assert "propose_injects" in from_action["content"][0]["text"]
    assert _list(client, ttx_id) == []
