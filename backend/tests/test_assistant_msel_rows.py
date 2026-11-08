"""The AI assistant builds an MSEL from scratch: phases, simulated actors
and threat actors proposed first, then injects that name them by their
proposal id before anyone accepts them."""

import json
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.data.attack_catalog import load_groups
from app.models import TTX, AssistantProposal
from app.services.assistant import proposals
from app.services.ttx_msel_service import find_msel, msel_read
from app.services.ttx_needs_form_service import form_read, get_form
from tests.assistant_helpers import call, create_token
from tests.test_assistant_proposals import PROPOSALS, _approved_with_msel, _list
from tests.test_assistant_tools import _data, _error_code
from tests.test_ttx_needs_form import _csrf, _to_approved


def _open_msel(client: TestClient, ttx_id: str) -> dict:
    _to_approved(client, ttx_id)
    return client.get(f"/api/v1/ttx/{ttx_id}/msel").json()


def _group(version: str):
    return next(g for g in load_groups(version).values() if not g.deprecated and g.techniques)


def test_an_msel_is_built_from_scratch(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _open_msel(client, ttx_id)
    objective = msel["needs"]["objectives"][0]
    token = create_token(client)["token"]
    group = _group(msel["attack_version"])

    phases = _data(
        call(
            client,
            token,
            "propose_phases",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "name": "Detection",
                        "start_minute": 0,
                        "end_minute": 45,
                        "situation_update": "The SOC sees mass file renames.",
                        "key_questions": ["Who declares the incident?"],
                        "objectives": [objective["code"]],
                    }
                ],
            },
        )
    )["proposals"]
    actors = _data(
        call(
            client,
            token,
            "propose_actors",
            {
                "ttx_id": ttx_id,
                "items": [{"name": "Data protection authority", "type": "authority"}],
            },
        )
    )["proposals"]
    threats = _data(
        call(
            client,
            token,
            "propose_threat_actors",
            {"ttx_id": ttx_id, "items": [{"mitre_group_id": group.id.lower()}]},
        )
    )["proposals"]
    phase_id, actor_id, threat_id = phases[0]["id"], actors[0]["id"], threats[0]["id"]

    phase = db_session.get(AssistantProposal, uuid.UUID(phase_id))
    assert phase.target == "msel_phase" and phase.operation == "create"
    assert phase.patch["start_offset"] == 0 and phase.patch["end_offset"] == 45
    assert phase.patch["objective_ids"] == [objective["id"]]
    threat = db_session.get(AssistantProposal, uuid.UUID(threat_id))
    # A copy of the MITRE group, as the library's Add makes it.
    assert threat.patch["mitre_group_id"] == group.id
    assert threat.patch["name"] == group.name
    assert threat.patch["origin"] == "system" and threat.patch["origin_id"] == group.id
    assert threat.patch["techniques"]

    technique = threat.patch["techniques"][0]
    made = _data(
        call(
            client,
            token,
            "propose_injects",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "phase": phase_id,
                        "actor": f"proposal:{actor_id}",
                        "threat_actor": threat_id,
                        "title": "The regulator asks for the breach notification",
                        "minute": 30,
                    }
                ],
            },
        )
    )
    inject = db_session.get(AssistantProposal, uuid.UUID(made["proposals"][0]["id"]))
    assert inject.patch["phase_key"] == f"proposal:{phase_id}"
    assert inject.patch["actor_key"] == f"proposal:{actor_id}"
    assert inject.patch["threat_actor_key"] == f"proposal:{threat_id}"
    assert inject.patch["attack_attribution"] == "threat_actor"
    assert set(inject.depends_on) == {phase_id, actor_id, threat_id}
    assert technique["domain"] in ("enterprise", "ics")

    listed = _list(client, ttx_id, target="msel_phase")
    assert [p["id"] for p in listed] == [phase_id]

    # Discarding the phase takes the inject that needs it.
    discarded = client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{phase_id}/discard", headers=_csrf(client)
    ).json()["discarded"]
    assert set(discarded) == {phase_id, str(inject.id)}


def test_existing_rows_are_changed_by_code_and_accepted_rows_marked(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    phase = msel["phases"][0]
    actor = msel["actors"][0]

    changed = _data(
        call(
            client,
            token,
            "propose_phases",
            {
                "ttx_id": ttx_id,
                "items": [{"code": phase["code"], "headline": "Files renamed across the share"}],
            },
        )
    )["proposals"][0]
    row = db_session.get(AssistantProposal, uuid.UUID(changed["id"]))
    assert row.operation == "update" and row.target_id == uuid.UUID(phase["id"])
    assert row.patch == {"headline": "Files renamed across the share"}
    assert row.base == {"headline": phase["headline"]}

    same = call(
        client,
        token,
        "propose_actors",
        {"ttx_id": ttx_id, "items": [{"code": actor["code"], "name": actor["name"]}]},
    )
    assert _error_code(same) == "ASSISTANT_PROPOSAL_NO_CHANGE"

    # Once the page has saved it, the proposal is marked applied to its row.
    applied = client.post(
        f"{PROPOSALS.format(ttx_id=ttx_id)}/{changed['id']}/applied",
        json={"row_id": phase["id"]},
        headers=_csrf(client),
    )
    assert applied.status_code == 200, applied.text
    assert applied.json()["status"] == "accepted"


def test_references_and_names_are_checked(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _open_msel(client, ttx_id)
    token = create_token(client)["token"]

    nameless = call(client, token, "propose_phases", {"ttx_id": ttx_id, "items": [{}]})
    assert _error_code(nameless) == "ASSISTANT_PROPOSAL_INCOMPLETE"
    unknown_group = call(
        client,
        token,
        "propose_threat_actors",
        {"ttx_id": ttx_id, "items": [{"mitre_group_id": "G9999"}]},
    )
    assert _error_code(unknown_group) == "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"
    unknown_technique = call(
        client,
        token,
        "propose_threat_actors",
        {
            "ttx_id": ttx_id,
            "items": [
                {"name": "Crew", "techniques": [{"domain": "enterprise", "technique_id": "T0000"}]}
            ],
        },
    )
    assert _error_code(unknown_technique) == "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"

    # An actor's proposal id isn't a phase.
    actor_id = _data(
        call(client, token, "propose_actors", {"ttx_id": ttx_id, "items": [{"name": "Press"}]})
    )["proposals"][0]["id"]
    wrong_kind = call(
        client,
        token,
        "propose_injects",
        {"ttx_id": ttx_id, "items": [{"phase": actor_id, "title": "Headline"}]},
    )
    assert _error_code(wrong_kind) == "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"


# --- Round trip: what's proposed reads back the same once saved ---------------
# The page takes a proposal as saved when the saved row holds its patch
# (frontend lib/proposals.ts acceptedState): this pins that contract.

# Link rows the server keeps without an order.
UNORDERED = {"objective_ids", "due_objective_ids", "linked_need_keys"}


def _canonical(value):
    return json.dumps(value, sort_keys=True)


def assert_holds(row: dict, patch: dict, ids: dict[str, str]) -> None:
    """Each patch field reads back the same, a `proposal:<id>` reference as
    the id the row it names got."""

    def resolve(value):
        if isinstance(value, str) and value.startswith(proposals.REF_PREFIX):
            return ids[value.removeprefix(proposals.REF_PREFIX)]
        if isinstance(value, list):
            return [resolve(v) for v in value]
        return value

    for field, value in patch.items():
        # Where a new row goes, not a field of it.
        if field in ("capabilities_to_add", "eeg_id"):
            continue
        wanted, got = resolve(value), row[field]
        if field == "expected_actions":
            assert [{k: a[k] for k in w} for a, w in zip(got, wanted, strict=True)] == wanted
        elif field in UNORDERED:
            assert sorted(got) == sorted(wanted), field
        else:
            assert _canonical(got) == _canonical(wanted), field


def _saved_ids(db_session: Session, ttx_id: str, target: str) -> set[str]:
    db_session.expire_all()
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    return set(proposals.saved_rows(db_session, ttx, target))


def _round_trip(
    client: TestClient,
    db_session: Session,
    ttx_id: str,
    made: list[AssistantProposal],
    *,
    payload: dict,
    apply,
    path: str,
) -> None:
    """Applies the proposals as the page would, saves, and checks each
    saved row holds its patch; then the page marks them applied."""
    before = {p.target: _saved_ids(db_session, ttx_id, p.target) for p in made}
    for proposal in made:
        apply(payload, proposal)
    saved = client.put(f"/api/v1/ttx/{ttx_id}/{path}", json=payload, headers=_csrf(client))
    assert saved.status_code == 200, saved.text

    db_session.expire_all()
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    ids: dict[str, str] = {}
    rows_by_target = {p.target: proposals.saved_rows(db_session, ttx, p.target) for p in made}
    for proposal in made:
        rows = rows_by_target[proposal.target]
        if proposal.operation == "create":
            [new] = set(rows) - before[proposal.target]
            ids[str(proposal.id)] = new
        else:
            ids[str(proposal.id)] = str(proposal.target_id)
    for proposal in made:
        row = rows_by_target[proposal.target][ids[str(proposal.id)]]
        assert_holds(row, proposal.patch, ids)
        applied = client.post(
            f"{PROPOSALS.format(ttx_id=ttx_id)}/{proposal.id}/applied",
            json={"row_id": ids[str(proposal.id)]},
            headers=_csrf(client),
        )
        assert applied.status_code == 200, applied.text
    assert _list(client, ttx_id) == []


def _made(db_session: Session, *answers: dict) -> list[AssistantProposal]:
    db_session.expire_all()
    return [
        db_session.get(AssistantProposal, uuid.UUID(p["id"]))
        for answer in answers
        for p in answer["proposals"]
    ]


def test_every_msel_proposal_reads_back_as_proposed_once_saved(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    objectives = [o["code"] for o in msel["needs"]["objectives"]][:2]
    phase, actor = msel["phases"][1], msel["actors"][0]
    inject = msel["injects"][0]
    group = _group(msel["attack_version"])
    techniques = [
        {"domain": "enterprise", "tactic_id": "TA0040", "technique_id": "T1486"},
        {"domain": "ics", "tactic_id": "TA0105", "technique_id": "T0829"},
    ]

    def propose(tool: str, items: list[dict]) -> dict:
        return _data(call(client, token, tool, {"ttx_id": ttx_id, "items": items}))

    answers = [
        propose(
            "propose_phases",
            [
                {"code": phase["code"], "headline": "Lights out", "objectives": objectives[::-1]},
            ],
        ),
        propose(
            "propose_actors",
            [
                {"name": "Grid regulator", "type": "authority", "channel": "phone"},
                {"code": actor["code"], "played_by": "Legal counsel"},
            ],
        ),
        propose(
            "propose_threat_actors",
            [{"mitre_group_id": group.id}],
        ),
        propose(
            "propose_injects",
            [
                {
                    "code": inject["code"],
                    "title": "EDR alerts: mass encryption",
                    "objectives": objectives[::-1],
                    "attack_attribution": "noise",
                    "attack_techniques": techniques,
                },
                {
                    "phase": phase["code"],
                    "actor": actor["code"],
                    "title": "Substations go dark",
                    "content": "Two HMIs stop refreshing telemetry.",
                    "minute": phase["start_offset"] + 5,
                    "objectives": objectives[::-1],
                    "attack_attribution": "noise",
                    "attack_techniques": techniques,
                    "expected_actions": [
                        {"description": "Isolate the jump server.", "within_minutes": 10},
                        {"description": "Call the grid operator.", "responsible_role": "Legal"},
                    ],
                },
            ],
        ),
    ]
    made = _made(db_session, *answers)
    assert {p.target for p in made} == {"msel_phase", "msel_actor", "msel_threat", "inject"}
    db_session.expire_all()
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    payload = proposals.payload_from_msel(msel_read(db_session, ttx, find_msel(db_session, ttx.id)))

    _round_trip(
        client,
        db_session,
        ttx_id,
        made,
        payload=payload,
        apply=proposals._apply_msel,
        path="msel",
    )


def test_a_new_phase_and_the_inject_on_it_read_back_once_saved(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    last = max(p["end_offset"] for p in msel["phases"])
    phase = _data(
        call(
            client,
            token,
            "propose_phases",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "name": "Lessons",
                        "start_minute": last,
                        "end_minute": last + 30,
                        "key_questions": ["What would we do differently?"],
                    }
                ],
            },
        )
    )
    inject = _data(
        call(
            client,
            token,
            "propose_injects",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "phase": phase["proposals"][0]["id"],
                        "title": "The board asks for a summary",
                        "minute": last + 5,
                    }
                ],
            },
        )
    )
    made = _made(db_session, phase, inject)
    db_session.expire_all()
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    payload = proposals.payload_from_msel(msel_read(db_session, ttx, find_msel(db_session, ttx.id)))

    _round_trip(
        client,
        db_session,
        ttx_id,
        made,
        payload=payload,
        apply=proposals._apply_msel,
        path="msel",
    )


def test_needs_and_objectives_read_back_as_proposed_once_saved(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    token = create_token(client)["token"]
    form = client.get(f"/api/v1/ttx/{ttx_id}/needs-form").json()
    need = form["needs"][0]
    objective = form["objectives"][0]
    needs = _data(
        call(
            client,
            token,
            "propose_needs",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "source": "previous_aar",
                        "title": "Backups untested",
                        "finding": "Last year's restore took four days.",
                        "affected_capability": objective["capability"],
                        "priority": "high",
                    },
                    {"code": need["code"], "title": "Sharper need"},
                ],
            },
        )
    )
    created = needs["proposals"][0]["id"]
    objectives = _data(
        call(
            client,
            token,
            "propose_objectives",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "statement": "Agree the restore order within 45 minutes.",
                        "capability": objective["capability"],
                        "linked_needs": [created, need["code"]],
                        "success_criterion": "A written restore order.",
                    },
                    {"code": objective["code"], "linked_needs": [created, need["code"]]},
                ],
            },
        )
    )
    made = _made(db_session, needs, objectives)
    db_session.expire_all()
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    payload = proposals.payload_from_form(form_read(db_session, ttx, get_form(db_session, ttx.id)))

    def apply(payload: dict, proposal: AssistantProposal) -> None:
        if proposal.target == "need":
            proposals._apply_need(payload, proposal)
        else:
            proposals._apply_objective(payload, proposal)

    _round_trip(
        client,
        db_session,
        ttx_id,
        made,
        payload=payload,
        apply=apply,
        path="needs-form",
    )
