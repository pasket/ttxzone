"""The AI assistant on the after-action report: its authors read what the
session recorded and propose text and actions, each backed by evidence that
is checked. The levels and the plan's follow-up stay with people."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import AssistantProposal, PersonalAccessToken, RoleEnum, TTXAccess, User
from tests.assistant_helpers import call, create_token, enable_assistant
from tests.test_after_action import _aar, _change, _payload, _post, _url
from tests.test_after_action import played as played  # noqa: F401 (fixture)
from tests.test_assistant_tools import _data, _error_code, _member
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_needs_form import _csrf

PROPOSALS = "/api/v1/ttx/{ttx_id}/assistant/proposals"


@pytest.fixture
def written(client: TestClient, db_session: Session, played: dict) -> dict:  # noqa: F811
    """The played session's report started, the assistant on, a token."""
    response = client.post(_aar(played["ttx_id"]), json={}, headers=_csrf(client))
    assert response.status_code == 201, response.text
    enable_assistant(db_session)
    return {**played, "report": response.json(), "token": create_token(client)["token"]}


def _record(client: TestClient, written: dict, **arguments) -> dict:
    return _data(
        call(
            client,
            written["token"],
            "get_session_record",
            {"ttx_id": written["ttx_id"], **arguments},
        )
    )


def _inject(client: TestClient, written: dict) -> dict:
    code = _record(client, written)["injects"][0]["code"]
    return {"kind": "inject", "ref": code}


def _pending(client: TestClient, ttx_id: str) -> list[dict]:
    response = client.get(PROPOSALS.format(ttx_id=ttx_id))
    assert response.status_code == 200, response.text
    return response.json()["items"]


def test_the_authors_read_what_the_session_recorded(client: TestClient, written: dict) -> None:
    report = _data(
        call(client, written["token"], "get_after_action_report", {"ttx_id": written["ttx_id"]})
    )
    assert report["tlp"]
    assert report["objectives"][0]["code"].startswith("OBJ-")

    record = _record(client, written)
    assert record["injects"][0]["code"].startswith("INJ-")
    marked = next(a for a in record["expected_actions"] if a["code"] == written["action"])
    assert marked["mark"] == "not_observed"
    assert {r["level"] for r in record["ratings"]} == {"P", "M"}
    assert record["notes"][0]["text"] == "Table hesitated on isolation"
    assert record["notes"][0]["role"] == "controller"
    # Under the minimum of answers the feedback shows nothing.
    assert record["feedback"]["shown"] is False

    only = _record(client, written, sections=["ratings"])
    # Only that section, besides what every exercise result carries.
    assert set(only) == {"tlp", "run", "ratings", "classification"}


def test_the_record_names_roles_never_people(
    client: TestClient, db_session: Session, written: dict
) -> None:
    text = call(client, written["token"], "get_session_record", {"ttx_id": written["ttx_id"]})
    body = text["content"][0]["text"]
    for user in db_session.exec(select(User)):
        assert user.email not in body
        assert not user.full_name or user.full_name not in body


def test_a_players_note_stays_out(client: TestClient, db_session: Session, written: dict) -> None:
    from app.models import RunNote
    from app.models.exercise_run import ExerciseRun

    run = db_session.exec(
        select(ExerciseRun).where(ExerciseRun.ttx_id == uuid.UUID(written["ttx_id"]))
    ).first()
    author = db_session.exec(select(User)).first()
    db_session.add(
        RunNote(
            ttx_id=run.ttx_id,
            run_id=run.id,
            author_id=author.id,
            role="player",
            inject_code="",
            text="Private to the Player",
        )  # fmt: skip
    )
    db_session.commit()
    assert all(n["text"] != "Private to the Player" for n in _record(client, written)["notes"])


def test_text_is_proposed_and_saved_by_the_page(client: TestClient, written: dict) -> None:
    ttx_id = written["ttx_id"]
    evidence = [_inject(client, written)]
    made = _data(
        call(
            client,
            written["token"],
            "propose_report_text",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "section": "conclusions",
                        "text": "Containment was late.",
                        "evidence": evidence,
                    }
                ],
            },
        )
    )
    assert made["proposals"][0]["target"] == "aar_text"

    [proposal] = _pending(client, ttx_id)
    assert proposal["patch"] == {"conclusions": "Containment was late."}
    assert proposal["evidence"][0]["ref"] == evidence[0]["ref"]
    assert proposal["evidence"][0]["label"]
    # Proposing changes nothing.
    report = client.get(_aar(ttx_id)).json()
    assert report["conclusions"] != "Containment was late."

    applied = PROPOSALS.format(ttx_id=ttx_id) + f"/{proposal['id']}/applied"
    saved = client.put(
        _aar(ttx_id), json=_payload(report, conclusions="Containment was late."),
        headers=_csrf(client),
    )  # fmt: skip
    assert saved.status_code == 200, saved.text
    done = client.post(applied, json={"row_id": report["id"]}, headers=_csrf(client))
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "accepted"
    assert _pending(client, ttx_id) == []


def test_an_update_turns_outdated_when_the_report_moves_on(
    client: TestClient, written: dict
) -> None:
    ttx_id = written["ttx_id"]
    objective = written["report"]["objectives"][0]
    call(
        client,
        written["token"],
        "propose_objective_assessments",
        {
            "ttx_id": ttx_id,
            "items": [
                {
                    "code": objective["objective_code"],
                    "analysis": "Isolation took too long.",
                    "evidence": [_inject(client, written)],
                }
            ],
        },
    )
    [proposal] = _pending(client, ttx_id)
    assert proposal["target"] == "aar_objective"
    assert proposal["target_id"] == objective["id"]
    assert proposal["outdated"] is False

    report = client.get(_aar(ttx_id)).json()
    report["objectives"][0]["analysis"] = "Someone wrote this meanwhile."
    assert client.put(_aar(ttx_id), json=_payload(report), headers=_csrf(client)).status_code == 200
    assert _pending(client, ttx_id)[0]["outdated"] is True


def test_actions_are_proposed_new_or_changed(client: TestClient, written: dict) -> None:
    ttx_id = written["ttx_id"]
    objective = written["report"]["objectives"][0]["objective_code"]
    evidence = [_inject(client, written)]

    def propose(**item) -> dict:
        return call(
            client,
            written["token"],
            "propose_improvement_actions",
            {"ttx_id": ttx_id, "items": [{"evidence": evidence, **item}]},
        )

    assert _error_code(propose(finding="No action")) == "ASSISTANT_PROPOSAL_INCOMPLETE"
    assert (
        _error_code(propose(finding="F", action="A", objective_code="OBJ-99"))
        == "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"
    )
    assert _error_code(propose(code="IP-99", finding="F")) == "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"
    _data(propose(finding="Slow isolation", action="Rehearse it", objective_code=objective))
    [proposal] = _pending(client, ttx_id)
    assert proposal["operation"] == "create"
    assert proposal["patch"]["objective_code"] == objective

    report = client.get(_aar(ttx_id)).json()
    body = _payload(report)
    body["actions"].append({"id": None, "finding": "Old", "action": "Old", "status": "open"})
    saved = client.put(_aar(ttx_id), json=body, headers=_csrf(client))
    assert saved.status_code == 200, saved.text
    code = saved.json()["actions"][-1]["code"]
    _data(propose(code=code, action="New wording"))
    update = _pending(client, ttx_id)[-1]
    assert update["operation"] == "update"
    assert update["patch"] == {"action": "New wording"}
    assert update["base"] == {"action": "Old"}


@pytest.mark.parametrize(
    ("tool", "field", "value"),
    [
        ("propose_objective_assessments", "overall", "P"),
        ("propose_improvement_actions", "due_date", "2027-01-01"),
        ("propose_improvement_actions", "status", "done"),
    ],
)
def test_levels_and_follow_up_stay_with_people(
    client: TestClient, written: dict, tool: str, field: str, value: str
) -> None:
    item = {"evidence": [_inject(client, written)], "analysis": "Text", field: value}
    if tool == "propose_objective_assessments":
        item["code"] = written["report"]["objectives"][0]["objective_code"]
    else:
        del item["analysis"]
        item |= {"finding": "F", "action": "A"}
    result = call(client, written["token"], tool, {"ttx_id": written["ttx_id"], "items": [item]})
    assert _error_code(result) == "INVALID_ARGUMENTS"
    assert _pending(client, written["ttx_id"]) == []


def test_every_proposal_cites_what_exists(client: TestClient, written: dict) -> None:
    def propose(evidence: list[dict]) -> dict:
        return call(
            client,
            written["token"],
            "propose_report_text",
            {
                "ttx_id": written["ttx_id"],
                "items": [{"section": "conclusions", "text": "Text", "evidence": evidence}],
            },
        )

    assert _error_code(propose([])) == "INVALID_ARGUMENTS"
    for invented in (
        {"kind": "inject", "ref": "INJ-99"},
        {"kind": "decision", "ref": str(uuid.uuid4())},
        {"kind": "rating", "ref": str(uuid.uuid4())},
        # Feedback under its minimum of answers isn't there to cite.
        {"kind": "feedback", "ref": "open_better"},
    ):
        assert _error_code(propose([invented])) == "ASSISTANT_PROPOSAL_UNKNOWN_EVIDENCE"
    assert _pending(client, written["ttx_id"]) == []


def test_the_lead_evaluator_who_doesnt_plan_can_use_it(
    client: TestClient, db_session: Session, written: dict
) -> None:
    ttx_id = written["ttx_id"]
    current = db_session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == uuid.UUID(ttx_id), TTXAccess.leads)
    ).one()
    current.leads = False
    db_session.add(current)
    db_session.commit()
    lead = _member(db_session, "lead@acme.com", ttx_id, RoleEnum.EVALUATOR, leads=True)
    listed = _data(call(client, lead, "list_exercises"))["exercises"]
    assert [e["ttx_id"] for e in listed] == [ttx_id]
    assert listed[0]["you_plan"] is False
    assert listed[0]["after_action_status"] == "draft"

    _data(call(client, lead, "get_session_record", {"ttx_id": ttx_id}))
    _data(
        call(
            client,
            lead,
            "propose_report_text",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "section": "conclusions",
                        "text": "From the Lead Evaluator.",
                        "evidence": [_inject(client, written)],
                    }
                ],
            },
        )
    )
    # Only the report: the design stays the Planners'.
    assert _error_code(call(client, lead, "get_msel", {"ttx_id": ttx_id})) == "TTX_ACCESS_DENIED"


@pytest.mark.parametrize(
    ("role", "flags"),
    [(RoleEnum.EVALUATOR, {}), (RoleEnum.OBSERVER, {}), (RoleEnum.PLAYER, {})],
)
def test_nobody_else_reads_the_session(
    client: TestClient, db_session: Session, written: dict, role: RoleEnum, flags: dict
) -> None:
    ttx_id = written["ttx_id"]
    token = _member(db_session, f"{role.value}@acme.com", ttx_id, role, **flags)
    for tool in ("get_session_record", "get_after_action_report"):
        assert _error_code(call(client, token, tool, {"ttx_id": ttx_id})) == "TTX_ACCESS_DENIED"


def test_a_controller_who_doesnt_plan_stays_out(
    client: TestClient, db_session: Session, written: dict
) -> None:
    ttx_id = written["ttx_id"]
    token = _member(
        db_session, "control@acme.com", ttx_id, RoleEnum.PLANNER, plans=False, controls=True
    )
    result = call(client, token, "get_session_record", {"ttx_id": ttx_id})
    assert _error_code(result) == "TTX_ACCESS_DENIED"


def test_a_token_from_before_the_notice_stops_at_the_session(
    client: TestClient, db_session: Session, written: dict
) -> None:
    ttx_id = written["ttx_id"]
    row = db_session.exec(select(PersonalAccessToken)).first()
    row.disclaimer_version = "1"
    db_session.add(row)
    db_session.commit()
    for tool in ("get_session_record", "get_after_action_report"):
        result = call(client, written["token"], tool, {"ttx_id": ttx_id})
        assert _error_code(result) == "ASSISTANT_NOTICE_OUTDATED"
    # The rest of its tools go on working.
    _data(call(client, written["token"], "list_exercises"))


def test_there_has_to_be_a_report(client: TestClient, db_session: Session, played: dict) -> None:  # noqa: F811
    enable_assistant(db_session)
    token = create_token(client)["token"]
    result = call(client, token, "get_session_record", {"ttx_id": played["ttx_id"]})
    assert _error_code(result) == "AAR_NOT_STARTED"


def test_moving_the_report_to_another_session_discards_its_proposals(
    client: TestClient, db_session: Session, written: dict
) -> None:
    ttx_id = written["ttx_id"]
    _data(
        call(
            client,
            written["token"],
            "propose_report_text",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "section": "conclusions",
                        "text": "From the first session.",
                        "evidence": [_inject(client, written)],
                    }
                ],
            },
        )
    )
    restarted = client.post(
        _url(ttx_id, "/restart"),
        json={"mode": "archive", "confirmation": "restart"},
        headers=_csrf(client),
    )
    assert restarted.status_code == 200, restarted.text
    _post(client, ttx_id, "/start")
    _post(client, ttx_id, "/end")
    report = client.get(_aar(ttx_id)).json()
    moved = _change(client, ttx_id, report, report["runs"][0]["id"])
    assert moved.status_code == 200, moved.text
    assert _pending(client, ttx_id) == []
    db_session.expire_all()
    assert db_session.exec(select(AssistantProposal)).first().status == "discarded"


def test_an_archived_exercise_is_read_but_takes_no_proposals(
    client: TestClient, db_session: Session, written: dict
) -> None:
    from datetime import UTC, datetime

    from app.models import TTX

    ttx_id = written["ttx_id"]
    evidence = [_inject(client, written)]
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    ttx.archived_at = datetime.now(UTC)
    db_session.add(ttx)
    db_session.commit()
    _data(call(client, written["token"], "get_session_record", {"ttx_id": ttx_id}))
    result = call(
        client,
        written["token"],
        "propose_report_text",
        {
            "ttx_id": ttx_id,
            "items": [{"section": "conclusions", "text": "Late.", "evidence": evidence}],
        },
    )
    assert _error_code(result) == "TTX_ARCHIVED"


def test_each_author_sees_only_their_own(
    client: TestClient, db_session: Session, written: dict
) -> None:
    ttx_id = written["ttx_id"]
    evidence = [_inject(client, written)]
    other = _member(db_session, "other@acme.com", ttx_id, RoleEnum.PLANNER, plans=True)
    _data(
        call(
            client,
            other,
            "propose_report_text",
            {
                "ttx_id": ttx_id,
                "items": [{"section": "conclusions", "text": "Theirs.", "evidence": evidence}],
            },
        )
    )
    assert _pending(client, ttx_id) == []
