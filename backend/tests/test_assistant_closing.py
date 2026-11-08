"""What lets the assistant close a document: schemas a client reads in one
go, the scope, deletions, dry runs with their balance (what proposals add
and resolve), pending proposals counted, and no field dropped silently."""

import json
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import TTX, AssistantProposal
from app.services.assistant import proposals
from app.services.assistant.tools import TOOLS
from app.services.ttx_msel_service import find_msel, msel_read
from app.services.ttx_needs_form_service import form_read, get_form
from tests.assistant_helpers import call, create_token
from tests.test_assistant_proposals import PROPOSALS, _approved_with_msel, _list
from tests.test_assistant_tools import _data, _error_code
from tests.test_ttx_needs_form import _csrf

TECHNIQUE = {"domain": "enterprise", "tactic_id": "TA0040", "technique_id": "T1486"}


def _ttx(db_session: Session, ttx_id: str) -> TTX:
    db_session.expire_all()
    return db_session.get(TTX, uuid.UUID(ttx_id))


def _proposal(db_session: Session, answer: dict, index: int = 0) -> AssistantProposal:
    db_session.expire_all()
    return db_session.get(AssistantProposal, uuid.UUID(answer["proposals"][index]["id"]))


def test_every_schema_is_readable_without_refs() -> None:
    for name, spec in TOOLS.items():
        schema = json.dumps(spec.input_schema())
        assert "$ref" not in schema and "$defs" not in schema, name
    needs = TOOLS["propose_needs"].input_schema()
    item = needs["properties"]["items"]["items"]
    source = item["properties"]["source"]
    assert "enum" in json.dumps(source)
    assert {"dry_run", "include_pending"} <= set(needs["properties"])


def test_the_scope_is_proposed_and_measured_on_the_msel(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    form = client.get(f"/api/v1/ttx/{ttx_id}/needs-form").json()

    emptied = _data(
        call(
            client,
            token,
            "propose_scope",
            {"ttx_id": ttx_id, "participating_areas": [], "third_parties": [], "dry_run": True},
        )
    )
    # Without areas, every inject's recipients warn on the MSEL: measured, kept nowhere.
    assert emptied["dry_run"] is True and "id" not in emptied["proposals"][0]
    assert emptied["impact_on_msel"]["adds"] > 0
    assert _list(client, ttx_id) == []

    areas = [*form["participating_areas"], "Board"]
    made = _data(
        call(client, token, "propose_scope", {"ttx_id": ttx_id, "participating_areas": areas})
    )
    scope = _proposal(db_session, made)
    assert (scope.target, scope.operation) == ("needs_scope", "update")
    assert scope.target_id == uuid.UUID(form["id"])
    assert scope.patch == {"participating_areas": areas}

    # Accepted and saved as the page does, it reads back held and is marked applied.
    ttx = _ttx(db_session, ttx_id)
    payload = proposals.payload_from_form(form_read(db_session, ttx, get_form(db_session, ttx.id)))
    proposals.apply_needs(payload, scope)
    saved = client.put(f"/api/v1/ttx/{ttx_id}/needs-form", json=payload, headers=_csrf(client))
    assert saved.status_code == 200, saved.text
    assert client.get(f"/api/v1/ttx/{ttx_id}/needs-form").json()["participating_areas"] == areas
    applied = client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{scope.id}/applied",
        json={"row_id": form["id"]},
        headers=_csrf(client),
    )
    assert applied.status_code == 200, applied.text


def test_rows_are_deleted_with_what_named_them(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    inject = msel["injects"][-1]

    def propose(tool: str, item: dict, **options) -> dict:
        return call(client, token, tool, {"ttx_id": ttx_id, "items": [item], **options})

    assert _error_code(propose("propose_injects", {"delete": True})) == (
        "ASSISTANT_PROPOSAL_INCOMPLETE"
    )
    with_more = propose("propose_injects", {"code": inject["code"], "delete": True, "title": "x"})
    assert _error_code(with_more) == "ASSISTANT_PROPOSAL_INVALID"
    phase = msel["phases"][0]
    holding = propose("propose_phases", {"code": phase["code"], "delete": True})
    assert _error_code(holding) == "ASSISTANT_PROPOSAL_INVALID"
    assert phase["code"] in holding["content"][0]["text"]

    deletion = _proposal(
        db_session, _data(propose("propose_injects", {"code": inject["code"], "delete": True}))
    )
    assert (deletion.operation, deletion.patch) == ("delete", {})
    early = client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{deletion.id}/applied",
        json={"row_id": inject["id"]},
        headers=_csrf(client),
    )
    assert early.json()["error"]["code"] == "ASSISTANT_PROPOSAL_ROW_NOT_SAVED"

    ttx = _ttx(db_session, ttx_id)
    payload = proposals.payload_from_msel(msel_read(db_session, ttx, find_msel(db_session, ttx.id)))
    proposals._apply_msel(payload, deletion)
    saved = client.put(f"/api/v1/ttx/{ttx_id}/msel", json=payload, headers=_csrf(client))
    assert saved.status_code == 200, saved.text
    assert inject["id"] not in {i["id"] for i in saved.json()["injects"]}
    applied = client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{deletion.id}/applied",
        json={"row_id": inject["id"]},
        headers=_csrf(client),
    )
    assert applied.status_code == 200, applied.text

    # A need goes with its links from objectives.
    form = client.get(f"/api/v1/ttx/{ttx_id}/needs-form").json()
    linked = next(o for o in form["objectives"] if o["linked_need_ids"])
    need_id = linked["linked_need_ids"][0]
    need = next(n for n in form["needs"] if n["id"] == need_id)
    gone = _proposal(
        db_session, _data(propose("propose_needs", {"code": need["code"], "delete": True}))
    )
    ttx = _ttx(db_session, ttx_id)
    payload = proposals.payload_from_form(form_read(db_session, ttx, get_form(db_session, ttx.id)))
    proposals.apply_needs(payload, gone)
    assert need_id not in {n["id"] for n in payload["needs"]}
    assert all(need_id not in o["linked_need_keys"] for o in payload["objectives"])


def test_a_dry_run_measures_and_keeps_nothing(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    inject = msel["injects"][0]

    measured = _data(
        call(
            client,
            token,
            "propose_injects",
            {
                "ttx_id": ttx_id,
                "dry_run": True,
                "items": [{"code": inject["code"], "recipients": ["Nobody in scope"]}],
            },
        )
    )
    assert measured["dry_run"] is True
    assert measured["impact"]["adds"] >= 1
    assert any(i["code"] == "RECIPIENT_NOT_IN_SCOPE" for i in measured["impact"]["added"])
    assert "Nothing was kept" in measured["next_step"]
    assert _list(client, ttx_id) == []


def test_pending_proposals_count_as_accepted(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    phase = msel["phases"][1]
    # Pending: the phase ends earlier.
    _data(
        call(
            client,
            token,
            "propose_phases",
            {
                "ttx_id": ttx_id,
                "items": [{"code": phase["code"], "end_minute": phase["start_offset"] + 10}],
            },
        )
    )
    item = {
        "phase": phase["code"],
        "title": "Late call",
        "minute": phase["start_offset"] + 30,
    }

    def outside(include_pending: bool) -> bool:
        answer = _data(
            call(
                client,
                token,
                "propose_injects",
                {
                    "ttx_id": ttx_id,
                    "dry_run": True,
                    "include_pending": include_pending,
                    "items": [item],
                },
            )
        )
        return any(i["code"] == "INJECT_OUTSIDE_PHASE" for i in answer["impact"]["added"])

    assert outside(True) is True
    assert outside(False) is False


def test_nothing_is_dropped_silently_and_the_list_explains_itself(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    objective = msel["needs"]["objectives"][0]["code"]

    poll = call(
        client,
        token,
        "propose_injects",
        {
            "ttx_id": ttx_id,
            "items": [
                {
                    "phase": msel["phases"][0]["code"],
                    "title": "Pay the ransom?",
                    "format": "poll",
                    "poll_question": "Do we pay?",
                    "poll_options": ["Yes", "No"],
                    "objectives": [objective],
                }
            ],
        },
    )
    assert _error_code(poll) == "ASSISTANT_PROPOSAL_INVALID"
    assert "a poll or a discussion doesn't" in poll["content"][0]["text"]

    # A threat actor's technique takes a tactic like an inject's, and drops it.
    threat = _proposal(
        db_session,
        _data(
            call(
                client,
                token,
                "propose_threat_actors",
                {"ttx_id": ttx_id, "items": [{"name": "Crew", "techniques": [TECHNIQUE]}]},
            )
        ),
    )
    assert threat.patch["techniques"] == [{"domain": "enterprise", "technique_id": "T1486"}]

    inject = msel["injects"][0]
    _data(
        call(
            client,
            token,
            "propose_injects",
            {"ttx_id": ttx_id, "items": [{"code": inject["code"], "title": "Renamed"}]},
        )
    )
    listed = _data(call(client, token, "list_my_proposals", {"ttx_id": ttx_id}))["proposals"]
    change = next(p for p in listed if p["target"] == "inject")
    assert change["code"] == inject["code"]
    assert change["summary"] == f"{inject['code']}: title"
    new = next(p for p in listed if p["target"] == "msel_threat")
    assert new["summary"] == "New threat actor: Crew" and new["depends_on"] == []


# --- MSEL coverage ----------------------------------------------------------------


def _msel_payload(db_session: Session, ttx_id: str) -> dict:
    ttx = _ttx(db_session, ttx_id)
    return proposals.payload_from_msel(msel_read(db_session, ttx, find_msel(db_session, ttx.id)))


def _save_msel(client: TestClient, ttx_id: str, payload: dict) -> dict:
    saved = client.put(f"/api/v1/ttx/{ttx_id}/msel", json=payload, headers=_csrf(client))
    assert saved.status_code == 200, saved.text
    return saved.json()


def test_expected_actions_are_replaced_on_a_change(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    inject = next(i for i in msel["injects"] if i["expected_actions"])
    actions = [
        {
            "description": "Isolate the file servers.",
            "responsible_role": "IT",
            "within_minutes": 10,
        },
        {"description": "Call the insurer.", "responsible_role": "Legal"},
    ]
    change = _proposal(
        db_session,
        _data(
            call(
                client,
                token,
                "propose_injects",
                {
                    "ttx_id": ttx_id,
                    "items": [{"code": inject["code"], "expected_actions": actions}],
                },
            )
        ),
    )
    payload = _msel_payload(db_session, ttx_id)
    proposals._apply_msel(payload, change)
    saved = _save_msel(client, ttx_id, payload)
    [after] = [i for i in saved["injects"] if i["id"] == inject["id"]]
    assert [a["description"] for a in after["expected_actions"]] == [
        "Isolate the file servers.",
        "Call the insurer.",
    ]
    assert after["expected_actions"][0]["expected_within_minutes"] == 10


def test_a_contingent_inject_is_anchored(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    parent = next(i for i in msel["injects"] if i["kind"] == "mandatory" and i["expected_actions"])
    later = next(
        i
        for i in msel["injects"]
        if i["kind"] == "mandatory" and i["offset_minutes"] > parent["offset_minutes"]
    )
    phase = next(p for p in msel["phases"] if p["id"] == parent["phase_id"])
    action = parent["expected_actions"][0]
    made = _proposal(
        db_session,
        _data(
            call(
                client,
                token,
                "propose_injects",
                {
                    "ttx_id": ttx_id,
                    "items": [
                        {
                            "phase": phase["code"],
                            "kind": "contingent",
                            "title": "The SOC escalates on its own",
                            "trigger_condition": "Nobody isolates the servers.",
                            "contingent_purpose": "Raise the pressure.",
                            "fires_at_minute": 5,
                            "branch_from": parent["code"],
                            "branch_action": action["code"],
                            "rejoin": later["code"],
                        }
                    ],
                },
            )
        ),
    )
    assert made.patch["branch_from_key"] == parent["id"]
    assert made.patch["branch_action_key"] == action["id"]
    assert made.patch["rejoin_key"] == later["id"]

    unknown = call(
        client,
        token,
        "propose_injects",
        {
            "ttx_id": ttx_id,
            "items": [
                {
                    "phase": phase["code"],
                    "kind": "contingent",
                    "title": "x",
                    "branch_from": parent["code"],
                    "branch_action": "INJ-99-A9",
                }
            ],
        },
    )
    assert _error_code(unknown) == "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"
    # A mandatory inject doesn't hang from another: said, not dropped.
    mandatory = call(
        client,
        token,
        "propose_injects",
        {
            "ttx_id": ttx_id,
            "items": [{"phase": phase["code"], "title": "x", "branch_from": parent["code"]}],
        },
    )
    assert _error_code(mandatory) == "ASSISTANT_PROPOSAL_INVALID"
    assert "contingent" in mandatory["content"][0]["text"]


def test_the_msel_settings_and_meters_are_proposed(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    answer = _data(
        call(
            client,
            token,
            "propose_msel_settings",
            {
                "ttx_id": ttx_id,
                "title": "Ransomware at the plant",
                "exercise_start": "10:00",
                "time_compression": 30,
                "meters": [*({"name": m["name"]} for m in msel["meters"]), {"name": "Reputation"}],
            },
        )
    )
    settings = _proposal(db_session, answer)
    assert (settings.target, settings.target_id) == ("msel_meta", uuid.UUID(msel["id"]))
    assert settings.patch["exercise_start"] == "10:00"
    assert answer["meter_keys"]["Reputation"] == "reputation"
    # Existing meters keep their keys.
    assert all(answer["meter_keys"][m["name"]] == m["key"] for m in msel["meters"])

    payload = _msel_payload(db_session, ttx_id)
    proposals._apply_msel(payload, settings)
    saved = _save_msel(client, ttx_id, payload)
    assert saved["title"] == "Ransomware at the plant"
    assert saved["exercise_start"].startswith("10:00") and saved["time_compression"] == 30
    rows = proposals.saved_rows(db_session, _ttx(db_session, ttx_id), "msel_meta")
    assert rows[msel["id"]]["exercise_start"] == "10:00"


def test_a_newer_proposal_supersedes_an_older_one_on_the_same_fields(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    inject = msel["injects"][0]

    def propose(item: dict) -> dict:
        return _data(call(client, token, "propose_injects", {"ttx_id": ttx_id, "items": [item]}))

    first = propose({"code": inject["code"], "title": "First try"})["proposals"][0]["id"]
    other = propose({"code": inject["code"], "content": "Another field"})["proposals"][0]["id"]
    second = propose({"code": inject["code"], "title": "Second try"})
    assert second["superseded"] == [first]
    pending = {p["id"] for p in _list(client, ttx_id)}
    assert first not in pending and other in pending
    deleted = propose({"code": inject["code"], "delete": True})
    assert set(deleted["superseded"]) == {other, second["proposals"][0]["id"]}


# --- The guide to close documents -------------------------------------------------


def test_the_report_says_how_each_issue_is_fixed_and_what_causes_most(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    # Three injects for someone outside the scope: one cause, three warnings.
    payload = _msel_payload(db_session, ttx_id)
    for row in payload["injects"][:3]:
        row["recipients"] = ["Nobody in scope"]
    _save_msel(client, ttx_id, payload)

    report = _data(
        call(client, token, "get_validation_report", {"ttx_id": ttx_id, "document": "msel"})
    )
    outside = [i for i in report["blocks_ready"] if i["code"] == "RECIPIENT_NOT_IN_SCOPE"]
    assert len(outside) == 3
    assert outside[0]["fix"] == {
        "by": "assistant",
        "tool": "propose_scope",
        "field": "participating_areas",
    }
    [cause] = [c for c in report["root_causes"] if c["code"] == "RECIPIENT_NOT_IN_SCOPE"]
    assert cause["count"] == 3
    assert report["root_causes"][0]["count"] >= 3

    plan = _data(call(client, token, "plan_to_ready", {"ttx_id": ttx_id, "document": "msel"}))
    tools = [s["tool"] for s in plan["steps"] if s["by"] == "assistant"]
    assert tools[0] == "propose_scope"
    assert tools == sorted(tools, key=fixes_order().index)
    assert plan["steps"][0]["step"] == 1 and "READY" in plan["then"]
    assert plan["blocking"] >= 3


def fixes_order() -> list[str]:
    from app.services.assistant.fixes import TOOL_ORDER

    return list(TOOL_ORDER)


def test_a_fresh_needs_analysis_plans_proposals_then_the_persons_steps(
    client: TestClient, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    plan = _data(
        call(client, token, "plan_to_ready", {"ttx_id": ttx_id, "document": "needs_analysis"})
    )
    kinds = [s["by"] for s in plan["steps"]]
    assert kinds and kinds == sorted(kinds)  # the assistant's steps first, then the person's
    assert any(s["by"] == "you" and s.get("where") for s in plan["steps"])
    assert "approval" in plan["then"].lower()


# --- Governance and changesets ------------------------------------------------------


def test_every_result_about_an_exercise_carries_its_classification(
    client: TestClient, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    overview = _data(call(client, token, "get_exercise_overview", {"ttx_id": ttx_id}))
    assert overview["classification"]["tlp"] == overview["tlp"]
    assert overview["classification"]["handling"].startswith("TLP:")
    # Nothing about an exercise: nothing to classify.
    assert "classification" not in _data(call(client, token, "list_exercises", {}))


def test_deciding_a_proposal_lands_in_the_activity_log_without_its_content(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    from sqlmodel import select

    from app.models import PlatformAuditEvent

    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    inject = msel["injects"][0]
    made = _data(
        call(
            client,
            token,
            "propose_injects",
            {
                "ttx_id": ttx_id,
                "items": [
                    {"code": inject["code"], "title": "A secret title"},
                    {"code": msel["injects"][1]["code"], "content": "Another"},
                ],
            },
        )
    )
    first, second = (p["id"] for p in made["proposals"])
    change = db_session.get(AssistantProposal, uuid.UUID(first))
    payload = _msel_payload(db_session, ttx_id)
    proposals._apply_msel(payload, change)
    _save_msel(client, ttx_id, payload)
    client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{first}/applied",
        json={"row_id": inject["id"]},
        headers=_csrf(client),
    )
    client.post(f"{PROPOSALS.format(ttx_id=ttx_id)}/{second}/discard", headers=_csrf(client))

    db_session.expire_all()
    events = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action.startswith("assistant.proposal"))
    ).all()
    by_action = {e.action: e for e in events}
    accepted = by_action["assistant.proposal_accepted"]
    assert accepted.target_kind == "exercise" and str(accepted.target_id) == ttx_id
    assert accepted.details["row"] == inject["code"]
    assert accepted.details["operation"] == "update"
    assert "A secret title" not in json.dumps(accepted.details)
    assert by_action["assistant.proposal_discarded"].details["proposal_id"] == second


def test_a_changeset_names_proposals_made_over_several_calls(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    for inject in msel["injects"][:2]:
        answer = _data(
            call(
                client,
                token,
                "propose_injects",
                {
                    "ttx_id": ttx_id,
                    "changeset": "Close MSEL v5",
                    "items": [{"code": inject["code"], "title": f"{inject['title']}!"}],
                },
            )
        )
        assert answer["changeset"] == "Close MSEL v5"
    _data(
        call(
            client,
            token,
            "propose_msel_settings",
            {"ttx_id": ttx_id, "title": "Elsewhere", "changeset": "Other"},
        )
    )
    listed = _data(
        call(client, token, "list_my_proposals", {"ttx_id": ttx_id, "changeset": "Close MSEL v5"})
    )["proposals"]
    assert len(listed) == 2 and {p["changeset"] for p in listed} == {"Close MSEL v5"}
    page = _list(client, ttx_id)
    assert {p["changeset"] for p in page} == {"Close MSEL v5", "Other"}
    # A dry run keeps nothing, so names nothing.
    dry = _data(
        call(
            client,
            token,
            "propose_injects",
            {
                "ttx_id": ttx_id,
                "dry_run": True,
                "changeset": "Close MSEL v5",
                "items": [{"code": msel["injects"][2]["code"], "title": "x"}],
            },
        )
    )
    assert "changeset" not in dry


def test_a_code_reset_is_proposed_and_applied_once_the_codes_follow_the_order(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    # Deleting the first inject leaves a gap: inject codes are out of order.
    payload = _msel_payload(db_session, ttx_id)
    # And no contingent inject left to anchor, which would move the order again.
    payload["injects"] = [i for i in payload["injects"][1:] if i["kind"] != "contingent"]
    _save_msel(client, ttx_id, payload)

    msel = _data(call(client, token, "get_msel", {"ttx_id": ttx_id}))
    assert "injects" in msel["codes_out_of_order"]
    plan = _data(call(client, token, "plan_to_ready", {"ttx_id": ttx_id, "document": "msel"}))
    assert plan["codes"]["field"] == "reset_codes" and "injects" in plan["codes"]["kinds"]

    in_order = [k for k in ("phases", "threat_actors") if k not in msel["codes_out_of_order"]]
    if in_order:
        already = call(
            client, token, "propose_msel_settings", {"ttx_id": ttx_id, "reset_codes": in_order}
        )
        assert _error_code(already) == "ASSISTANT_PROPOSAL_NO_CHANGE"

    made = _data(
        call(client, token, "propose_msel_settings", {"ttx_id": ttx_id, "reset_codes": ["injects"]})
    )
    reset = _proposal(db_session, made)
    assert (reset.target, reset.patch) == ("msel_renumber", {"kind": "injects"})
    early = client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{reset.id}/applied",
        json={"row_id": str(reset.target_id)},
        headers=_csrf(client),
    )
    assert early.json()["error"]["code"] == "ASSISTANT_PROPOSAL_ROW_NOT_SAVED"

    # The page runs the reset (its button), then marks the proposal applied.
    done = client.post(
        f"/api/v1/ttx/{ttx_id}/msel/renumber",
        json={"kind": "injects", "codes": None},
        headers=_csrf(client),
    )
    assert done.status_code == 200, done.text
    applied = client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{reset.id}/applied",
        json={"row_id": str(reset.target_id)},
        headers=_csrf(client),
    )
    assert applied.status_code == 200, applied.text


def test_the_players_summary_is_not_the_reason(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    settings = _proposal(
        db_session,
        _data(
            call(
                client,
                token,
                "propose_msel_settings",
                {
                    "ttx_id": ttx_id,
                    "players_summary": "A ransomware hits the plant on a Monday.",
                    "summary": "The players need context before the first inject.",
                },
            )
        ),
    )
    assert settings.patch == {"summary": "A ransomware hits the plant on a Monday."}
    assert settings.summary == "The players need context before the first inject."


def test_codes_are_reset_once_nothing_pending_moves_them(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    payload = _msel_payload(db_session, ttx_id)
    # And no contingent inject left to anchor, which would move the order again.
    payload["injects"] = [i for i in payload["injects"][1:] if i["kind"] != "contingent"]
    _save_msel(client, ttx_id, payload)
    _data(
        call(
            client,
            token,
            "propose_injects",
            {"ttx_id": ttx_id, "items": [{"code": _kept(db_session, ttx_id), "title": "Moved"}]},
        )
    )
    waiting = call(
        client, token, "propose_msel_settings", {"ttx_id": ttx_id, "reset_codes": ["injects"]}
    )
    assert _error_code(waiting) == "ASSISTANT_PROPOSAL_INVALID"
    assert "still pending" in waiting["content"][0]["text"]


def test_an_inject_waits_for_the_scope_that_lets_its_recipient_in(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    form = client.get(f"/api/v1/ttx/{ttx_id}/needs-form").json()
    scope = _data(
        call(
            client,
            token,
            "propose_scope",
            {"ttx_id": ttx_id, "participating_areas": [*form["participating_areas"], "Board"]},
        )
    )["proposals"][0]["id"]
    inject = _proposal(
        db_session,
        _data(
            call(
                client,
                token,
                "propose_injects",
                {
                    "ttx_id": ttx_id,
                    "items": [{"code": msel["injects"][0]["code"], "recipients": ["Board"]}],
                },
            )
        ),
    )
    assert inject.depends_on == [scope]
    # Discarding the scope takes the inject that needed it.
    gone = client.post(f"{PROPOSALS.format(ttx_id=ttx_id)}/{scope}/discard", headers=_csrf(client))
    assert set(gone.json()["discarded"]) == {scope, str(inject.id)}


def _kept(db_session: Session, ttx_id: str) -> str:
    ttx = _ttx(db_session, ttx_id)
    return msel_read(db_session, ttx, find_msel(db_session, ttx.id)).injects[0].code


def test_a_deletion_is_outdated_only_once_its_row_is_gone(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    inject = msel["injects"][-1]
    _data(
        call(
            client,
            token,
            "propose_injects",
            {"ttx_id": ttx_id, "items": [{"code": inject["code"], "delete": True}]},
        )
    )
    [listed] = _list(client, ttx_id)
    assert listed["outdated"] is False

    payload = _msel_payload(db_session, ttx_id)
    payload["injects"] = [i for i in payload["injects"] if i["id"] != inject["id"]]
    _save_msel(client, ttx_id, payload)
    [listed] = _list(client, ttx_id)
    assert listed["outdated"] is True


def test_the_exercises_presentation_and_tlp_are_proposed(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx = assistant_planner["ttx"]
    ttx_id = ttx["id"]
    token = create_token(client)["token"]
    assert _error_code(call(client, token, "propose_exercise", {"ttx_id": ttx_id})) == (
        "ASSISTANT_PROPOSAL_EMPTY"
    )
    made = _data(
        call(
            client,
            token,
            "propose_exercise",
            {
                "ttx_id": ttx_id,
                "name": "Ransomware at the plant",
                "description": "Tests the crisis committee's first four hours.",
                "content_language": "es",
                "tlp": "red",
            },
        )
    )
    presentation, tlp = (_proposal(db_session, made, i) for i in (0, 1))
    assert (presentation.target, presentation.target_id) == ("ttx_meta", uuid.UUID(ttx_id))
    assert presentation.patch == {
        "name": "Ransomware at the plant",
        "description": "Tests the crisis committee's first four hours.",
        "content_language": "es",
    }
    assert (tlp.target, tlp.patch) == ("needs_tlp", {"tlp": "red"})

    # Creator → Exercise saves the presentation; the needs analysis the TLP.
    saved = client.patch(
        f"/api/v1/ttx/{ttx_id}",
        json={k: presentation.patch[k] for k in ("name", "description", "content_language")},
        headers=_csrf(client),
    )
    assert saved.status_code == 200, saved.text
    applied = client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{presentation.id}/applied",
        json={"row_id": ttx_id},
        headers=_csrf(client),
    )
    assert applied.status_code == 200, applied.text
    form_ttx = _ttx(db_session, ttx_id)
    payload = proposals.payload_from_form(
        form_read(db_session, form_ttx, get_form(db_session, form_ttx.id))
    )
    proposals.apply_needs(payload, tlp)
    assert (
        client.put(
            f"/api/v1/ttx/{ttx_id}/needs-form", json=payload, headers=_csrf(client)
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/ttx/{ttx_id}/needs-form").json()["tlp"] == "red"


def test_a_proposal_accepted_meanwhile_is_named_by_its_row(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    last = max(p["end_offset"] for p in msel["phases"])

    def phase(name: str) -> str:
        return _data(
            call(
                client,
                token,
                "propose_phases",
                {
                    "ttx_id": ttx_id,
                    "items": [{"name": name, "start_minute": last, "end_minute": last + 30}],
                },
            )
        )["proposals"][0]["id"]

    accepted = phase("Lessons")
    # The person accepts it while the client is still proposing.
    proposal = db_session.get(AssistantProposal, uuid.UUID(accepted))
    payload = _msel_payload(db_session, ttx_id)
    proposals._apply_msel(payload, proposal)
    saved = _save_msel(client, ttx_id, payload)
    row = next(p["id"] for p in saved["phases"] if p["name"] == "Lessons")
    assert (
        client.post(
            f"{PROPOSALS.format(ttx_id=ttx_id)}/{accepted}/applied",
            json={"row_id": row},
            headers=_csrf(client),
        ).status_code
        == 200
    )

    inject = _proposal(
        db_session,
        _data(
            call(
                client,
                token,
                "propose_injects",
                {
                    "ttx_id": ttx_id,
                    "items": [{"phase": accepted, "title": "The board asks", "minute": last + 5}],
                },
            )
        ),
    )
    assert inject.patch["phase_key"] == row and inject.depends_on == []

    discarded = phase("Never")
    client.post(f"{PROPOSALS.format(ttx_id=ttx_id)}/{discarded}/discard", headers=_csrf(client))
    gone = call(
        client,
        token,
        "propose_injects",
        {"ttx_id": ttx_id, "items": [{"phase": discarded, "title": "x", "minute": last + 5}]},
    )
    assert _error_code(gone) == "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"
    assert "was discarded" in gone["content"][0]["text"]
