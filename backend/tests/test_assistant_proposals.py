"""The AI assistant's proposals: made through the MCP tools with the
Planner's write guard, checked against the form's own rules, listed and
decided on the form's page by their author only."""

import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import TTX, AssistantProposal, RoleEnum, TTXAccess, User
from app.schemas.ttx_msel import MselSaveRequest
from app.schemas.ttx_needs_form import NeedsFormSaveRequest
from app.services.assistant import proposals
from app.services.ttx_msel_service import draft_report as msel_draft_report
from app.services.ttx_msel_service import find_msel, msel_read
from app.services.ttx_needs_form_service import draft_report, form_read, get_form
from tests.assistant_helpers import call, create_token
from tests.msel_helpers import example_payload
from tests.test_assistant_tools import _data, _error_code, _member
from tests.test_ttx_needs_form import _csrf, _to_approved

PROPOSALS = "/api/v1/ttx/{ttx_id}/assistant/proposals"


def _ttx(db_session: Session, ttx_id: str) -> TTX:
    db_session.expire_all()
    return db_session.get(TTX, uuid.UUID(ttx_id))


def _needs(client: TestClient, ttx_id: str) -> dict:
    return client.get(f"/api/v1/ttx/{ttx_id}/needs-form").json()


def _approved_with_msel(client: TestClient, ttx_id: str) -> dict:
    _to_approved(client, ttx_id)
    msel = client.get(f"/api/v1/ttx/{ttx_id}/msel").json()
    saved = client.put(
        f"/api/v1/ttx/{ttx_id}/msel", json=example_payload(msel), headers=_csrf(client)
    )
    assert saved.status_code == 200, saved.text
    return saved.json()


def _list(client: TestClient, ttx_id: str, **params) -> list[dict]:
    response = client.get(PROPOSALS.format(ttx_id=ttx_id), params=params)
    assert response.status_code == 200, response.text
    return response.json()["items"]


# --- The saved documents as payloads -------------------------------------------


def test_the_converters_round_trip(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _approved_with_msel(client, ttx_id)
    ttx = _ttx(db_session, ttx_id)

    form = form_read(db_session, ttx, get_form(db_session, ttx.id))
    needs_payload = NeedsFormSaveRequest.model_validate(proposals.payload_from_form(form))
    msel = msel_read(db_session, ttx, find_msel(db_session, ttx.id))
    msel_payload = MselSaveRequest.model_validate(proposals.payload_from_msel(msel))

    assert draft_report(db_session, ttx, needs_payload) == form.validation
    assert msel_draft_report(db_session, ttx, msel_payload) == msel.validation
    # Saving them unchanged changes nothing either.
    resaved = client.put(
        f"/api/v1/ttx/{ttx_id}/msel",
        json=proposals.payload_from_msel(msel),
        headers=_csrf(client),
    )
    assert resaved.status_code == 200, resaved.text
    assert resaved.json()["validation"] == msel.validation.model_dump(mode="json")
    assert [i["code"] for i in resaved.json()["injects"]] == [i.code for i in msel.injects]


# --- Needs and objectives --------------------------------------------------------


def test_needs_and_a_linked_objective_are_proposed(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    token = create_token(client)["token"]
    before = _needs(client, ttx_id)

    made = _data(
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
                        "affected_capability": "continuity_recovery",
                        "priority": "high",
                        "summary": "Recovery is the weak point the sector reports show.",
                    },
                    {"code": "NEED-01", "priority": "medium"},
                ],
            },
        )
    )
    created, updated = made["proposals"]
    objective = _data(
        call(
            client,
            token,
            "propose_objectives",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "title": "Restore in order",
                        "statement": "Agree the restore order within 45 minutes.",
                        "capability": "continuity_recovery",
                        "linked_needs": [created["id"], "NEED-01"],
                        "success_criterion": "A written restore order.",
                    }
                ],
            },
        )
    )["proposals"][0]

    assert "Nothing has changed yet" in made["next_step"]
    assert _needs(client, ttx_id)["revision"] == before["revision"]
    rows = {str(p.id): p for p in db_session.exec(select(AssistantProposal))}
    need = rows[created["id"]]
    assert (need.target, need.operation, need.status) == ("need", "create", "pending")
    assert need.patch["title"] == "Backups untested"
    change = rows[updated["id"]]
    need_01 = before["needs"][0]
    assert change.target_id == uuid.UUID(need_01["id"])
    assert change.patch == {"priority": "medium"}
    assert change.base == {"priority": need_01["priority"]}
    linked = rows[objective["id"]]
    assert linked.depends_on == [created["id"]]
    assert linked.patch["linked_need_keys"] == [f"proposal:{created['id']}", need_01["id"]]
    # Not one of the form's capabilities yet: proposed with it.
    assert linked.patch["capabilities_to_add"] == ["continuity_recovery"]


def test_only_the_warnings_a_proposal_adds_are_reported(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    # A fresh form: many issues already, none of them the proposal's.
    assert _needs(client, ttx_id)["validation"]["ready"]

    made = _data(
        call(
            client,
            token,
            "propose_needs",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "source": "risk_analysis",
                        "title": "No OT playbook",
                        "affected_capability": "crisis_decision_making",
                        "priority": "high",
                    }
                ],
            },
        )
    )

    [proposal] = made["proposals"]
    assert all(w["item"] == f"proposal {proposal['id']}" for w in made["new_warnings"])


def test_references_and_completeness_are_checked(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    token = create_token(client)["token"]

    unknown_need = call(
        client,
        token,
        "propose_objectives",
        {
            "ttx_id": ttx_id,
            "items": [
                {
                    "statement": "Decide.",
                    "capability": "crisis_decision_making",
                    "linked_needs": ["NEED-99"],
                }
            ],
        },
    )
    incomplete = call(
        client, token, "propose_needs", {"ttx_id": ttx_id, "items": [{"title": "Half a need"}]}
    )
    no_change = call(
        client,
        token,
        "propose_needs",
        {"ttx_id": ttx_id, "items": [{"code": "NEED-01", "priority": "high"}]},
    )

    assert _error_code(unknown_need) == "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE"
    assert "NEED-99" in unknown_need["content"][0]["text"]
    assert _error_code(incomplete) == "ASSISTANT_PROPOSAL_INCOMPLETE"
    assert _error_code(no_change) == "ASSISTANT_PROPOSAL_NO_CHANGE"
    assert db_session.exec(select(AssistantProposal)).all() == []


# --- Injects -----------------------------------------------------------------------


def test_injects_are_proposed_as_drafts(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    phase, actor = msel["phases"][1], msel["actors"][0]
    objective = msel["needs"]["objectives"][0]
    first = msel["injects"][0]

    made = _data(
        call(
            client,
            token,
            "propose_injects",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "phase": phase["code"],
                        "title": "Insurer asks for a forensic report",
                        "content": "The cyber insurer requests the forensic timeline by noon.",
                        "minute": 60,
                        "actor": actor["code"],
                        "objectives": [objective["code"]],
                        "attack_attribution": "threat_actor",
                        "attack_techniques": [
                            {"domain": "enterprise", "tactic_id": "TA0040", "technique_id": "T1486"}
                        ],
                        "expected_actions": [
                            {"description": "Legal answers the insurer.", "within_minutes": 15}
                        ],
                    },
                    {"code": first["code"], "title": "SOC alert: mass renames"},
                ],
            },
        )
    )

    created, updated = (
        db_session.get(AssistantProposal, uuid.UUID(p["id"])) for p in made["proposals"]
    )
    assert created.patch["phase_key"] == phase["id"]
    assert created.patch["actor_key"] == actor["id"]
    assert created.patch["objective_ids"] == [objective["id"]]
    assert created.patch["review_status"] == "draft"
    assert created.patch["attack_techniques"][0]["technique_name"]
    assert created.patch["expected_actions"][0]["expected_within_minutes"] == 15
    assert updated.patch == {"title": "SOC alert: mass renames"}
    assert updated.base == {"title": first["title"]}
    # The threat actor of an attribution isn't named: the MSEL's rules clear
    # nothing proposed but say what they'd drop.
    assert "dropped_fields" not in made

    # Techniques on an inject with no attribution would never be saved:
    # refused, so the client adds one instead of leaving it to loop.
    unattributed = next(i for i in msel["injects"] if not i.get("attack_attribution"))
    no_attribution = call(
        client,
        token,
        "propose_injects",
        {
            "ttx_id": ttx_id,
            "items": [
                {
                    "code": unattributed["code"],
                    "attack_techniques": [
                        {"domain": "enterprise", "tactic_id": "TA0040", "technique_id": "T1486"}
                    ],
                }
            ],
        },
    )
    assert _error_code(no_attribution) == "ASSISTANT_PROPOSAL_INVALID"
    assert unattributed["code"] in no_attribution["content"][0]["text"]
    with_noise = call(
        client,
        token,
        "propose_injects",
        {
            "ttx_id": ttx_id,
            "items": [
                {
                    "code": unattributed["code"],
                    "attack_attribution": "noise",
                    "attack_techniques": [
                        {"domain": "enterprise", "tactic_id": "TA0040", "technique_id": "T1486"}
                    ],
                }
            ],
        },
    )
    assert with_noise["isError"] is False

    # On a change, expected actions are the whole new list.
    replaced = _data(
        call(
            client,
            token,
            "propose_injects",
            {
                "ttx_id": ttx_id,
                "items": [{"code": first["code"], "expected_actions": [{"description": "x"}]}],
            },
        )
    )
    change = db_session.get(AssistantProposal, uuid.UUID(replaced["proposals"][0]["id"]))
    assert change.patch["expected_actions"] == [
        {"description": "x", "responsible_role": "", "expected_within_minutes": None}
    ]


def test_a_poll_is_proposed_with_what_follows_each_option(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    token = create_token(client)["token"]
    made = _data(
        call(
            client,
            token,
            "propose_injects",
            {
                "ttx_id": ttx_id,
                "items": [
                    {
                        "phase": msel["phases"][1]["code"],
                        "title": "Pay or not",
                        "minute": 60,
                        "format": "poll",
                        "poll_question": "Pay the ransom?",
                        "poll_options": ["Pay", "Refuse"],
                        "poll_outcomes": ["They come back.", "The data goes public."],
                    }
                ],
            },
        )
    )
    [proposal] = _list(client, ttx_id, status="pending")
    assert made and proposal["patch"]["format"] == "poll"
    assert proposal["patch"]["poll_outcomes"][1] == "The data goes public."


def test_injects_need_an_editable_msel(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    item = {"phase": "PH-01", "title": "Anything"}

    refused = call(client, token, "propose_injects", {"ttx_id": ttx_id, "items": [item]})

    assert _error_code(refused) == "ASSISTANT_MSEL_NOT_OPEN"


# --- Who may propose -------------------------------------------------------------------


def test_proposing_takes_the_planner_write_guard(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    item = {"source": "previous_aar", "title": "x", "affected_capability": "crisis_decision_making",
            "priority": "low"}  # fmt: skip
    controller = _member(
        db_session, "controller@acme.com", ttx_id, RoleEnum.PLANNER, plans=False, controls=True
    )
    token = create_token(client)["token"]
    founder = db_session.exec(select(User).where(User.email == "planner@acme.com")).one()

    as_controller = call(client, controller, "propose_needs", {"ttx_id": ttx_id, "items": [item]})
    seat = db_session.exec(select(TTXAccess).where(TTXAccess.user_id == founder.id)).one()
    db_session.delete(seat)
    db_session.commit()
    # A Program Manager off the team reads, but doesn't design.
    as_program_manager = call(client, token, "propose_needs", {"ttx_id": ttx_id, "items": [item]})

    assert _error_code(as_controller) == "TTX_ACCESS_DENIED"
    assert _error_code(as_program_manager) == "TTX_ACCESS_DENIED"


def test_an_archived_exercise_takes_no_proposals(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    assert client.post(f"/api/v1/ttx/{ttx_id}/archive", headers=_csrf(client)).status_code == 200

    refused = call(
        client,
        token,
        "propose_needs",
        {"ttx_id": ttx_id, "items": [{"code": "NEED-01", "priority": "low"}]},
    )

    assert _error_code(refused) == "TTX_ARCHIVED"


# --- Deciding on the page ------------------------------------------------------------


def _one_need_proposal(client: TestClient, token: str, ttx_id: str, priority: str) -> str:
    made = _data(
        call(
            client,
            token,
            "propose_needs",
            {"ttx_id": ttx_id, "items": [{"code": "NEED-01", "priority": priority}]},
        )
    )
    return made["proposals"][0]["id"]


def test_the_author_lists_marks_applied_and_sees_outdated_ones(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    token = create_token(client)["token"]
    form = _needs(client, ttx_id)
    need = form["needs"][0]
    new_priority = "low" if need["priority"] != "low" else "medium"
    proposal_id = _one_need_proposal(client, token, ttx_id, new_priority)

    [listed] = _list(client, ttx_id)
    assert listed["id"] == proposal_id and listed["outdated"] is False
    assert _list(client, ttx_id, status="accepted") == []

    # The page accepts it and its autosave saves the form.
    payload = proposals.payload_from_form(
        form_read(db_session, _ttx(db_session, ttx_id), get_form(db_session, uuid.UUID(ttx_id)))
    )
    payload["needs"][0]["priority"] = new_priority
    assert (
        client.put(
            f"/api/v1/ttx/{ttx_id}/needs-form", json=payload, headers=_csrf(client)
        ).status_code
        == 200
    )
    wrong_row = client.post(
        PROPOSALS.format(ttx_id=ttx_id) + f"/{proposal_id}/applied",
        json={"row_id": form["objectives"][0]["id"]},
        headers=_csrf(client),
    )
    applied = client.post(
        PROPOSALS.format(ttx_id=ttx_id) + f"/{proposal_id}/applied",
        json={"row_id": need["id"]},
        headers=_csrf(client),
    )
    again = client.post(
        PROPOSALS.format(ttx_id=ttx_id) + f"/{proposal_id}/discard", headers=_csrf(client)
    )

    assert wrong_row.json()["error"]["code"] == "ASSISTANT_PROPOSAL_ROW_NOT_SAVED"
    assert applied.status_code == 200, applied.text
    assert applied.json()["status"] == "accepted"
    assert applied.json()["applied_row_id"] == need["id"]
    assert again.json()["error"]["code"] == "ASSISTANT_PROPOSAL_DECIDED"

    # Another proposal on the same field, then the row changes under it.
    stale = _one_need_proposal(client, token, ttx_id, "high" if new_priority != "high" else "low")
    payload["revision"] = _needs(client, ttx_id)["revision"]
    payload["needs"][0]["title"] = "Renamed meanwhile"
    payload["needs"][0]["priority"] = "medium" if new_priority != "medium" else "low"
    assert (
        client.put(
            f"/api/v1/ttx/{ttx_id}/needs-form", json=payload, headers=_csrf(client)
        ).status_code
        == 200
    )
    [listed] = _list(client, ttx_id)
    assert listed["id"] == stale and listed["outdated"] is True


def test_discarding_takes_its_dependents_and_others_never_see_them(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    token = create_token(client)["token"]
    need = _data(
        call(
            client,
            token,
            "propose_needs",
            {
                "ttx_id": ttx_id,
                "items": [
                    {"source": "previous_aar", "title": "New need",
                     "affected_capability": "crisis_decision_making", "priority": "low"}
                ],
            },
        )
    )["proposals"][0]["id"]  # fmt: skip
    objective = _data(
        call(
            client,
            token,
            "propose_objectives",
            {
                "ttx_id": ttx_id,
                "items": [
                    {"statement": "Decide fast.", "capability": "crisis_decision_making",
                     "linked_needs": [need]}
                ],
            },
        )
    )["proposals"][0]["id"]  # fmt: skip

    discarded = client.post(
        PROPOSALS.format(ttx_id=ttx_id) + f"/{need}/discard", headers=_csrf(client)
    )

    assert sorted(discarded.json()["discarded"]) == sorted([need, objective])
    assert _list(client, ttx_id) == []
    assert {p["status"] for p in _list(client, ttx_id, status="discarded")} == {"discarded"}
    listed = _data(call(client, token, "list_my_proposals", {"ttx_id": ttx_id}))["proposals"]
    assert {p["status"] for p in listed} == {"discarded"}


def test_proposals_are_capped_and_pruned(
    client: TestClient,
    db_session: Session,
    assistant_planner: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    token = create_token(client)["token"]
    monkeypatch.setattr(proposals, "MAX_PENDING_PER_EXERCISE", 1)
    first = _one_need_proposal(client, token, ttx_id, "low")

    over = call(
        client,
        token,
        "propose_needs",
        {"ttx_id": ttx_id, "items": [{"code": "NEED-01", "priority": "medium"}]},
    )
    assert _error_code(over) == "ASSISTANT_PROPOSAL_LIMIT"

    old = db_session.get(AssistantProposal, uuid.UUID(first))
    old.created_at = datetime.now(UTC) - timedelta(days=proposals.PENDING_RETENTION_DAYS + 1)
    db_session.add(old)
    db_session.commit()
    assert proposals.prune_expired(db_session) == 1
    assert db_session.exec(select(AssistantProposal)).all() == []


def test_deleting_the_exercise_deletes_its_proposals(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    token = create_token(client)["token"]
    _one_need_proposal(client, token, ttx_id, "low")

    deleted = client.request(
        "DELETE",
        f"/api/v1/ttx/{ttx_id}",
        json={"confirmation": assistant_planner["ttx"]["name"]},
        headers=_csrf(client),
    )

    assert deleted.status_code == 204, deleted.text
    db_session.expire_all()
    assert db_session.exec(select(AssistantProposal)).all() == []


def test_the_patch_size_is_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(proposals, "MAX_PATCH_CHARS", 10)
    with pytest.raises(Exception) as caught:
        proposals._new(
            TTX(name="x", organization_id=uuid.uuid4(), created_by_id=uuid.uuid4()),
            User(email="a@b.c", full_name="A"),
            uuid.uuid4(),
            "need",
            proposals.NeedItem(),
            {"finding": "x" * 50},
        )
    assert json.dumps(getattr(caught.value, "code", "")) == '"ASSISTANT_PROPOSAL_TOO_LARGE"'
