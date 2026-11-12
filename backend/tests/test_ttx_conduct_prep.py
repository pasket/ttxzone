"""Conduct prep: the evaluation plan and the preparation of the session --
seeded from the approved needs analysis and the READY MSEL, edited and
checked here, frozen when ready."""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import (
    AccessRequestStatus,
    ConductPrepEvaluator,
    ConductPrepSnapshot,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
    User,
)
from app.schemas.ttx_conduct_prep import FindingRead
from app.schemas.ttx_msel import action_objective_ids
from tests.msel_helpers import ACTIONS, example_payload
from tests.role_helpers import grant_org_role
from tests.test_ttx_access_requests import _seed_token
from tests.test_ttx_evaluation import _account
from tests.test_ttx_msel import _move, _open, _payload_from, _put
from tests.test_ttx_needs_form import (
    _approve,
    _complete_payload,
    _create_ttx,
    _csrf,
    _manager,
    _to_approved,
)
from tests.test_ttx_needs_form import _get as _get_form
from tests.test_ttx_needs_form import _save as _save_form
from tests.test_ttx_needs_form import _transition as _move_form

ALL_DOCUMENTS = [
    "sitman",
    "facilitator_guide",
    "inject_cards",
    "eeg",
    "evaluation_plan",
    "feedback_form",
]


def _url(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/conduct-prep{suffix}"


def _get(client: TestClient, ttx_id: str):
    return client.get(_url(ttx_id))


def _save(client: TestClient, ttx_id: str, payload: dict):
    return client.put(_url(ttx_id), json=payload, headers=_csrf(client))


def _transition(client: TestClient, ttx_id: str, to: str):
    return client.post(_url(ttx_id, "/transitions"), json={"to": to}, headers=_csrf(client))


def _ready_msel(client: TestClient, ttx_id: str) -> None:
    payload = example_payload(_open(client, ttx_id))
    assert _put(client, ttx_id, payload).status_code == 200
    assert _move(client, ttx_id, "in_review").status_code == 200
    assert _move(client, ttx_id, "ready").status_code == 200


def _add_evaluator(client: TestClient, db_session: Session, org_id: str, ttx_id: str, email: str):
    evaluator = _account(db_session, email)
    grant_org_role(client, db_session, org_id, evaluator.email, "evaluator")
    added = client.post(
        f"/api/v1/ttx/{ttx_id}/evaluators", json={"email": evaluator.email}, headers=_csrf(client)
    )
    assert added.status_code == 201, added.text
    return evaluator


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    """An exercise with an approved needs analysis, a READY MSEL and a Lead
    Evaluator, the client signed in as its Planner."""
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    org_id = owner["organization"]["id"]
    ttx = _create_ttx(client, org_id)
    _to_approved(client, ttx["id"])
    _ready_msel(client, ttx["id"])
    evaluator = _add_evaluator(client, db_session, org_id, ttx["id"], "ot.expert@audit.org")
    lead = client.put(
        f"/api/v1/ttx/{ttx['id']}/evaluators/lead",
        json={"user_id": str(evaluator.id)},
        headers=_csrf(client),
    )
    assert lead.status_code == 204
    return {"ttx": ttx, "org_id": org_id, "evaluator": evaluator}


def _payload(read: dict, **changes) -> dict:
    """The plan as GET returned it, as a save payload."""
    payload = {
        key: read[key]
        for key in (
            "revision",
            "data_collection_methods",
            "data_collection_other",
            "log_keeper_id",
            "briefing_date",
            "briefing_checklist",
            "briefing_notes",
            "hot_wash_days",
            "debrief_days",
            "ratings_due_days",
            "draft_aar_days",
            "after_action_meeting_days",
            "fpm_date",
            "fpm_done",
            "fpm_attendees",
            "fpm_notes",
            "dry_run_date",
            "dry_run_done",
            "session_date",
            "session_time",
            "timezone",
            "modality",
            "venue",
            "room",
            "meeting_link",
            "session_notes",
            "invitation_sent_on",
            "invitation_text",
            "logistics_checklist",
            "documents_reviewed",
            "stop_procedure",
            "findings",
            "attendees",
        )
    }
    payload["eeg"] = [{"id": o["id"], "points": o["points"]} for o in read["eeg"]]
    payload["evaluators"] = read["evaluators"]
    payload.update(changes)
    return payload


def _complete(read: dict) -> dict:
    """Everything the rules ask for."""
    ctx = read["context"]
    eeg = [
        {
            "id": o["id"],
            "points": [
                # P/S/M/U left blank but U: the common scale, one level adjusted.
                {**point, "criteria_u": "Not done"}
                for point in o["points"]
            ],
        }
        for o in read["eeg"]
    ]
    return _payload(
        read,
        eeg=eeg,
        evaluators=[
            {
                "user_id": ctx["exercise_evaluators"][0]["user_id"],
                "areas": [],
                "briefed": True,
                "objective_ids": [o["id"] for o in read["eeg"]],
            }
        ],
        data_collection_methods=["direct_observation", "decision_timeline", "communications_log"],
        log_keeper_id=ctx["team_members"][0]["user_id"],
        briefing_date="2026-11-09",
        briefing_checklist=[
            "objectives",
            "eeg",
            "msel",
            "non_intervention",
            "data_collection",
            "logistics",
        ],
        session_date="2026-11-10",
        session_time="09:30:00",
        timezone="Europe/Madrid",
        modality="in_person",
        venue="Head office, crisis room",
        fpm_date="2026-11-03",
        fpm_done=True,
        dry_run_date="2026-11-05",
        dry_run_done=True,
        invitation_sent_on="2026-10-20",
        logistics_checklist=[
            "room_booked",
            "av_equipment",
            "connectivity_tested",
            "materials_printed",
            "real_vs_simulated",
            "attendance_list",
        ],
        attendees=[{"name": "Chief Executive", "role": "Committee chair", "confirmed": True}],
        documents_reviewed=ALL_DOCUMENTS,
    )


def _codes(report: dict, bucket: str = "ready") -> set[str]:
    return {issue["code"] for issue in report[bucket]}


def test_the_plan_waits_for_an_approved_needs_analysis(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    response = _get(client, ttx["id"])

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "NEEDS_FORM_NOT_APPROVED"


def test_each_objective_gets_an_eeg_seeded_from_its_criterion_and_the_ready_msel(
    client: TestClient, exercise: dict
) -> None:
    read = _get(client, exercise["ttx"]["id"]).json()

    assert read["status"] == "draft"
    assert read["seeded_msel_version"] == 1
    assert [o["code"] for o in read["eeg"]] == ["OBJ-01", "OBJ-02", "OBJ-03"]
    first = read["eeg"][0]["points"]
    assert first[0] == {
        **first[0],
        "kind": "criterion",
        "text": "Documented decision with its rationale in 60 minutes",
        "source_status": "current",
    }
    actions = [p for p in first if p["kind"] == "expected_action"]
    assert actions and {p["text"] for p in actions} == {ACTIONS[0]}
    assert actions[0]["source_inject_code"].startswith("INJ-")
    assert read["stop_procedure"].startswith("Anyone may stop the exercise")
    assert read["session_time"] == "09:30:00"  # the MSEL's session start
    # The evaluation calendar starts with the usual deadlines.
    assert [read[f"{m}_days"] for m in ("hot_wash", "debrief", "ratings_due", "draft_aar")] == [
        0,
        0,
        3,
        14,
    ]
    assert read["after_action_meeting_days"] == 21
    assert read["context"]["lead_evaluator"]["full_name"] == "Eva Luator"
    assert read["context"]["mandatory_injects"] == read["context"]["mandatory_injects_validated"]


def test_a_complete_plan_becomes_ready_and_freezes_a_snapshot(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()
    assert _codes(read["validation"]) >= {"SESSION_INCOMPLETE", "OBJECTIVE_WITHOUT_EVALUATOR"}
    assert _codes(read["validation"], "warnings") >= {"FPM_NOT_DONE", "DECISION_MAKERS_REQUIRED"}

    saved = _save(client, ttx_id, _complete(read))
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["validation"]["ready"] == [], body["validation"]["ready"]
    assert body["session_starts_at"] == "2026-11-10T08:30:00Z"  # 09:30 CET
    assert body["fpm_msel_version"] == 1

    ready = _transition(client, ttx_id, "ready")
    assert ready.status_code == 200, ready.text
    assert ready.json()["ready_by"] == "Ada Manager"
    snapshot = db_session.exec(select(ConductPrepSnapshot)).one()
    assert snapshot.version == 1
    assert snapshot.payload["eeg"][0]["points"][0]["criteria_u"] == "Not done"

    # Any edit past READY opens version 2.
    edited = _save(client, ttx_id, _payload(ready.json(), briefing_notes="Bring printed EEGs"))
    assert edited.json()["status"] == "draft"
    assert edited.json()["version"] == 2


def test_only_the_core_is_required_for_ready(client: TestClient, exercise: dict) -> None:
    """Each objective measured and covered, the session set, how it stops:
    no planning meeting, dry run, briefing, log keeper, data collection,
    convocation or decision makers needed."""
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()
    # A new plan starts with the usual discussion-based data collection.
    assert read["data_collection_methods"] == ["observation_notes", "hot_wash", "feedback_forms"]
    payload = _payload(
        read,
        evaluators=[
            {
                "user_id": read["context"]["exercise_evaluators"][0]["user_id"],
                "areas": [],
                "briefed": False,
                "objective_ids": [o["id"] for o in read["eeg"]],
            }
        ],
        data_collection_methods=[],
        session_date="2026-11-10",
        timezone="Europe/Madrid",
        modality="remote",
        meeting_link="https://meet.example.com/ttx",
        attendees=[{"name": "Chief Executive", "confirmed": False}],
    )

    report = _save(client, ttx_id, payload).json()["validation"]

    assert report["ready"] == [], report["ready"]
    assert _codes(report, "warnings") == {"FPM_NOT_DONE", "BRIEFING_DATE_REQUIRED"}
    assert _transition(client, ttx_id, "ready").status_code == 200


def test_the_dry_run_reports_what_a_save_would(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()
    payload = _complete(read)
    payload["eeg"][0]["points"].append({"text": ""})

    report = client.post(_url(ttx_id, "/validate"), json=payload, headers=_csrf(client)).json()

    assert _codes(report) == {"EEG_POINT_INCOMPLETE"}
    assert _get(client, ttx_id).json()["revision"] == read["revision"]


def test_the_rules_catch_an_unworkable_plan(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()
    payload = _complete(read)
    payload.update(
        session_date="2026-12-15",  # outside the needs form's window
        briefing_date="2026-12-16",
        ratings_due_days=20,  # after the draft report
        modality="hybrid",
        meeting_link="",
        attendees=[
            {"name": "Chief Executive", "confirmed": False, "fallback": "substitute"},
        ],
        findings=[{"kind": "ambiguous_inject", "description": "INJ-03 reads as real"}],
    )
    payload["evaluators"][0]["objective_ids"] = payload["evaluators"][0]["objective_ids"][:1]
    # A blank rating level is the common scale: never an issue.
    payload["eeg"][1]["points"][0]["criteria_u"] = ""

    report = _save(client, ttx_id, payload).json()["validation"]

    assert _codes(report) == {
        "SESSION_OUTSIDE_WINDOW",
        "BRIEFING_AFTER_SESSION",
        "SESSION_INCOMPLETE",
        "DECISION_MAKER_WITHOUT_FALLBACK",
        "FINDING_UNRESOLVED",
        "OBJECTIVE_WITHOUT_EVALUATOR",
    }
    # A calendar out of order is worth a look; it doesn't block.
    assert "CALENDAR_ORDER" in _codes(report, "warnings")
    refused = _transition(client, ttx_id, "ready")
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "CONDUCT_PREP_INVALID"


def test_a_finding_names_the_review_that_found_it(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()
    payload = _payload(
        read,
        findings=[
            {"found_in": "design_review", "description": "The sponsor wants fewer questions"},
            {"description": "INJ-03 reads as real"},
        ],
    )

    saved = _save(client, ttx_id, payload).json()

    assert [f["found_in"] for f in saved["findings"]] == ["design_review", "dry_run"]
    # A plan frozen before findings named their review still reads.
    assert (
        FindingRead.model_validate(
            {k: v for k, v in saved["findings"][0].items() if k != "found_in"}
        ).found_in
        == "dry_run"
    )


def test_session_and_follow_up_issues_land_on_their_steps(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()
    payload = _payload(
        read,
        briefing_date=None,
        ratings_due_days=30,
        invitation_sent_on=None,
        session_notes="Parking at gate B; badges at reception",
        invitation_text="Dear Committee, you are invited to…",
    )

    report = _save(client, ttx_id, payload).json()["validation"]
    sections = {i["code"]: i["section"] for i in report["ready"] + report["warnings"]}
    # 3: the session (logistics, briefing, convocation, decision makers,
    # stop procedure), 4: documents and follow-up (the calendar).
    assert sections["BRIEFING_DATE_REQUIRED"] == 3
    assert sections["CALENDAR_ORDER"] == 4
    # Optional aids are never issues: no invitation date, nobody briefed.
    assert {"INVITATION_NOT_SENT", "CONTROLLER_NOT_BRIEFED"}.isdisjoint(sections)

    stored = _get(client, ttx_id).json()
    assert stored["session_notes"] == "Parking at gate B; badges at reception"
    assert stored["invitation_text"].startswith("Dear Committee")
    controllers = [c["user_id"] for c in read["context"]["exercise_controllers"]]
    assert controllers  # the exercise's creator plans and controls it
    briefed = _save(
        client, ttx_id, _payload(_get(client, ttx_id).json(), briefed_controller_ids=controllers)
    ).json()
    assert briefed["briefed_controller_ids"] == controllers


def test_decision_makers_come_from_the_players_who_joined_or_by_hand(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    ttx_uuid = uuid.UUID(ttx_id)
    creator = uuid.UUID(exercise["ttx"]["created_by_id"])
    token = _seed_token(db_session, ttx_uuid, creator, "JOIN-PLAYERS")
    player = _account(db_session, "ceo@acme.com", "Carla CEO")
    waiting = _account(db_session, "cfo@acme.com", "Fede CFO")
    db_session.add(
        TTXAccessRequest(
            ttx_id=ttx_uuid,
            user_id=player.id,
            role=RoleEnum.PLAYER,
            invitation_token_id=token.id,
            status=AccessRequestStatus.APPROVED,
        )
    )
    db_session.add(TTXAccess(user_id=player.id, ttx_id=ttx_uuid, role=RoleEnum.PLAYER))
    db_session.add(
        TTXAccessRequest(
            ttx_id=ttx_uuid, user_id=waiting.id, role=RoleEnum.PLAYER, invitation_token_id=token.id
        )
    )
    db_session.commit()

    read = _get(client, ttx_id).json()
    assert "absence_risk_id" not in read and "risks" not in read["context"]
    [listed] = read["context"]["exercise_players"]
    assert (listed["full_name"], listed["email"]) == ("Carla CEO", "ceo@acme.com")
    assert listed["invited_at"] and listed["joined_at"]
    assert read["context"]["pending_access_requests"] == 1

    payload = _payload(read)
    payload["attendees"] = [
        {"user_id": str(player.id), "name": "whatever", "confirmed": True},
        {"user_id": str(waiting.id), "name": "Fede CFO", "confirmed": True},  # not a Player
        {"name": "Board chair", "role": "Chair", "confirmed": True},
    ]
    attendees = _save(client, ttx_id, payload).json()["attendees"]
    assert [(a["user_id"], a["name"]) for a in attendees] == [
        (str(player.id), "Carla CEO"),
        (None, "Fede CFO"),
        (None, "Board chair"),
    ]


def test_an_unconfirmed_decision_maker_needs_a_decision_beforehand(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = _complete(_get(client, ttx_id).json())
    payload["attendees"] = [
        {"name": "Chief Executive", "fallback": "substitute", "substitute": ""},
        {"name": "Chief Operations Officer", "fallback": "postpone"},
    ]

    report = _save(client, ttx_id, payload).json()["validation"]

    assert _codes(report) == {"DECISION_MAKER_WITHOUT_FALLBACK"}
    assert "SESSION_POSTPONE_PENDING" in _codes(report, "warnings")


def test_saves_are_locked_and_only_assign_the_exercises_evaluators(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()
    assert _save(client, ttx_id, _payload(read)).status_code == 200

    stale = _save(client, ttx_id, _payload(read))
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "CONDUCT_PREP_STALE"

    fresh = _get(client, ttx_id).json()
    planner = db_session.exec(select(User).where(User.email == "planner@acme.com")).one()
    outsider = _save(
        client,
        ttx_id,
        _payload(fresh, evaluators=[{"user_id": str(planner.id), "objective_ids": []}]),
    )
    assert outsider.status_code == 422
    assert outsider.json()["error"]["code"] == "NOT_AN_EVALUATOR"
    foreign = _save(
        client, ttx_id, _payload(fresh, findings=[{"id": str(uuid.uuid4()), "description": "x"}])
    )
    assert foreign.json()["error"]["code"] == "CONDUCT_PREP_ROW_NOT_FOUND"
    bad_zone = _save(client, ttx_id, _payload(fresh, timezone="Mars/Olympus"))
    assert bad_zone.status_code == 422


def test_removing_an_evaluator_drops_their_assignment(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    saved = _save(client, ttx_id, _complete(_get(client, ttx_id).json()))
    assert saved.json()["evaluators"]

    removed = client.delete(
        f"/api/v1/ttx/{ttx_id}/evaluators/{exercise['evaluator'].id}", headers=_csrf(client)
    )

    assert removed.status_code == 204
    assert db_session.exec(select(ConductPrepEvaluator)).all() == []
    read = _get(client, ttx_id).json()
    assert read["evaluators"] == []
    assert "OBJECTIVE_WITHOUT_EVALUATOR" in _codes(read["validation"])
    assert "LEAD_EVALUATOR_MISSING" in _codes(read["validation"], "warnings")


def test_a_seeded_point_keeps_its_source_text_and_a_custom_one_is_written_here(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = _payload(_get(client, ttx_id).json())
    points = payload["eeg"][0]["points"]
    for point in points:
        point["text"] = "Rewritten in the plan"
        point["criteria_u"] = "Not done"
    points.append({"text": "Spokesperson named"})

    dry = client.post(_url(ttx_id, "/validate"), json=payload, headers=_csrf(client))
    assert dry.status_code == 200, dry.text
    saved = _save(client, ttx_id, payload)
    assert saved.status_code == 200, saved.text
    stored = saved.json()["eeg"][0]["points"]
    assert stored[0]["text"] == "Documented decision with its rationale in 60 minutes"
    assert {p["text"] for p in stored if p["kind"] == "expected_action"} == {ACTIONS[0]}
    assert {p["source_status"] for p in stored if p["kind"] != "custom"} == {"current"}
    assert all(p["criteria_u"] == "Not done" for p in stored[:-1])
    assert stored[-1] == {**stored[-1], "kind": "custom", "text": "Spokesperson named"}


def test_a_seeded_point_is_removed_at_its_source_never_here(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = _payload(_get(client, ttx_id).json())
    seeded = payload["eeg"][0]["points"]
    payload["eeg"][0]["points"] = [{"text": "Spokesperson named"}]
    saved = _save(client, ttx_id, payload).json()["eeg"][0]["points"]
    # The custom point first, the seeded ones kept after it.
    assert saved[0]["kind"] == "custom"
    assert [p["id"] for p in saved[1:]] == [p["id"] for p in seeded]

    payload = _payload(_get(client, ttx_id).json())
    payload["eeg"][0]["points"] = payload["eeg"][0]["points"][1:]
    kept = _save(client, ttx_id, payload).json()["eeg"][0]["points"]
    assert [p["kind"] for p in kept if p["kind"] == "custom"] == []


def test_the_reseed_drops_a_clause_reworded_in_the_needs_analysis(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = _payload(_get(client, ttx_id).json())
    payload["eeg"][0]["points"][0]["criteria_p"] = "Within 60 min"
    assert _save(client, ttx_id, payload).status_code == 200

    assert _move_form(client, ttx_id, "draft").status_code == 200
    form = _get_form(client, ttx_id)
    needs = _complete_payload(form)
    for objective, stored in zip(needs["objectives"], form["objectives"], strict=True):
        objective["id"] = stored["id"]
    needs["objectives"][0]["success_criterion"] = "Decision logged within 45 minutes."
    assert _save_form(client, ttx_id, needs).status_code == 200
    assert _move_form(client, ttx_id, "ready_for_approval").status_code == 200
    assert _approve(client, ttx_id, "sponsor").status_code == 201
    assert _approve(client, ttx_id, "design_lead").status_code == 201
    assert _move_form(client, ttx_id, "approved").status_code == 200

    reseeded = client.post(_url(ttx_id, "/eeg/reseed"), headers=_csrf(client))
    assert reseeded.status_code == 200, reseeded.text
    clauses = [p["text"] for p in reseeded.json()["eeg"][0]["points"] if p["kind"] == "criterion"]
    assert clauses == ["Decision logged within 45 minutes"]
    assert all(p["source_status"] != "orphaned" for p in reseeded.json()["eeg"][0]["points"])


def test_a_plan_opened_before_the_msel_was_ready_is_reseeded_without_losing_edits(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    ttx_id = ttx["id"]
    _to_approved(client, ttx_id)
    read = _get(client, ttx_id).json()
    assert read["seeded_msel_version"] is None
    # No expected actions yet; the first objective cites NIS2 Art. 23.
    assert {p["kind"] for o in read["eeg"] for p in o["points"]} == {"criterion", "notification"}
    clause = read["eeg"][0]["points"][0]["text"]
    payload = _payload(read)
    # A seeded point's text is its source's: a rewrite here is ignored.
    payload["eeg"][0]["points"][0]["text"] = "Decision recorded with rationale within 60 min"
    payload["eeg"][0]["points"][0]["criteria_p"] = "Within 60 min"
    payload["eeg"][0]["points"].append({"text": "Spokesperson named"})
    saved = _save(client, ttx_id, payload)
    assert saved.status_code == 200
    assert saved.json()["eeg"][0]["points"][0]["text"] == clause

    _ready_msel(client, ttx_id)
    drifted = _get(client, ttx_id).json()
    assert drifted["drift"]["msel_changed"] is True
    assert "EEG_SOURCE_CHANGED" in _codes(drifted["validation"])

    reseeded = client.post(_url(ttx_id, "/eeg/reseed"), headers=_csrf(client))
    assert reseeded.status_code == 200, reseeded.text
    body = reseeded.json()
    assert body["seeded_msel_version"] == 1
    assert "EEG_SOURCE_CHANGED" not in _codes(body["validation"])
    points = body["eeg"][0]["points"]
    assert points[0]["text"] == clause
    assert points[0]["source_status"] == "current"
    assert points[0]["criteria_p"] == "Within 60 min"
    assert [p["text"] for p in points if p["kind"] == "custom"] == ["Spokesperson named"]
    assert [p["text"] for p in points if p["kind"] == "expected_action"] == [ACTIONS[0]] * len(
        [p for p in points if p["kind"] == "expected_action"]
    )


def test_an_eeg_lists_only_the_actions_that_evidence_its_objective(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx_id = _create_ttx(client, owner["organization"]["id"])["id"]
    _to_approved(client, ttx_id)
    msel = _open(client, ttx_id)
    objectives = [o["id"] for o in msel["needs"]["objectives"]]
    payload = example_payload(msel)
    inject = payload["injects"][0]
    inject["objective_ids"] = objectives[:2]
    inject["expected_actions"][0]["objective_ids"] = objectives[1:2]
    inject["expected_actions"][0]["description"] = "Second objective only"
    assert _put(client, ttx_id, payload).status_code == 200
    assert _move(client, ttx_id, "in_review").status_code == 200
    ready = _move(client, ttx_id, "ready").json()

    def texts(read: dict, index: int) -> list[str]:
        return [p["text"] for p in read["eeg"][index]["points"] if p["kind"] == "expected_action"]

    read = _get(client, ttx_id).json()
    assert "Second objective only" not in texts(read, 0)
    assert "Second objective only" in texts(read, 1)

    # The action moves to the first objective: its point is orphaned on
    # the second until the reseed moves it.
    again = _payload_from(ready)
    again["injects"][0]["expected_actions"][0]["objective_ids"] = objectives[:1]
    assert _put(client, ttx_id, again).status_code == 200
    assert _move(client, ttx_id, "in_review").status_code == 200
    assert _move(client, ttx_id, "ready").status_code == 200
    drifted = _get(client, ttx_id).json()
    moved = next(p for p in drifted["eeg"][1]["points"] if p["text"] == "Second objective only")
    assert moved["source_status"] == "orphaned"

    reseeded = client.post(_url(ttx_id, "/eeg/reseed"), headers=_csrf(client)).json()
    assert "Second objective only" in texts(reseeded, 0)
    assert "Second objective only" not in texts(reseeded, 1)


def test_an_action_frozen_before_it_named_objectives_evidences_all_of_its_injects() -> None:
    first, second = str(uuid.uuid4()), str(uuid.uuid4())
    inject = {"objective_ids": [first, second]}

    assert action_objective_ids({"code": "INJ-01-A1"}, inject) == [first, second]
    assert action_objective_ids({"objective_ids": [second, "gone"]}, inject) == [second]
    assert action_objective_ids({"objective_ids": []}, inject) == []


def test_the_plan_is_read_only_while_the_needs_analysis_is_revised(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()
    reopened = client.post(
        f"/api/v1/ttx/{ttx_id}/needs-form/transitions", json={"to": "draft"}, headers=_csrf(client)
    )
    assert reopened.status_code == 200, reopened.text

    assert _get(client, ttx_id).json()["editable"] is False
    refused = _save(client, ttx_id, _payload(read))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "NEEDS_FORM_NOT_APPROVED"


def test_the_session_instant_is_utc(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    read = _get(client, ttx_id).json()

    body = _save(
        client,
        ttx_id,
        _payload(
            read, session_date="2026-07-01", session_time="09:30:00", timezone="Europe/Madrid"
        ),
    ).json()

    starts = datetime.fromisoformat(body["session_starts_at"])
    assert starts.tzinfo is not None
    assert starts == datetime(2026, 7, 1, 7, 30, tzinfo=UTC)  # CEST, UTC+2


def test_control_and_evaluators_rate_with_the_ready_plans_eeg(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    from tests.test_ttx_evaluation import _as_evaluator

    ttx_id = exercise["ttx"]["id"]
    derived = client.get(f"/api/v1/ttx/{ttx_id}/eeg").json()
    assert derived["source"] == "derived" and derived["plan_version"] is None

    payload = _complete(_get(client, ttx_id).json())
    payload["eeg"][0]["points"][0]["criteria_s"] = "Decided after 60 minutes"
    assert _save(client, ttx_id, payload).status_code == 200
    ready = _transition(client, ttx_id, "ready")
    assert ready.status_code == 200
    # A new draft opens; the ready version stays in use.
    edited = _save(client, ttx_id, _payload(ready.json(), briefing_notes="v2"))
    assert edited.json()["version"] == 2

    _as_evaluator(client, db_session, {"evaluator": exercise["evaluator"]})
    eeg = client.get(f"/api/v1/ttx/{ttx_id}/eeg").json()

    assert eeg["source"] == "plan"
    assert eeg["plan_version"] == 1 and eeg["plan_reopened"] is True
    assert eeg["lead_evaluator"] == "Eva Luator"
    first = eeg["objectives"][0]
    assert first["evaluators"] == ["Eva Luator"]
    assert first["points"][0]["criteria"]["S"] == "Decided after 60 minutes"
    assert "stop_procedure" not in eeg and "attendees" not in eeg
