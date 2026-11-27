"""The design review: the exercise's chain from needs to observation points
as its Planners and their AI client read it, with the links it lacks."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import TTX
from app.services.assistant import proposals
from app.services.ttx_msel_service import find_msel, msel_read
from tests.assistant_helpers import call, create_token
from tests.test_assistant_proposals import _approved_with_msel
from tests.test_assistant_session_plan import _with_plan
from tests.test_assistant_tools import _data
from tests.test_ttx_needs_form import _csrf


def _review(client: TestClient, ttx_id: str) -> dict:
    response = client.get(f"/api/v1/ttx/{ttx_id}/design-review")
    assert response.status_code == 200, response.text
    return response.json()


def test_before_the_msel_it_reads_the_needs_analysis_alone(
    client: TestClient, assistant_planner: dict
) -> None:
    review = _review(client, assistant_planner["ttx"]["id"])

    assert review["has_msel"] is False and review["has_session_plan"] is False
    assert review["pace"] is None and review["threat_actors"] == []
    # No MSEL to test them yet: an objective isn't said to lack injects.
    assert {g["kind"] for g in review["gaps"]} <= {"need_without_objective"}


def test_the_chain_is_laid_out_by_code_with_what_it_lacks(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    codes = {o["id"]: o["code"] for o in msel["needs"]["objectives"]}

    review = _review(client, ttx_id)

    assert review["has_msel"] is True and review["has_session_plan"] is False
    by_code = {o["code"]: o for o in review["objectives"]}
    assert set(by_code) == set(codes.values())
    for objective_id, code in codes.items():
        tested_by = [
            i["code"]
            for i in msel["injects"]
            if i["format"] == "inject" and objective_id in i["objective_ids"]
        ]
        assert by_code[code]["injects"] == tested_by
        assert by_code[code]["needs"], "every objective answers a need"
        # No session plan: nothing to count, and no gap for it.
        assert by_code[code]["observation_points"] is None
    assert "objective_without_observation_point" not in {g["kind"] for g in review["gaps"]}
    pace = review["pace"]
    assert pace["injects"] == len(msel["injects"])
    assert [p["code"] for p in pace["phases"]] == [p["code"] for p in msel["phases"]]
    assert sum(p["injects"] for p in pace["phases"]) == len(msel["injects"])
    assert sum(review["formats"].values()) == len(msel["injects"])

    # A phase nobody put an inject in, and a long silence before the end.
    db_session.expire_all()
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    payload = proposals.payload_from_msel(msel_read(db_session, ttx, find_msel(db_session, ttx.id)))
    last = max(p["end_offset"] for p in payload["phases"])
    payload["phases"].append(
        {**payload["phases"][-1], "id": None, "key": "new", "name": "Aftermath",
         "start_offset": last, "end_offset": last + 120, "objective_ids": [],
         "due_objective_ids": []}
    )  # fmt: skip
    payload["duration_minutes"] = last + 120
    saved = client.put(f"/api/v1/ttx/{ttx_id}/msel", json=payload, headers=_csrf(client))
    assert saved.status_code == 200, saved.text

    review = _review(client, ttx_id)
    empty = [g for g in review["gaps"] if g["kind"] == "phase_without_inject"]
    assert [g["title"] for g in empty] == ["Aftermath"]
    quiet = review["pace"]["quiet_stretches"]
    assert quiet and quiet[-1]["to_minute"] == last + 120 and quiet[-1]["before"] is None

    # The AI client reads the same review, with the exercise's classification.
    token = create_token(client)["token"]
    told = _data(call(client, token, "get_design_review", {"ttx_id": ttx_id}))
    assert told.pop("classification")["tlp"]
    assert told == review


def test_observation_points_count_once_there_is_a_session_plan(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id, plan = _with_plan(client, db_session, assistant_planner)

    review = _review(client, ttx_id)

    assert review["has_session_plan"] is True
    points = {o["code"]: len(o["points"]) for o in plan["eeg"]}
    assert {o["code"]: o["observation_points"] for o in review["objectives"]} == points
    used = {a["code"]: a for a in review["threat_actors"]}
    assert all(a["used"] <= a["techniques"] for a in used.values())
