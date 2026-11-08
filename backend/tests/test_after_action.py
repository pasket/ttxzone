"""The editable after-action report and improvement plan: started from the
session, written by the Planners and the Lead Evaluator, frozen when
final, its plan followed up without reopening it -- and every plan of the
organization in one list for its Program Managers."""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import (
    AfterActionSnapshot,
    ConductPrepSnapshot,
    ExerciseRun,
    PlatformAuditEvent,
    RoleEnum,
    TTXAccess,
    UserSession,
)
from tests.test_exercise_run import _as_player, _pdf_text, _post, _ready_plan, _url
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import _account, _as_evaluator, _enable_totp, _login
from tests.test_ttx_needs_form import _csrf


def _aar(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/aar{suffix}"


def _payload(read: dict, **changes) -> dict:
    body = {
        "revision": read["revision"],
        "executive_summary": read["executive_summary"],
        "scenario_summary": read["scenario_summary"],
        "conclusions": read["conclusions"],
        "objectives": [
            {k: o[k] for k in ("id", "overall", "strengths", "improvements", "analysis")}
            for o in read["objectives"]
        ],
        "actions": [
            {
                k: a[k]
                for k in (
                    "id",
                    "objective_code",
                    "finding",
                    "action",
                    "owner",
                    "owner_area",
                    "due_date",
                    "status",
                    "status_note",
                )
            }  # fmt: skip
            for a in read["actions"]
        ],
    }
    return {**body, **changes}


@pytest.fixture
def played(client: TestClient, db_session: Session, exercise: dict) -> dict:  # noqa: F811
    """A session that ran: an inject released, its expected action missed,
    two points rated by the (Lead) Evaluator, then ended."""
    ttx_id = exercise["ttx"]["id"]
    _ready_plan(client, ttx_id)
    _post(client, ttx_id, "/start")
    control = client.get(_url(ttx_id)).json()["control"]
    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    _post(client, ttx_id, f"/injects/{first['code']}/release")
    action = first["expected_actions"][0]["code"]
    client.put(
        _url(ttx_id, f"/actions/{action}"), json={"mark": "not_observed"}, headers=_csrf(client)
    )
    client.put(
        _url(ttx_id, "/notes"),
        params={"as": "controller"},
        json={"inject_code": first["code"], "text": "Table hesitated on isolation"},
        headers=_csrf(client),
    )

    with TestClient(client.app) as evaluator:
        _as_evaluator(evaluator, db_session, {"evaluator": exercise["evaluator"]})
        points = [
            p for o in evaluator.get(_url(ttx_id, "/evaluation")).json()["objectives"]
            for p in o["points"]
        ]  # fmt: skip
        for point, level in zip(points[:2], ("P", "M"), strict=False):
            evaluator.put(
                _url(ttx_id, f"/ratings/{point['id']}"),
                json={"level": level, "rationale": f"Why {level}"},
                headers=_csrf(evaluator),
            )
    _post(client, ttx_id, "/end")
    return {**exercise, "ttx_id": ttx_id, "points": points, "action": action}


def test_the_report_waits_for_the_session(client: TestClient, exercise: dict) -> None:  # noqa: F811
    ttx_id = exercise["ttx"]["id"]
    assert client.get(_aar(ttx_id)).json()["error"]["code"] == "AAR_NOT_STARTED"
    early = client.post(_aar(ttx_id), headers=_csrf(client))
    assert early.json()["error"]["code"] == "RUN_NOT_STARTED"
    # Its screen previews it meanwhile: the objectives it will cover.
    preview = client.get(_aar(ttx_id, "/preview")).json()
    assert preview["session_started"] is False and preview["can_edit"] is True
    assert preview["objectives"] and all(o["code"] and o["title"] for o in preview["objectives"])


def test_the_preview_follows_the_session(client: TestClient, played: dict) -> None:
    preview = client.get(_aar(played["ttx_id"], "/preview")).json()
    assert preview["session_started"] is True
    assert preview["objectives"]


def test_it_starts_from_what_the_session_rated_and_saw(client: TestClient, played: dict) -> None:
    created = client.post(_aar(played["ttx_id"]), headers=_csrf(client))
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "draft" and body["version"] == 1 and body["can_edit"] is True
    assert client.post(_aar(played["ttx_id"]), headers=_csrf(client)).json()["error"]["code"] == (
        "AAR_EXISTS"
    )
    text = " ".join(o["strengths"] + o["improvements"] for o in body["objectives"])
    assert "Why P" in text and "Why M" in text
    # The missed expected action is an area for improvement.
    assert "not observed" in " ".join(o["improvements"] for o in body["objectives"])
    rated = [o for o in body["objectives"] if o["session_ratings"]]
    assert rated and rated[0]["overall"] in ("P", "M")
    assert {r["evaluator"] for o in rated for r in o["session_ratings"]} == {"Eva Luator"}


def test_it_is_written_frozen_and_followed_up(
    client: TestClient, db_session: Session, played: dict
) -> None:
    ttx_id = played["ttx_id"]
    read = client.post(_aar(ttx_id), headers=_csrf(client)).json()
    objective = read["objectives"][0]
    due = (date.today() - timedelta(days=2)).isoformat()
    new = {
        "objective_code": objective["objective_code"],
        "finding": "Nobody called the regulator",
        "action": "Add the regulator to the call tree",
        "owner": "Laura",
        "owner_area": "Legal",
        "due_date": due,
        "status": "open",
    }
    saved = client.put(
        _aar(ttx_id),
        json=_payload(read, conclusions="Good first run", actions=[new, {**new, "owner": "Ana"}]),
        headers=_csrf(client),
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert [a["code"] for a in body["actions"]] == ["IP-01", "IP-02"]
    assert body["actions"][0]["overdue"] is True

    stale = client.put(_aar(ttx_id), json=_payload(read), headers=_csrf(client))
    assert stale.json()["error"]["code"] == "AAR_STALE"
    # Removed codes are never reused.
    kept = _payload(body)
    kept["actions"] = kept["actions"][1:] + [{**new, "owner": "Sam"}]
    body = client.put(_aar(ttx_id), json=kept, headers=_csrf(client)).json()
    assert [a["code"] for a in body["actions"]] == ["IP-02", "IP-03"]

    # A sign-in long ago doesn't matter: marking it final is audited instead.
    for user_session in db_session.exec(select(UserSession)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()
    final = client.post(_aar(ttx_id, "/transitions"), json={"to": "final"}, headers=_csrf(client))
    assert final.json()["status"] == "final" and final.json()["finalized_by"] == "Ada Manager"
    assert db_session.exec(select(AfterActionSnapshot)).one().version == 1
    audited = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "exercise.aar_final")
    ).one()
    assert audited.target_id == uuid.UUID(ttx_id) and audited.details["version"] == 1

    # Following the plan up keeps it final.
    followed = client.patch(
        _aar(ttx_id, "/actions/IP-02"),
        json={"status": "done", "status_note": "Call tree updated"},
        headers=_csrf(client),
    ).json()
    assert followed["status"] == "final"
    done = next(a for a in followed["actions"] if a["code"] == "IP-02")
    assert done["status"] == "done" and done["overdue"] is False

    # Editing it opens version 2.
    edited = client.put(
        _aar(ttx_id), json=_payload(followed, conclusions="Revised"), headers=_csrf(client)
    ).json()
    assert edited["status"] == "draft" and edited["version"] == 2

    pdf = client.get(_aar(ttx_id, "/export.pdf"), params={"lang": "en"})
    assert pdf.status_code == 200
    report = _pdf_text(pdf.content)
    assert "Improvement plan" in report and "Add the regulator" in report and "DRAFT" in report


def test_who_writes_and_who_reads_it(client: TestClient, db_session: Session, played: dict) -> None:
    ttx_id = played["ttx_id"]
    read = client.post(_aar(ttx_id), headers=_csrf(client)).json()

    # The Lead Evaluator writes it.
    with TestClient(client.app) as lead:
        # Signed in again: TOTP is already on from the session, so sign in
        # before turning it back on (the test has no second factor to give).
        evaluator = played["evaluator"]
        db_session.refresh(evaluator)
        evaluator.totp_enabled = False
        db_session.add(evaluator)
        db_session.commit()
        _as_evaluator(lead, db_session, {"evaluator": evaluator})
        body = lead.get(_aar(ttx_id)).json()
        assert body["can_edit"] is True
        assert lead.put(_aar(ttx_id), json=_payload(body), headers=_csrf(lead)).status_code == 200

    # A Controller who doesn't plan reads it, read-only.
    controller = _account(db_session, "ctrl@acme.com", "Cal Controller")
    db_session.add(
        TTXAccess(
            user_id=controller.id,
            ttx_id=uuid.UUID(ttx_id),
            role=RoleEnum.PLANNER,
            plans=False,
            controls=True,
        )
    )
    db_session.commit()
    with TestClient(client.app) as other:
        _login(other, controller.email)
        _enable_totp(db_session, controller)
        controlled = other.get(_aar(ttx_id)).json()
        assert controlled["can_edit"] is False
        # A Controller reads the session's notes and feedback too.
        assert controlled["can_see_session"] is True
        assert other.get(_aar(ttx_id, "/preview")).json()["can_edit"] is False
        refused = other.put(_aar(ttx_id), json=_payload(read), headers=_csrf(other))
        assert refused.json()["error"]["code"] == "TTX_ACCESS_DENIED"
        moved = other.post(
            _aar(ttx_id, "/run"),
            json={"run_id": read["run_id"], "revision": read["revision"]},
            headers=_csrf(other),
        )
        assert moved.json()["error"]["code"] == "TTX_ACCESS_DENIED"

    with TestClient(client.app) as table:
        _as_player(table, db_session, ttx_id)
        assert table.get(_aar(ttx_id)).status_code == 403
        assert table.get(_aar(ttx_id, "/preview")).status_code == 403


def test_its_authors_keep_the_sessions_notes_and_feedback_at_hand(
    client: TestClient, played: dict
) -> None:
    ttx_id = played["ttx_id"]
    report = client.post(_aar(ttx_id), headers=_csrf(client)).json()
    assert report["can_see_session"] is True and report["run_id"]
    # A new run archives the one the report was written from...
    restarted = client.post(
        _url(ttx_id, "/restart"),
        json={"mode": "archive", "confirmation": "restart"},
        headers=_csrf(client),
    )
    assert restarted.status_code == 200, restarted.text
    assert client.get(_url(ttx_id, "/notes/team")).json()["items"] == []
    # ...and the report still reads that run's.
    run = {"run": report["run_id"]}
    notes = client.get(_url(ttx_id, "/notes/team"), params=run).json()["items"]
    assert [n["text"] for n in notes] == ["Table hesitated on isolation"]
    results = client.get(_url(ttx_id, "/feedback/results"), params=run)
    assert results.status_code == 200 and results.json()["responses"] == 0
    other = client.get(_url(ttx_id, "/notes/team"), params={"run": str(uuid.uuid4())})
    assert other.json()["error"]["code"] == "RUN_NOT_FOUND"


def test_an_archived_run_can_still_get_its_report(client: TestClient, played: dict) -> None:
    """Restarting before writing the report doesn't lose the chance: the
    report can start from the archived run, by default or chosen beside a
    newer one."""
    ttx_id = played["ttx_id"]
    first_run = client.get(_aar(ttx_id, "/preview")).json()["runs"][0]
    assert first_run["current"] is True
    restarted = client.post(
        _url(ttx_id, "/restart"),
        json={"mode": "archive", "confirmation": "restart"},
        headers=_csrf(client),
    )
    assert restarted.status_code == 200, restarted.text
    # No current run: the latest archived one is the default.
    preview = client.get(_aar(ttx_id, "/preview")).json()
    assert preview["session_started"] is True
    assert [(r["id"], r["current"]) for r in preview["runs"]] == [(first_run["id"], False)]

    # A new run starts: it comes first, the archived one stays choosable.
    _post(client, ttx_id, "/start")
    runs = client.get(_aar(ttx_id, "/preview")).json()["runs"]
    assert [r["current"] for r in runs] == [True, False]
    unknown = client.post(_aar(ttx_id), json={"run_id": str(uuid.uuid4())}, headers=_csrf(client))
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "RUN_NOT_FOUND"

    created = client.post(_aar(ttx_id), json={"run_id": first_run["id"]}, headers=_csrf(client))
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["run_id"] == first_run["id"]
    text = " ".join(o["strengths"] + o["improvements"] for o in body["objectives"])
    assert "Why P" in text and "Why M" in text


def _second_run(client: TestClient, ttx_id: str) -> tuple[dict, str]:
    """A report written from the played run, then a restart and a second
    run that ends with nothing rated: the report and the new run's id."""
    report = client.post(_aar(ttx_id), headers=_csrf(client)).json()
    restarted = client.post(
        _url(ttx_id, "/restart"),
        json={"mode": "archive", "confirmation": "restart"},
        headers=_csrf(client),
    )
    assert restarted.status_code == 200, restarted.text
    _post(client, ttx_id, "/start")
    _post(client, ttx_id, "/end")
    runs = client.get(_aar(ttx_id)).json()["runs"]
    assert [r["current"] for r in runs] == [True, False]
    return report, runs[0]["id"]


def _change(client: TestClient, ttx_id: str, report: dict, run_id: str):
    return client.post(
        _aar(ttx_id, "/run"),
        json={"run_id": run_id, "revision": report["revision"]},
        headers=_csrf(client),
    )


def test_the_report_can_move_to_another_session(client: TestClient, played: dict) -> None:
    """What's written stays; the session's ratings beside it, and which run
    can't be deleted, follow the run it's now written from."""
    ttx_id = played["ttx_id"]
    report, second = _second_run(client, ttx_id)
    first = report["run_id"]
    report = client.put(
        _aar(ttx_id), json=_payload(report, conclusions="Kept"), headers=_csrf(client)
    ).json()
    assert any(o["session_ratings"] for o in report["objectives"])
    final = client.post(_aar(ttx_id, "/transitions"), json={"to": "final"}, headers=_csrf(client))
    assert final.status_code == 200, final.text
    report = final.json()

    stale = client.post(
        _aar(ttx_id, "/run"),
        json={"run_id": second, "revision": report["revision"] - 1},
        headers=_csrf(client),
    )
    assert stale.json()["error"]["code"] == "AAR_STALE"
    unknown = _change(client, ttx_id, report, str(uuid.uuid4()))
    assert unknown.status_code == 404 and unknown.json()["error"]["code"] == "RUN_NOT_FOUND"

    moved = _change(client, ttx_id, report, second)
    assert moved.status_code == 200, moved.text
    body = moved.json()
    assert body["run_id"] == second and body["conclusions"] == "Kept"
    assert [o["strengths"] + o["improvements"] for o in body["objectives"]] == [
        o["strengths"] + o["improvements"] for o in report["objectives"]
    ]
    assert not any(o["session_ratings"] for o in body["objectives"])
    # Like any edit, it reopens a final report as the next version.
    assert (body["status"], body["version"]) == ("draft", 2)
    # Moving it to the run it's on already changes nothing.
    assert _change(client, ttx_id, body, second).json()["revision"] == body["revision"]

    # The first run is free to go, the second one is held by the report.
    history = client.get(_url(ttx_id, "/history")).json()["items"]
    assert [(h["id"], h["has_report"]) for h in history] == [(first, False)]
    deleted = client.post(
        _url(ttx_id, "/restart"),
        json={"mode": "delete", "confirmation": "restart"},
        headers=_csrf(client),
    )
    assert deleted.json()["error"]["code"] == "RUN_HAS_REPORT"


def test_moving_the_report_follows_the_new_sessions_objectives(
    client: TestClient, db_session: Session, played: dict
) -> None:
    """An objective the new session's plan adds comes in; one it drops goes
    only if nothing was written in it."""
    ttx_id = played["ttx_id"]
    report, second = _second_run(client, ttx_id)
    run = db_session.get(ExerciseRun, uuid.UUID(second))
    plan = db_session.get(ConductPrepSnapshot, run.plan_snapshot_id)
    payload = dict(plan.payload)
    dropped = payload["eeg"][-1]
    payload["eeg"] = [
        *payload["eeg"][:-1],
        {**dropped, "code": "OBJ-99", "objective_id": str(uuid.uuid4()), "title": "New one"},
    ]
    changed = ConductPrepSnapshot(
        prep_id=plan.prep_id, version=plan.version + 1, payload=payload,
        created_by_id=plan.created_by_id,
    )  # fmt: skip
    db_session.add(changed)
    db_session.flush()
    run.plan_snapshot_id = changed.id
    db_session.add(run)
    db_session.commit()

    # The dropped objective holds the session's lines: refused.
    gone = next(o for o in report["objectives"] if o["objective_code"] == dropped["code"])
    if not (gone["overall"] or gone["strengths"] or gone["improvements"] or gone["analysis"]):
        report = client.put(
            _aar(ttx_id),
            json=_payload(
                report,
                objectives=[
                    {**p, "analysis": "Written"} if p["id"] == gone["id"] else p
                    for p in _payload(report)["objectives"]
                ],
            ),
            headers=_csrf(client),
        ).json()
    refused = _change(client, ttx_id, report, second)
    assert refused.status_code == 409
    error = refused.json()["error"]
    assert error["code"] == "AAR_OBJECTIVES_IN_USE" and dropped["code"] in error["message"]

    # Emptied, it goes, and the new objective comes in last.
    report = client.put(
        _aar(ttx_id),
        json=_payload(
            report,
            objectives=[
                {**p, "overall": None, "strengths": "", "improvements": "", "analysis": ""}
                if p["id"] == gone["id"]
                else p
                for p in _payload(report)["objectives"]
            ],
        ),
        headers=_csrf(client),
    ).json()
    # ...unless an improvement action cites it.
    cited = client.put(
        _aar(ttx_id),
        json=_payload(
            report,
            actions=[{"objective_code": dropped["code"], "finding": "F", "action": "A"}],
        ),
        headers=_csrf(client),
    ).json()
    assert _change(client, ttx_id, cited, second).json()["error"]["code"] == (
        "AAR_OBJECTIVES_IN_USE"
    )
    report = client.put(_aar(ttx_id), json=_payload(cited, actions=[]), headers=_csrf(client))
    moved = _change(client, ttx_id, report.json(), second)
    assert moved.status_code == 200, moved.text
    codes = [o["objective_code"] for o in moved.json()["objectives"]]
    assert dropped["code"] not in codes and codes[-1] == "OBJ-99"
    assert moved.json()["objectives"][-1]["title"] == "New one"


def test_the_program_manager_follows_every_plan_of_the_organization(
    client: TestClient, played: dict
) -> None:
    ttx_id = played["ttx_id"]
    read = client.post(_aar(ttx_id), headers=_csrf(client)).json()
    past = (date.today() - timedelta(days=1)).isoformat()
    later = (date.today() + timedelta(days=30)).isoformat()
    actions = [
        {"finding": "F1", "action": "Overdue one", "owner": "Laura", "due_date": past},
        {"finding": "F2", "action": "Later one", "owner": "Ana", "due_date": later},
        {
            "finding": "F3",
            "action": "Closed one",
            "owner": "Sam",
            "due_date": past,
            "status": "done",
        },
    ]
    client.put(_aar(ttx_id), json=_payload(read, actions=actions), headers=_csrf(client))

    url = f"/api/v1/organizations/{played['org_id']}/improvement-plan"
    every = client.get(url).json()
    assert every["total"] == 3 and every["open"] == 2 and every["overdue"] == 1
    assert [i["action"] for i in every["items"]][0] in ("Overdue one", "Closed one")
    overdue = client.get(url, params={"overdue": True}).json()["items"]
    assert [i["action"] for i in overdue] == ["Overdue one"]
    assert client.get(url, params={"q": "ana"}).json()["items"][0]["action"] == "Later one"
    # The organization's dashboard counts them too.
    kpis = client.get(f"/api/v1/organizations/{played['org_id']}/dashboard").json()["kpis"]
    assert (kpis["improvement_open"], kpis["improvement_overdue"]) == (2, 1)
