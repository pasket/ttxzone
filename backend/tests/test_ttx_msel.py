"""Creator -> MSEL: lazy creation behind the design gate, the whole-MSEL
save, rules M01-M17 (M14-M17: the storyline map's branches), transitions
and snapshots, sync with the needs analysis, and what the EEG gets from
it."""

import copy
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.data.attack_catalog import load_domain, upgrade_selection
from app.main import app
from app.models import (
    Inject,
    MselPhase,
    MselSnapshot,
    PlatformAuditEvent,
    RoleEnum,
    TTXAccess,
    TTXMsel,
    UserSession,
)
from tests.msel_helpers import attack_ref, example_payload
from tests.test_ttx_evaluation import _account, _enable_totp, _login
from tests.test_ttx_needs_form import (
    _complete_payload,
    _create_ttx,
    _csrf,
    _get,
    _manager,
    _save,
    _to_approved,
    _transition,
)

# Grants straight to other domains: see conftest.direct_grants.
pytestmark = pytest.mark.usefixtures("direct_grants")


def _url(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/msel{suffix}"


def _open(client: TestClient, ttx_id: str, locale: str = "en") -> dict:
    response = client.get(_url(ttx_id), headers={"Accept-Language": locale})
    assert response.status_code == 200, response.text
    return response.json()


def _put(client: TestClient, ttx_id: str, payload: dict):
    return client.put(_url(ttx_id), json=payload, headers=_csrf(client))


def _move(client: TestClient, ttx_id: str, to: str):
    return client.post(_url(ttx_id, "/transitions"), json={"to": to}, headers=_csrf(client))


def _codes(issues: list[dict]) -> set[str]:
    return {issue["code"] for issue in issues}


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    """A Planner's exercise with an approved needs analysis and its MSEL
    opened, the client signed in as that Planner."""
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    return {"ttx": ttx, "org_id": owner["organization"]["id"], "msel": _open(client, ttx["id"])}


def _saved_example(client: TestClient, exercise: dict) -> dict:
    response = _put(client, exercise["ttx"]["id"], example_payload(exercise["msel"]))
    assert response.status_code == 200, response.text
    return response.json()


def _to_ready(client: TestClient, exercise: dict) -> dict:
    saved = _saved_example(client, exercise)
    assert saved["validation"]["ready"] == [], saved["validation"]["ready"]
    assert saved["validation"]["approved"] == []
    assert _move(client, exercise["ttx"]["id"], "in_review").status_code == 200
    ready = _move(client, exercise["ttx"]["id"], "ready")
    assert ready.status_code == 200, ready.text
    return ready.json()


def _payload_from(msel: dict) -> dict:
    """A save payload that keeps a saved MSEL exactly as it is."""
    phase_keys = {p["id"]: p["id"] for p in msel["phases"]}
    return {
        "revision": msel["revision"],
        **{
            field: msel[field]
            for field in (
                "title",
                "summary",
                "exercise_start",
                "incident_start",
                "incident_date",
                "duration_minutes",
                "time_compression",
            )
        },  # fmt: skip
        "threat_actors": [
            {
                "id": t["id"],
                "key": t["id"],
                **{
                    k: t[k]
                    for k in (
                        "name",
                        "mitre_group_id",
                        "aliases",
                        "description",
                        "origin",
                        "origin_id",
                        "origin_name",
                    )
                },
                "techniques": [
                    {"domain": x["domain"], "technique_id": x["technique_id"]}
                    for x in t["techniques"]
                ],
            }
            for t in msel["threat_actors"]
        ],  # fmt: skip
        "meters": msel["meters"],
        "actors": [
            {
                "id": a["id"],
                "key": a["id"],
                "name": a["name"],
                "type": a["type"],
                "played_by": a["played_by"],
            }
            for a in msel["actors"]
        ],  # fmt: skip
        "phases": [
            {
                "id": p["id"],
                "key": p["id"],
                **{
                    k: p[k]
                    for k in (
                        "name",
                        "start_offset",
                        "end_offset",
                        "headline",
                        "incident_jump_minutes",
                        "situation_update",
                        "key_questions",
                        "objective_ids",
                    )
                },
            }
            for p in msel["phases"]
        ],  # fmt: skip
        "injects": [
            {
                "id": i["id"],
                "phase_key": phase_keys[i["phase_id"]],
                "actor_key": i["simulated_actor_id"],
                # Saved rows are named by their id.
                "branch_from_key": i["branch_from_id"],
                "branch_action_key": i["branch_action_id"],
                "rejoin_key": i["rejoin_inject_id"],
                "threat_actor_key": i["threat_actor_id"],
                **{
                    k: i[k]
                    for k in (
                        "kind",
                        "title",
                        "content",
                        "offset_minutes",
                        "trigger_condition",
                        "contingent_purpose",
                        "recipients",
                        "room_ids",
                        "delivery_method",
                        "attachment_notes",
                        "attack_techniques",
                        "attack_attribution",
                        "facilitator_notes",
                        "review_status",
                        "validated_by",
                        "validated_by_id",
                        "objective_ids",
                        "format",
                        "poll_question",
                        "poll_options",
                        "poll_outcomes",
                        "poll_impacts",
                    )
                },
                "images": [{"image_id": im["id"], "caption": im["caption"]} for im in i["images"]],
                "expected_actions": [
                    {
                        k: a[k]
                        for k in (
                            "id",
                            "description",
                            "responsible_role",
                            "expected_within_minutes",
                            "objective_ids",
                        )
                    }
                    for a in i["expected_actions"]
                ],
            }
            for i in msel["injects"]
        ],  # fmt: skip
    }


# -- creation, gate, access ----------------------------------------------------


def test_first_open_creates_the_msel_with_neutral_actors(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    msel = exercise["msel"]

    assert msel["status"] == "draft"
    assert msel["version"] == 1
    assert msel["editable"] is True
    assert msel["needs_form_version"] == 1
    # The usual tabletop: a 3-hour session (the sample allows 4), one hour
    # of incident per session minute.
    assert (msel["duration_minutes"], msel["time_compression"]) == (180, 60)
    names = [a["name"] for a in msel["actors"]]
    assert names[:7] == [
        "SOC", "National CSIRT", "Competent authority", "Media", "Critical supplier",
        "Customer", "Attacker (sender)",
    ]  # fmt: skip
    # The sample needs form names NCCS: its two actors are suggested too.
    assert names[7:] == ["Electricity system operator", "NCCS competent authority"]
    assert [a["code"] for a in msel["actors"]][:2] == ["ACT-01", "ACT-02"]
    assert [o["code"] for o in msel["needs"]["objectives"]] == ["OBJ-01", "OBJ-02", "OBJ-03"]
    assert msel["needs"]["participating_areas"] == ["Crisis Committee", "SOC", "OT Operations"]
    # Opening again doesn't create a second one.
    assert _open(client, exercise["ttx"]["id"])["id"] == msel["id"]
    assert len(db_session.exec(select(TTXMsel)).all()) == 1


def test_actors_are_seeded_in_the_openers_language(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])

    msel = _open(client, ttx["id"], locale="es")

    assert msel["actors"][1]["name"] == "CSIRT nacional"
    assert msel["actors"][-1]["name"] == "Autoridad competente NCCS"


def test_players_and_other_organizations_are_denied(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    player = _account(db_session, "player@acme.com", "Player")
    db_session.add(TTXAccess(user_id=player.id, ttx_id=uuid.UUID(ttx_id), role=RoleEnum.PLAYER))
    db_session.commit()
    _login(client, player.email)
    assert client.get(_url(ttx_id)).status_code == 403

    client.cookies.clear()
    _manager(client, db_session, "other@globex.com", "Globex")
    response = client.get(_url(ttx_id))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "TTX_ACCESS_DENIED"


def test_the_attack_release_is_served(client: TestClient, exercise: dict) -> None:
    versions = client.get("/api/v1/attack").json()
    assert versions == {"versions": ["19.2"], "latest_version": "19.2"}

    release = client.get("/api/v1/attack/19.2").json()
    assert (release["version"], release["released"]) == ("19.2", "2026-08-05")
    assert release["copyright"].startswith("Copyright 2015-2026, The MITRE Corporation")
    enterprise, ics = release["domains"]
    assert (enterprise["domain"], ics["domain"]) == ("enterprise", "ics")
    # Tactics in matrix order, reconnaissance to impact.
    assert enterprise["tactics"][0] == {"id": "TA0043", "name": "Reconnaissance"}
    assert enterprise["tactics"][-1] == {"id": "TA0040", "name": "Impact"}
    techniques = {t["id"]: t for t in enterprise["techniques"]}
    assert techniques["T1566.001"] == {
        "id": "T1566.001",
        "name": "Spearphishing Attachment",
        "tactics": ["TA0001"],
        "parent": "T1566",
    }
    # A technique can serve several tactics.
    assert len(techniques["T1078"]["tactics"]) > 1
    # Deprecated techniques aren't offered.
    deprecated = [t for t in load_domain("19.2", "enterprise").techniques.values() if t.deprecated]
    assert deprecated and not any(t.id in techniques for t in deprecated)

    missing = client.get("/api/v1/attack/1.0")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "UNKNOWN_ATTACK_VERSION"


def test_techniques_are_stored_with_their_tactic_and_release(
    client: TestClient, exercise: dict
) -> None:
    msel = _put(client, exercise["ttx"]["id"], example_payload(exercise["msel"])).json()

    assert msel["attack_version"] == "19.2"
    inject = msel["injects"][0]
    assert inject["attack_techniques"] == [
        {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486",
            "tactic_name": "Impact",
            "technique_name": "Data Encrypted for Impact",
        }
    ]
    # The scenario's list is derived: every technique its injects use, once.
    ids = [r["technique_id"] for r in msel["attack_techniques"]]
    assert ids == ["T1486", "T1566", "T1490", "T0826", "T1021", "T0827"]
    # A sub-technique reads with its parent's name.
    payload = _payload_from(msel)
    payload["injects"][0]["attack_techniques"].append(
        {"domain": "enterprise", "tactic_id": "TA0001", "technique_id": "T1566.001"}
    )
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    assert saved["injects"][0]["attack_techniques"][-1]["technique_name"] == (
        "Phishing: Spearphishing Attachment"
    )


def test_the_exercise_list_carries_the_msel_status(client: TestClient, exercise: dict) -> None:
    items = client.get("/api/v1/ttx").json()["items"]

    assert items[0]["msel_status"] == "draft"


# -- save, lifecycle -----------------------------------------------------------


def test_the_sample_msel_reaches_ready_and_freezes_a_snapshot(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ready = _to_ready(client, exercise)

    assert ready["status"] == "ready"
    assert ready["validation"]["warnings"] == []
    snapshot = db_session.exec(select(MselSnapshot)).one()
    assert snapshot.version == 1
    assert len(snapshot.payload["injects"]) == 18
    assert "validation" not in snapshot.payload


def test_codes_and_ids_are_stable_and_never_reused(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    saved = _saved_example(client, exercise)
    codes = [i["code"] for i in saved["injects"]]
    assert codes[:3] == ["INJ-01", "INJ-02", "INJ-03"]
    # One series whatever the kind: the contingent injects follow on.
    assert codes[13:15] == ["INJ-14", "INJ-15"]
    assert [p["code"] for p in saved["phases"]] == ["PH-01", "PH-02", "PH-03", "PH-04"]
    assert saved["injects"][0]["expected_actions"][0]["code"] == "INJ-01-A1"

    payload = _payload_from(saved)
    first = payload["injects"][0]
    payload["injects"] = payload["injects"][1:]  # drop INJ-01
    payload["injects"][0]["kind"] = "contingent"  # INJ-02 changes kind
    payload["injects"][0]["trigger_condition"] = "If nobody escalates"
    payload["injects"][0]["contingent_purpose"] = "Accelerate"
    payload["injects"].append(
        {
            **first,
            "id": None,
            "title": "A new one",
            "expected_actions": [{**a, "id": None} for a in first["expected_actions"]],
        }
    )
    again = _put(client, exercise["ttx"]["id"], payload).json()

    by_title = {i["title"]: i for i in again["injects"]}
    # A kind change keeps the code.
    assert by_title["Helpdesk flooded with 'files won't open' calls"]["code"] == "INJ-02"
    assert (
        by_title["Helpdesk flooded with 'files won't open' calls"]["id"]
        == saved["injects"][1]["id"]
    )
    assert by_title["A new one"]["code"] == "INJ-19"
    assert saved["injects"][0]["id"] not in {i["id"] for i in again["injects"]}
    assert db_session.get(Inject, uuid.UUID(saved["injects"][0]["id"])) is None


def test_a_stale_revision_is_rejected(client: TestClient, exercise: dict) -> None:
    _saved_example(client, exercise)

    stale = _put(client, exercise["ttx"]["id"], example_payload(exercise["msel"]))

    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "MSEL_STALE"


def test_editing_a_ready_msel_opens_a_new_draft_version(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ready = _to_ready(client, exercise)
    payload = _payload_from(ready)
    payload["title"] = "Operation Dark Grid II"

    edited = _put(client, exercise["ttx"]["id"], payload).json()

    assert edited["status"] == "draft"
    assert edited["version"] == 2
    assert len(db_session.exec(select(MselSnapshot)).all()) == 1


def test_marking_ready_records_who_without_a_step_up(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    saved = _saved_example(client, exercise)
    assert saved["ready_by"] == "" and saved["ready_at"] is None
    assert _move(client, ttx_id, "in_review").status_code == 200
    # A sign-in long ago doesn't matter: marking ready is a sign-off.
    for user_session in db_session.exec(select(UserSession)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()

    ready = _move(client, ttx_id, "ready")

    assert ready.status_code == 200, ready.text
    assert ready.json()["ready_by"] == "Ada Manager"
    assert ready.json()["ready_by_id"] and ready.json()["ready_at"]
    back = _move(client, ttx_id, "draft").json()
    assert (back["ready_by"], back["ready_by_id"], back["ready_at"]) == ("", None, None)


def test_transitions_follow_the_order_and_the_rules(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    assert _move(client, ttx_id, "ready").json()["error"]["code"] == "INVALID_TRANSITION"
    blank = _move(client, ttx_id, "in_review")
    assert blank.status_code == 409
    assert blank.json()["error"]["code"] == "MSEL_INVALID"

    payload = example_payload(exercise["msel"])
    payload["injects"][0]["review_status"] = "draft"
    saved = _put(client, ttx_id, payload).json()
    assert _codes(saved["validation"]["approved"]) == {"INJECT_NOT_VALIDATED"}
    # M12 doesn't stop the review -- reviewing is how injects get validated.
    assert _move(client, ttx_id, "in_review").status_code == 200
    assert _move(client, ttx_id, "ready").json()["error"]["code"] == "MSEL_INVALID"
    assert _move(client, ttx_id, "draft").json()["status"] == "draft"


def test_who_validated_an_inject_is_stamped_by_the_server(
    client: TestClient, exercise: dict, db_session: Session
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["validated_by"] = "Someone Else"
    saved = _put(client, ttx_id, payload).json()
    first = saved["injects"][0]
    # Whatever name the client sends, the saving user is recorded.
    assert first["validated_by"] == "Ada Manager"
    ada_id = first["validated_by_id"]
    assert ada_id

    colleague = _account(db_session, "eve@acme.com", "Eve Colleague")
    db_session.add(
        TTXAccess(user_id=colleague.id, ttx_id=uuid.UUID(ttx_id), role=RoleEnum.PLANNER, plans=True)
    )
    db_session.commit()
    _login(client, "eve@acme.com")
    _enable_totp(db_session, colleague)

    # Saving it again as it is keeps Ada's validation.
    kept = _put(client, ttx_id, _payload_from(saved)).json()
    assert kept["injects"][0]["validated_by_id"] == ada_id
    # Naming someone else can't be forged: it becomes the saver's override.
    forged = _payload_from(kept)
    forged["injects"][0]["validated_by_id"] = str(uuid.uuid4())
    taken = _put(client, ttx_id, forged).json()["injects"][0]
    assert (taken["validated_by"], taken["validated_by_id"]) == ("Eve Colleague", str(colleague.id))

    # Back to draft clears it.
    latest = _open(client, ttx_id)
    reopened = _payload_from(latest)
    reopened["injects"][0]["review_status"] = "draft"
    cleared = _put(client, ttx_id, reopened).json()["injects"][0]
    assert (cleared["validated_by"], cleared["validated_by_id"]) == ("", None)

    # Validated again by Eve; the name goes with her account when deleted.
    again = _payload_from(_open(client, ttx_id))
    again["injects"][0]["review_status"] = "validated"
    assert _put(client, ttx_id, again).json()["injects"][0]["validated_by"] == "Eve Colleague"
    deleted = client.request(
        "DELETE",
        "/api/v1/auth/me",
        json={"confirmation": "delete my account"},
        headers=_csrf(client),
    )
    assert deleted.status_code == 204, deleted.text
    stored = db_session.get(Inject, uuid.UUID(taken["id"]))
    db_session.refresh(stored)
    assert stored.validated_by == "Deleted user"


# -- rules ---------------------------------------------------------------------


def test_noise_may_name_no_technique(client: TestClient, exercise: dict) -> None:
    """Noise names techniques only if it wants to; a threat actor's
    activity always should."""
    payload = example_payload(exercise["msel"])
    inject = next(i for i in payload["injects"] if i["kind"] == "mandatory")
    inject.update(attack_attribution="noise", threat_actor_key=None, attack_techniques=[])
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    codes = {i["code"] for i in saved["validation"]["warnings"]}
    assert "ATTRIBUTION_WITHOUT_TECHNIQUE" not in codes


def test_branches_may_share_a_parent_and_hang_from_branches(
    client: TestClient, exercise: dict
) -> None:
    """Several contingent injects may branch off one inject, and one may
    branch off another contingent inject of its phase."""
    payload = example_payload(exercise["msel"])
    # c3 and c4 both branch off m11 already; c4 now off c3 instead.
    _row(payload, "c4").update(branch_from_key="c3", branch_action_key=None)
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    codes = {i["code"] for i in saved["validation"]["ready"]} | {
        i["code"] for i in saved["validation"]["warnings"]
    }
    assert not codes & {
        "BRANCH_NOT_ANCHORED",
        "BRANCH_CYCLE",
        "BRANCH_FROM_OTHER_PHASE",
        "BRANCH_REJOIN_INVALID",
    }


def test_threat_actor_issues_are_reported_under_their_own_tab(
    client: TestClient, exercise: dict
) -> None:
    """Threat actors have their own tab (section 4), before Injects."""
    payload = example_payload(exercise["msel"])
    payload["threat_actors"][0]["name"] = ""
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    nameless = [
        i
        for i in saved["validation"]["ready"]
        if i["code"] == "MSEL_INCOMPLETE" and i["field"] == "threat_actor_name"
    ]
    assert [i["section"] for i in nameless] == [4]


def test_a_third_party_can_receive_injects(client: TestClient, exercise: dict) -> None:
    """Third parties taking part (optional participants) are recipients and
    responsibles like the participating areas."""
    assert exercise["msel"]["needs"]["third_parties"] == ["National CSIRT"]
    payload = example_payload(exercise["msel"])
    inject = next(i for i in payload["injects"] if i["kind"] == "mandatory")
    inject["recipients"] = ["National CSIRT"]
    inject["expected_actions"][0]["responsible_role"] = "National CSIRT"
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    codes = _codes(saved["validation"]["ready"])
    assert "RECIPIENT_NOT_IN_SCOPE" not in codes
    assert "RESPONSIBLE_NOT_IN_SCOPE" not in codes


def test_a_scenario_holds_up_to_eight_phases(client: TestClient, exercise: dict) -> None:
    payload = example_payload(exercise["msel"])
    extra = [
        {**payload["phases"][-1], "key": f"x{i}", "name": f"Extra {i}", "objective_ids": []}
        for i in range(4)
    ]
    payload["phases"] += extra  # 8 in all
    assert _put(client, exercise["ttx"]["id"], payload).status_code == 200
    again = example_payload(_open(client, exercise["ttx"]["id"]))
    again["phases"] += [*extra, {**extra[0], "key": "x9"}]  # 9
    assert _put(client, exercise["ttx"]["id"], again).status_code == 422


def test_a_phase_needs_no_contingent_inject(client: TestClient, exercise: dict) -> None:
    """Contingent injects are recommended, never asked for: a phase left
    without one raises nothing."""
    payload = example_payload(exercise["msel"])
    for inject in payload["injects"]:
        if inject["kind"] == "contingent":
            inject["phase_key"] = "p1"
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    codes = {i["code"] for i in saved["validation"]["warnings"]}
    assert "PHASE_WITHOUT_CONTINGENT" not in codes


def _first(kind: str) -> Callable[[dict], dict]:
    return lambda p: next(i for i in p["injects"] if i["kind"] == kind)


mandatory, contingent = _first("mandatory"), _first("contingent")


def _row(payload: dict, key: str) -> dict:
    return next(i for i in payload["injects"] if i["key"] == key)


def _set(target: Callable[[dict], dict], **values) -> Callable[[dict], None]:
    return lambda p: target(p).update(values)


def _only_contingent(payload: dict, objective_ids: list[str]) -> None:
    for inject in payload["injects"]:
        if inject["objective_ids"] == objective_ids:
            inject.update(kind="contingent", trigger_condition="x", contingent_purpose="y")


RULES = [
    # (id, mutation, report list, code)
    ("M01-objective", _set(mandatory, objective_ids=[]), "ready", "INJECT_WITHOUT_OBJECTIVE"),
    ("M01-action", _set(mandatory, expected_actions=[]), "ready", "INJECT_WITHOUT_EXPECTED_ACTION"),
    (
        "M03",
        lambda p: _only_contingent(p, mandatory(p)["objective_ids"]),
        "ready",
        "OBJECTIVE_NOT_COVERED",
    ),  # fmt: skip
    (
        "M04",
        lambda p: [
            i.update(objective_ids=[])
            for i in p["injects"]
            if i is not mandatory(p) and i["objective_ids"] == mandatory(p)["objective_ids"]
        ],
        "warnings",
        "OBJECTIVE_FEW_ACTIONS",
    ),  # fmt: skip
    ("M05-phase", _set(mandatory, offset_minutes=100), "ready", "INJECT_OUTSIDE_PHASE"),
    ("M05-offset", _set(mandatory, offset_minutes=None), "ready", "INJECT_OFFSET_REQUIRED"),
    ("M05-end", _set(mandatory, offset_minutes=200), "ready", "INJECT_AFTER_END"),
    ("M06-overlap", lambda p: p["phases"][1].update(start_offset=30), "warnings", "PHASES_OVERLAP"),
    ("M06-gap", lambda p: p["phases"][1].update(start_offset=60), "warnings", "PHASE_GAP"),
    (
        "M06-start",
        lambda p: p["phases"][0].update(start_offset=15),
        "warnings",
        "SESSION_START_UNCOVERED",
    ),
    (
        "M06-end",
        lambda p: p["phases"][3].update(end_offset=160),
        "warnings",
        "SESSION_END_UNCOVERED",
    ),
    ("M08", _set(contingent, trigger_condition=""), "ready", "CONTINGENT_INCOMPLETE"),
    ("M09-recipient", _set(mandatory, recipients=["Marketing"]), "ready", "RECIPIENT_NOT_IN_SCOPE"),
    (
        "M09-role",
        lambda p: mandatory(p)["expected_actions"][0].update(responsible_role="Legal"),
        "ready",
        "RESPONSIBLE_NOT_IN_SCOPE",
    ),  # fmt: skip
    (
        "M10-burst",
        lambda p: (
            [
                i.update(offset_minutes=35 + n)
                for n, i in enumerate(p["injects"][:4])
                if i["phase_key"] == "p0"
            ]
            and None
        ),
        "warnings",
        "INJECT_BURST",
    ),  # fmt: skip
    ("M18", _set(mandatory, attack_techniques=[]), "warnings", "ATTRIBUTION_WITHOUT_TECHNIQUE"),
    ("M19", _set(mandatory, threat_actor_key=None), "warnings", "ATTRIBUTION_WITHOUT_ACTOR"),
    (
        "M20",
        _set(mandatory, attack_techniques=[attack_ref("T1498")]),
        "warnings",
        "TECHNIQUE_OFF_ACTOR_PROFILE",
    ),
    (
        "M21",
        lambda p: p["threat_actors"].append(
            {"key": "t1", "name": "Sandworm Team", "mitre_group_id": "G0034"}
        ),
        "warnings",
        "THREAT_ACTOR_WITHOUT_INJECTS",
    ),
    (
        "threat-actor-name",
        lambda p: p["threat_actors"][0].update(name=""),
        "ready",
        "MSEL_INCOMPLETE",
    ),
    ("M12", _set(mandatory, review_status="draft"), "approved", "INJECT_NOT_VALIDATED"),
    (
        "M13-en",
        lambda p: mandatory(p)["expected_actions"][0].update(description="Manage the crisis"),
        "warnings",
        "VAGUE_EXPECTED_ACTION",
    ),  # fmt: skip
    (
        "M13-es",
        lambda p: mandatory(p)["expected_actions"][0].update(
            description="Analizar la situación con el comité"
        ),
        "warnings",
        "VAGUE_EXPECTED_ACTION",
    ),  # fmt: skip
    (
        "M24",
        lambda p: mandatory(p)["expected_actions"][0].update(objective_ids=[]),
        "warnings",
        "ACTION_WITHOUT_OBJECTIVE",
    ),
    (
        "M14",
        _set(contingent, branch_from_key=None, branch_action_key=None, rejoin_key=None),
        "ready",
        "BRANCH_NOT_ANCHORED",
    ),
    (
        "M15",
        lambda p: (
            [
                _row(p, "c0").update(branch_from_key="c1", branch_action_key=None),
                _row(p, "c1").update(branch_from_key="c0", branch_action_key=None),
            ]
            and None
        ),
        "ready",
        "BRANCH_CYCLE",
    ),  # fmt: skip
    ("M16", _set(contingent, rejoin_key=None), "warnings", "BRANCH_WITHOUT_REJOIN"),
    # Back at T+0 from a branch that leaves at T+70.
    (
        "M17-earlier",
        lambda p: _row(p, "c1").update(rejoin_key="m0"),
        "ready",
        "BRANCH_REJOIN_INVALID",
    ),
    ("M17-contingent", _set(contingent, rejoin_key="c1"), "ready", "BRANCH_REJOIN_INVALID"),
    # Back at the very inject it leaves from: not later.
    ("M17-same", _set(contingent, rejoin_key="m0"), "ready", "BRANCH_REJOIN_INVALID"),
    # c0 is in the first phase; m6 in the second.
    (
        "M14-phase",
        _set(contingent, branch_from_key="m6", branch_action_key=None),
        "ready",
        "BRANCH_FROM_OTHER_PHASE",
    ),
    ("duration", lambda p: p.update(duration_minutes=300), "ready", "DURATION_EXCEEDS_LIMIT"),
    (
        "phases",
        lambda p: p.update(
            phases=p["phases"][:1], injects=[{**i, "phase_key": "p0"} for i in p["injects"]]
        ),
        "ready",
        "PHASES_REQUIRED",
    ),  # fmt: skip
    ("incomplete", lambda p: p.update(title=""), "ready", "MSEL_INCOMPLETE"),
    # c0's phase lasts 45 minutes.
    ("M22", _set(contingent, fires_at_minute=60), "ready", "CHECK_AFTER_PHASE_END"),
    (
        "M23-mandatory",
        lambda p: mandatory(p)["expected_actions"][0].update(expected_within_minutes=60),
        "warnings",
        "ACTION_PAST_PHASE_END",
    ),  # fmt: skip
    # Checked at minute 40, its action (within 15) ends 10 minutes late.
    ("M23-contingent", _set(contingent, fires_at_minute=40), "warnings", "ACTION_PAST_PHASE_END"),
]


@pytest.mark.parametrize(
    ("mutate", "report", "code"), [r[1:] for r in RULES], ids=[r[0] for r in RULES]
)
def test_each_rule_is_reported(
    client: TestClient, exercise: dict, mutate, report: str, code: str
) -> None:
    clean = example_payload(exercise["msel"])
    payload = copy.deepcopy(clean)
    mutate(payload)

    response = client.post(
        _url(exercise["ttx"]["id"], "/validate"), json=payload, headers=_csrf(client)
    )

    assert response.status_code == 200, response.text
    assert code in _codes(response.json()[report])
    # The untouched sample passes the same rule.
    clean_report = client.post(
        _url(exercise["ttx"]["id"], "/validate"), json=clean, headers=_csrf(client)
    ).json()
    assert code not in _codes(clean_report[report])


def test_the_dry_run_saves_nothing_and_names_new_rows_by_key(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["objective_ids"] = []

    report = client.post(
        _url(exercise["ttx"]["id"], "/validate"), json=payload, headers=_csrf(client)
    ).json()

    issue = next(i for i in report["ready"] if i["code"] == "INJECT_WITHOUT_OBJECTIVE")
    assert issue == {"code": "INJECT_WITHOUT_OBJECTIVE", "section": 3,
                     "field": "objective_ids", "item_id": "m0"}  # fmt: skip
    assert db_session.exec(select(Inject)).all() == []


def test_links_to_unknown_objectives_block_the_save(client: TestClient, exercise: dict) -> None:
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["objective_ids"] = [str(uuid.uuid4())]

    report = client.post(
        _url(exercise["ttx"]["id"], "/validate"), json=payload, headers=_csrf(client)
    ).json()
    saved = _put(client, exercise["ttx"]["id"], payload)

    assert "UNKNOWN_OBJECTIVE" in _codes(report["ready"])
    assert saved.status_code == 422
    assert saved.json()["error"]["code"] == "UNKNOWN_OBJECTIVE"


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p["injects"][0].update(
            attack_techniques=[
                {"domain": "enterprise", "tactic_id": "TA0001", "technique_id": "T9999"}
            ]
        ),
        # A real technique under a tactic it doesn't belong to.
        lambda p: p["injects"][0].update(
            attack_techniques=[
                {"domain": "enterprise", "tactic_id": "TA0001", "technique_id": "T1486"}
            ]
        ),
        # Not an ATT&CK id at all.
        lambda p: p["injects"][0].update(
            attack_techniques=[{"domain": "ics", "tactic_id": "TA0105", "technique_id": "T0827X"}]
        ),
        # A threat actor naming a group or a technique the release lacks.
        lambda p: p["threat_actors"][0].update(mitre_group_id="G9999"),
        lambda p: p["threat_actors"][0]["techniques"].append(
            {"domain": "enterprise", "technique_id": "T9999"}
        ),
        # More threat actors than a scenario holds.
        lambda p: p["threat_actors"].extend({"key": f"x{n}", "name": "X"} for n in range(5)),
        lambda p: p["injects"][0].update(phase_key="nowhere"),
        lambda p: p["injects"][0].update(actor_key="nobody"),
        # A time jump longer than 30 days of incident time.
        lambda p: p["phases"][0].update(incident_jump_minutes=30 * 24 * 60 + 1),
    ],
    ids=[
        "unknown-technique",
        "wrong-tactic",
        "malformed-technique",
        "unknown-phase",
        "unknown-actor",
        "unknown-group",
        "unknown-profile-technique",
        "too-many-threat-actors",
        "jump-too-long",
    ],
)
def test_what_can_never_be_stored_is_rejected(client: TestClient, exercise: dict, mutate) -> None:
    payload = example_payload(exercise["msel"])
    mutate(payload)

    assert _put(client, exercise["ttx"]["id"], payload).status_code == 422


# -- sync with the needs analysis -------------------------------------------------


def test_the_msel_is_read_only_while_the_needs_analysis_is_revised(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    saved = _saved_example(client, exercise)
    assert _transition(client, ttx_id, "draft").status_code == 200

    read = _open(client, ttx_id)
    blocked = _put(client, ttx_id, _payload_from(saved))

    assert read["editable"] is False
    assert read["needs"]["status"] == "draft"
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "NEEDS_FORM_NOT_APPROVED"
    assert _move(client, ttx_id, "in_review").status_code == 409


def _reapprove(client: TestClient, ttx_id: str) -> None:
    """Reopen the needs analysis (a new version) and approve it again,
    keeping its objectives -- the MSEL links them."""
    assert _transition(client, ttx_id, "draft").status_code == 200
    form = _get(client, ttx_id)
    payload = _complete_payload(form)
    for objective, saved in zip(payload["objectives"], form["objectives"], strict=True):
        objective["id"] = saved["id"]
    assert _save(client, ttx_id, payload).status_code == 200
    assert _transition(client, ttx_id, "ready_for_approval").status_code == 200
    for kind in ("sponsor", "design_lead"):
        response = client.post(
            f"/api/v1/ttx/{ttx_id}/needs-form/approvals",
            json={"approver_kind": kind, "approver_name": kind, "approver_role": "Role",
                  "approved_on": "2026-09-27"},
            headers=_csrf(client),
        )  # fmt: skip
        assert response.status_code == 201
    assert _transition(client, ttx_id, "approved").status_code == 200


def test_approving_the_needs_analysis_needs_no_step_up_and_is_audited(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    for user_session in db_session.exec(select(UserSession)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()

    _reapprove(client, ttx_id)

    actions = [
        e.action
        for e in db_session.exec(
            select(PlatformAuditEvent).where(PlatformAuditEvent.target_id == uuid.UUID(ttx_id))
        )
    ]
    # The fixture approved version 1; this approves version 2.
    assert actions.count("exercise.needs_approval_recorded") == 4
    assert actions.count("exercise.needs_approved") == 2


def test_a_new_needs_version_must_be_acknowledged(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    _to_ready(client, exercise)
    _reapprove(client, ttx_id)

    msel = _open(client, ttx_id)
    assert "NEEDS_VERSION_CHANGED" in _codes(msel["validation"]["ready"])
    # Reported in Review (section 6), where it's acknowledged.
    assert {
        i["section"] for i in msel["validation"]["ready"] if i["code"] == "NEEDS_VERSION_CHANGED"
    } == {6}

    acknowledged = client.post(
        _url(ttx_id, "/acknowledge-needs-version"), headers=_csrf(client)
    ).json()
    assert acknowledged["needs_form_version"] == 2
    assert acknowledged["status"] == "draft"
    assert acknowledged["version"] == 2
    assert "NEEDS_VERSION_CHANGED" not in _codes(acknowledged["validation"]["ready"])


def test_an_objective_the_msel_uses_cannot_be_deleted(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    _saved_example(client, exercise)
    form = _get(client, ttx_id)
    payload = _complete_payload(form)
    payload["objectives"] = [
        {**o, "id": saved["id"]}
        for o, saved in zip(payload["objectives"], form["objectives"], strict=True)
    ][1:]
    payload["capabilities"] = [
        "regulatory_notification",
        "cross_unit_coordination",
        "crisis_decision_making",
    ]

    report = client.post(
        f"/api/v1/ttx/{ttx_id}/needs-form/validate", json=payload, headers=_csrf(client)
    ).json()
    saved = _save(client, ttx_id, payload)

    assert "OBJECTIVE_IN_USE" in _codes(report["ready"])
    assert saved.status_code == 409
    assert saved.json()["error"]["code"] == "OBJECTIVE_IN_USE"
    assert "INJ-" in saved.json()["error"]["message"]


# -- EEG -------------------------------------------------------------------------


def test_the_eeg_lists_each_expected_action_once_under_its_objectives(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = example_payload(exercise["msel"])
    both = payload["injects"][0]
    both["objective_ids"] = [o["id"] for o in exercise["msel"]["needs"]["objectives"][:2]]
    _put(client, ttx_id, payload)

    eeg = client.get(f"/api/v1/ttx/{ttx_id}/eeg").json()

    first, second, _ = eeg["objectives"]
    assert [a["code"] for a in first["expected_actions"]].count("INJ-01-A1") == 1
    assert [a["code"] for a in second["expected_actions"]].count("INJ-01-A1") == 1
    assert first["expected_actions"][0]["inject_code"] == "INJ-01"
    total = sum(len(o["expected_actions"]) for o in eeg["objectives"])
    assert total == 19  # 18 injects, one of them under two objectives
    # The success-criterion observation points stay.
    assert first["observation_points"]


def test_an_expected_action_names_the_objectives_it_evidences(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    objectives = [o["id"] for o in exercise["msel"]["needs"]["objectives"]]
    payload = example_payload(exercise["msel"])
    inject = payload["injects"][0]
    inject["objective_ids"] = objectives[:2]
    first_action = dict(inject["expected_actions"][0])
    inject["expected_actions"] = [
        # Unnamed: all of the inject's.
        {**first_action, "description": "Name the lead"},
        # Only the second; an objective outside the inject is dropped.
        {**first_action, "description": "Agree a cadence", "objective_ids": objectives[1:]},
        # None: it stays in the MSEL, no EEG lists it.
        {**first_action, "description": "Brief the staff", "objective_ids": []},
    ]

    saved = _put(client, ttx_id, payload).json()

    actions = saved["injects"][0]["expected_actions"]
    assert [a["objective_ids"] for a in actions] == [objectives[:2], [objectives[1]], []]
    assert "ACTION_WITHOUT_OBJECTIVE" in _codes(saved["validation"]["warnings"])
    eeg = client.get(f"/api/v1/ttx/{ttx_id}/eeg").json()
    listed = {
        o["code"]: [a["description"] for a in o["expected_actions"] if a["inject_code"] == "INJ-01"]
        for o in eeg["objectives"]
    }
    assert listed["OBJ-01"] == ["Name the lead"]
    assert listed["OBJ-02"] == ["Name the lead", "Agree a cadence"]

    # Taking an objective off the inject takes it off its actions too.
    again = _payload_from(saved)
    again["injects"][0]["objective_ids"] = objectives[:1]
    resaved = _put(client, ttx_id, again).json()
    assert [a["objective_ids"] for a in resaved["injects"][0]["expected_actions"]] == [
        objectives[:1],
        [],
        [],
    ]


def test_an_unscored_inject_clears_its_actions_objectives(
    client: TestClient, exercise: dict
) -> None:
    payload = example_payload(exercise["msel"])
    inject = payload["injects"][0]
    inject["format"] = "discussion"
    inject["expected_actions"][0]["objective_ids"] = inject["objective_ids"]

    saved = _put(client, exercise["ttx"]["id"], payload).json()

    assert saved["injects"][0]["expected_actions"][0]["objective_ids"] == []
    # An unscored inject evidences nothing on purpose: no warning.
    assert "ACTION_WITHOUT_OBJECTIVE" not in _codes(saved["validation"]["warnings"])


def test_evaluators_rate_against_the_frozen_ready_version(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    evaluator = _account(db_session, "auditor@external-audit.org")
    granted = client.post(
        f"/api/v1/organizations/{exercise['org_id']}/evaluators",
        json={"email": evaluator.email},
        headers=_csrf(client),
    )
    assert granted.status_code == 201
    added = client.post(
        f"/api/v1/ttx/{ttx_id}/evaluators", json={"email": evaluator.email}, headers=_csrf(client)
    )
    assert added.status_code == 201
    _saved_example(client, exercise)

    # The Evaluator uses a client of their own; the Planner's stays signed in.
    with TestClient(app) as evaluator_client:
        _login(evaluator_client, evaluator.email)
    _enable_totp(db_session, evaluator)

    def evaluator_eeg() -> dict:
        return evaluator_client.get(f"/api/v1/ttx/{ttx_id}/eeg").json()

    before = evaluator_eeg()
    assert before["msel_version"] is None
    assert all(o["expected_actions"] == [] for o in before["objectives"])

    assert _move(client, ttx_id, "in_review").status_code == 200
    ready = _move(client, ttx_id, "ready").json()
    payload = _payload_from(ready)
    payload["injects"][0]["expected_actions"][0]["description"] = "A later draft change"
    _put(client, ttx_id, payload)

    after = evaluator_eeg()
    assert after["msel_version"] == 1
    descriptions = {a["description"] for o in after["objectives"] for a in o["expected_actions"]}
    assert "A later draft change" not in descriptions
    assert len(descriptions) == 3


# -- cascade -----------------------------------------------------------------------


def test_deleting_the_organization_removes_the_msel(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    _to_ready(client, exercise)

    response = client.request(
        "DELETE",
        f"/api/v1/organizations/{exercise['org_id']}",
        json={"confirmation": "Acme"},
        headers=_csrf(client),
    )

    assert response.status_code == 204, response.text
    for model in (TTXMsel, MselPhase, Inject, MselSnapshot):
        assert db_session.exec(select(model)).all() == []


# -- ATT&CK releases ------------------------------------------------------------


def test_a_deprecated_technique_is_not_accepted(client: TestClient, exercise: dict) -> None:
    deprecated = next(
        t for t in load_domain("19.2", "enterprise").techniques.values() if t.deprecated
    )
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["attack_techniques"] = [
        {"domain": "enterprise", "tactic_id": deprecated.tactics[0], "technique_id": deprecated.id}
    ]
    response = _put(client, exercise["ttx"]["id"], payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNKNOWN_ATTACK_TECHNIQUE"


def test_upgrade_selection_follows_mitre_changes(next_release) -> None:
    outcome = upgrade_selection(
        [
            ("enterprise", "TA0001", "T1566"),
            ("enterprise", "TA0040", "T1490"),
            ("enterprise", "TA0008", "T1021"),
            ("enterprise", "TA0040", "T1486"),
        ],
        "99.0",
    )
    assert outcome.kept == [
        ("enterprise", "TA0001", "T1566.001"),
        ("enterprise", "TA0005", "T1021"),
        ("enterprise", "TA0040", "T1486"),
    ]
    assert outcome.replaced == [("T1566", "T1566.001")]
    assert outcome.removed == ["T1490"]


def test_an_msel_is_upgraded_explicitly_and_its_snapshot_keeps_the_old_release(
    client: TestClient, db_session: Session, exercise: dict, next_release
) -> None:
    ready = _to_ready(client, exercise)
    assert ready["attack_version"] == "19.2"

    response = client.post(
        f"/api/v1/ttx/{exercise['ttx']['id']}/msel/attack-upgrade", headers=_csrf(client)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["replaced"] == [{"from_id": "T1566", "to_id": "T1566.001"}]
    assert body["removed"] == ["T1490"]
    msel = body["msel"]
    assert msel["attack_version"] == "99.0"
    ids = [r["technique_id"] for r in msel["attack_techniques"]]
    assert "T1566.001" in ids and "T1490" not in ids and "T1566" not in ids
    # Injects and threat actor profiles are remapped the same way, so an
    # inject's technique is still in its actor's profile.
    phishing = next(i for i in msel["injects"] if i["title"].startswith("Phishing"))
    assert [r["technique_id"] for r in phishing["attack_techniques"]] == ["T1566.001"]
    profile = [t["technique_id"] for t in msel["threat_actors"][0]["techniques"]]
    assert "T1566.001" in profile and "T1566" not in profile and "T1490" not in profile
    assert "TECHNIQUE_OFF_ACTOR_PROFILE" not in _codes(msel["validation"]["warnings"])
    # Like an edit: a READY MSEL opens a new version; the frozen one keeps v19.2.
    assert (msel["status"], msel["version"]) == ("draft", ready["version"] + 1)
    snapshot = db_session.exec(select(MselSnapshot)).one().payload
    assert snapshot["attack_version"] == "19.2"
    assert "Phishing" in [r["technique_name"] for r in snapshot["attack_techniques"]]

    again = client.post(
        f"/api/v1/ttx/{exercise['ttx']['id']}/msel/attack-upgrade", headers=_csrf(client)
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "ATTACK_VERSION_NOT_NEWER"


# -- storyline branches ------------------------------------------------------


def test_a_contingent_inject_branches_off_and_rejoins_the_storyline(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    saved = _put(client, ttx_id, example_payload(exercise["msel"])).json()
    by_id = {i["id"]: i for i in saved["injects"]}
    by_title = {i["title"]: i for i in saved["injects"]}

    regulator = by_title["Regulator calls the CEO directly"]
    parent = by_id[regulator["branch_from_id"]]
    assert parent["title"] == "Journalist asks about a 'grid cyberattack'"
    assert regulator["branch_action_id"] == parent["expected_actions"][0]["id"]
    assert by_id[regulator["rejoin_inject_id"]]["offset_minutes"] == 90
    # Mandatory injects are the storyline itself: no branch.
    assert all(
        i["branch_from_id"] is None and i["rejoin_inject_id"] is None
        for i in saved["injects"]
        if i["kind"] == "mandatory"
    )

    # Saved again by id, the branches survive untouched.
    again = _put(client, ttx_id, _payload_from(saved)).json()
    assert {i["id"]: i["branch_from_id"] for i in again["injects"]} == {
        i["id"]: i["branch_from_id"] for i in saved["injects"]
    }
    assert not {c for c in _codes(again["validation"]["warnings"]) if c.startswith("BRANCH")}


def test_a_phase_keeps_its_headline_and_the_scene_its_date(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = example_payload(exercise["msel"])
    payload["incident_date"] = "2026-05-03"
    payload["phases"][0]["headline"] = "Supplier breach"
    saved = _put(client, ttx_id, payload).json()
    assert saved["incident_date"] == "2026-05-03"
    assert [p["headline"] for p in saved["phases"]] == ["Supplier breach", "", "", ""]
    too_long = {**payload, "revision": saved["revision"]}
    too_long["phases"] = [{**payload["phases"][0], "headline": "x" * 81}, *payload["phases"][1:]]
    assert _put(client, ttx_id, too_long).status_code == 422

    again = _put(client, ttx_id, _payload_from(saved)).json()
    assert again["phases"][0]["headline"] == "Supplier breach"
    assert again["incident_date"] == "2026-05-03"


def test_a_phase_keeps_its_time_jump(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    saved = _put(client, ttx_id, example_payload(exercise["msel"])).json()
    assert [p["incident_jump_minutes"] for p in saved["phases"]] == [0, 0, 720, 0]
    # The scene's clock is the scenario's own, apart from the meeting's.
    assert (saved["exercise_start"], saved["incident_start"]) == ("09:30:00", "06:45:00")

    again = _put(client, ttx_id, _payload_from(saved)).json()
    assert [p["incident_jump_minutes"] for p in again["phases"]] == [0, 0, 720, 0]


def test_a_mandatory_inject_keeps_no_branch(client: TestClient, exercise: dict) -> None:
    payload = example_payload(exercise["msel"])
    _row(payload, "m1").update(branch_from_key="m0", rejoin_key="m2")
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    second = next(i for i in saved["injects"] if i["code"] == "INJ-02")
    assert second["branch_from_id"] is None and second["rejoin_inject_id"] is None


@pytest.mark.parametrize(
    ("mutate", "field"),
    [
        (lambda p: _row(p, "c0").update(branch_from_key="nowhere"), "branch_from_id"),
        (lambda p: _row(p, "c0").update(rejoin_key="c0"), "rejoin_inject_id"),
        # An expected action of another inject than the one it hangs from.
        (lambda p: _row(p, "c0").update(branch_action_key="m6-a0"), "branch_action_id"),
    ],
    ids=["unknown-inject", "itself", "foreign-action"],
)
def test_a_branch_end_outside_the_msel_is_dropped_not_refused(
    client: TestClient, exercise: dict, mutate, field: str
) -> None:
    """Removing the inject a branch hangs from must never block the save:
    the end that no longer points inside the MSEL is dropped (and the
    report says so)."""
    payload = example_payload(exercise["msel"])
    mutate(payload)
    saved = _put(client, exercise["ttx"]["id"], payload)
    assert saved.status_code == 200
    first_contingent = next(i for i in saved.json()["injects"] if i["code"] == "INJ-14")
    assert first_contingent[field] is None


def test_removing_an_inject_cuts_the_branches_that_hang_from_it(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    saved = _put(client, ttx_id, example_payload(exercise["msel"])).json()
    regulator = next(i for i in saved["injects"] if i["title"].startswith("Regulator calls"))

    response = client.delete(
        _url(ttx_id, f"/injects/{regulator['branch_from_id']}"), headers=_csrf(client)
    )

    assert response.status_code == 204
    after = client.get(_url(ttx_id)).json()
    regulator = next(i for i in after["injects"] if i["id"] == regulator["id"])
    assert regulator["branch_from_id"] is None and regulator["branch_action_id"] is None
    assert "BRANCH_NOT_ANCHORED" in _codes(after["validation"]["ready"])


# -- threat actors and ATT&CK attribution --------------------------------------


def test_injects_attribute_their_techniques_to_a_threat_actor_or_noise(
    client: TestClient, exercise: dict
) -> None:
    payload = example_payload(exercise["msel"])
    payload["threat_actors"].append(
        {
            "key": "t1",
            "name": "Sandworm Team",
            "mitre_group_id": "G0034",
            "aliases": ["ELECTRUM"],
            "description": "Brought in for the OT phase.",
            "techniques": [{"domain": "ics", "technique_id": "T0827"}],
            "origin": "system",
            "origin_id": "G0034",
            "origin_name": "Sandworm Team",
        }
    )
    _row(payload, "m9").update(threat_actor_key="t1")
    _row(payload, "m1").update(attack_attribution="noise", threat_actor_key=None)

    msel = _put(client, exercise["ttx"]["id"], payload).json()

    affiliate, sandworm = msel["threat_actors"]
    assert (affiliate["code"], sandworm["code"]) == ("THR-01", "THR-02")
    assert (sandworm["mitre_group_id"], sandworm["origin_id"]) == ("G0034", "G0034")
    assert sandworm["techniques"][0]["technique_name"] == "Loss of Control"
    by_title = {i["title"]: i for i in msel["injects"]}
    feeder = by_title["Loss of control of a substation feeder"]
    assert (feeder["attack_attribution"], feeder["threat_actor_id"]) == (
        "threat_actor",
        sandworm["id"],
    )
    helpdesk = by_title["Helpdesk flooded with 'files won't open' calls"]
    assert (helpdesk["attack_attribution"], helpdesk["threat_actor_id"]) == ("noise", None)
    assert not {
        "ATTRIBUTION_WITHOUT_ACTOR",
        "TECHNIQUE_OFF_ACTOR_PROFILE",
        "THREAT_ACTOR_WITHOUT_INJECTS",
    } & _codes(msel["validation"]["warnings"])

    # Saved again by id, the threat actors keep their codes.
    again = _put(client, exercise["ttx"]["id"], _payload_from(msel)).json()
    assert [t["code"] for t in again["threat_actors"]] == ["THR-01", "THR-02"]


def test_removing_a_threat_actor_never_blocks_the_save(client: TestClient, exercise: dict) -> None:
    msel = _put(client, exercise["ttx"]["id"], example_payload(exercise["msel"])).json()
    payload = _payload_from(msel)
    payload["threat_actors"] = []
    # Techniques with no attribution aren't kept either.
    payload["injects"][1]["attack_attribution"] = None

    saved = _put(client, exercise["ttx"]["id"], payload)

    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["threat_actors"] == []
    first, second = body["injects"][0], body["injects"][1]
    assert (first["attack_attribution"], first["threat_actor_id"]) == ("threat_actor", None)
    assert second["attack_techniques"] == []
    assert "ATTRIBUTION_WITHOUT_ACTOR" in _codes(body["validation"]["warnings"])


def test_threat_actors_are_added_and_removed_one_at_a_time(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    msel = _put(client, ttx_id, example_payload(exercise["msel"])).json()
    headers = _csrf(client)

    added = client.post(
        _url(ttx_id, "/threat-actors"),
        json={
            "name": "APT28",
            "mitre_group_id": "G0007",
            "attack_version": "19.2",
            "techniques": [{"domain": "enterprise", "technique_id": "T1566.001"}],
            "origin": "organization",
            "origin_id": "0b7c9f5e-1111-4111-8111-111111111111",
            "origin_name": "APT28",
        },
        headers=headers,
    )
    assert added.status_code == 201, added.text
    assert (added.json()["actor"]["code"], added.json()["actor"]["origin"]) == (
        "THR-02",
        "organization",
    )

    affiliate = msel["threat_actors"][0]
    removed = client.delete(_url(ttx_id, f"/threat-actors/{affiliate['id']}"), headers=headers)
    assert removed.status_code == 204

    after = client.get(_url(ttx_id)).json()
    assert [t["name"] for t in after["threat_actors"]] == ["APT28"]
    # Its injects are still a threat actor's, now no one's (a warning).
    attributed = [i for i in after["injects"] if i["attack_attribution"] == "threat_actor"]
    assert attributed and all(i["threat_actor_id"] is None for i in attributed)
    assert after["revision"] == msel["revision"] + 2


def test_a_threat_actor_knows_whether_it_changed_since_copied(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    msel = _put(client, ttx_id, example_payload(exercise["msel"])).json()
    assert msel["threat_actors"][0]["modified_at"] is None

    # Saving the MSEL rewrites every row: an unchanged actor stays unmodified.
    payload = _payload_from(msel)
    payload["title"] = "Operation Dark Grid II"
    same = _put(client, ttx_id, payload).json()
    assert same["threat_actors"][0]["modified_at"] is None

    payload = _payload_from(same)
    payload["threat_actors"][0]["name"] = "Ransomware affiliate (adapted)"
    changed = _put(client, ttx_id, payload).json()
    assert changed["threat_actors"][0]["modified_at"] is not None


def test_a_write_after_the_session_expired_asks_to_sign_in(
    client: TestClient, exercise: dict
) -> None:
    """The browser drops both cookies when the session expires: a write
    then answers like any route needing a session (401), not as a CSRF
    failure the client can't act on."""
    payload = example_payload(exercise["msel"])
    client.cookies.clear()
    response = client.post(_url(exercise["ttx"]["id"], "/validate"), json=payload)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


# -- formats: inject, discussion, poll ---------------------------------------------


def test_a_poll_asks_a_question_and_evaluates_nothing(client: TestClient, exercise: dict) -> None:
    payload = example_payload(exercise["msel"])
    poll = _row(payload, "m12")
    poll.update(format="poll", poll_question="", poll_options=["Pay", " pay ", ""])
    poll.update(actor_key=None, recipients=[], content="")

    # A draft may be half written; the report says what's missing.
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    inject = next(i for i in saved["injects"] if i["code"] == "POL-13")
    assert inject["objective_ids"] == [] and inject["expected_actions"] == []
    issues = [
        (i["code"], i["field"])
        for i in saved["validation"]["ready"]
        if i["item_id"] == inject["id"]
    ]
    assert sorted(issues) == [
        ("POLL_INCOMPLETE", "poll_options"),
        ("POLL_INCOMPLETE", "poll_question"),
    ]

    payload = _payload_from(saved)
    row = next(i for i in payload["injects"] if i["id"] == inject["id"])
    row.update(poll_question="Pay the ransom?", poll_options=["Pay", "Refuse"])
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    assert not [i for i in saved["validation"]["ready"] if i["item_id"] == inject["id"]]

    # What follows each option goes by position, one per option, and a poll
    # that says it for only some of them gets a warning.
    payload = _payload_from(saved)
    row = next(i for i in payload["injects"] if i["id"] == inject["id"])
    row.update(poll_outcomes=["They come back for more."])
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    read = next(i for i in saved["injects"] if i["id"] == inject["id"])
    assert read["poll_outcomes"] == ["They come back for more.", ""]
    assert "POLL_OUTCOME_MISSING" in _codes(saved["validation"]["warnings"])

    # The meters: each needs a name of its own, and some poll to move it. A
    # meter that goes takes its impacts with it.
    payload = _payload_from(saved)
    payload["meters"] = [{"key": "m1", "name": "Stress"}, {"key": "m2", "name": "Budget"}]
    row = next(i for i in payload["injects"] if i["id"] == inject["id"])
    row.update(poll_impacts=[{"m1": 2, "gone": 3}, {"m1": 0}])
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    read = next(i for i in saved["injects"] if i["id"] == inject["id"])
    assert read["poll_impacts"] == [{"m1": 2}, {}]
    assert "METER_UNUSED" in _codes(saved["validation"]["warnings"])

    payload = _payload_from(saved)
    payload["meters"] = [{"key": "m1", "name": "Stress"}, {"key": "m2", "name": " stress "}]
    saved = _put(client, exercise["ttx"]["id"], payload).json()
    assert "METER_INCOMPLETE" in _codes(saved["validation"]["ready"])


def test_leaving_the_poll_format_drops_the_poll_and_moves_the_prefix(
    client: TestClient, exercise: dict
) -> None:
    payload = example_payload(exercise["msel"])
    _row(payload, "m12").update(format="poll", poll_question="Why?", poll_options=["A", "B"])
    saved = _put(client, exercise["ttx"]["id"], payload).json()

    code_of = {i["id"]: i["code"] for i in saved["injects"]}
    payload = _payload_from(saved)
    row = next(i for i in payload["injects"] if code_of[i["id"]] == "POL-13")
    row.update(format="discussion")
    saved = _put(client, exercise["ttx"]["id"], payload).json()

    inject = next(i for i in saved["injects"] if i["code"] == "DSC-13")
    assert inject["poll_question"] == "" and inject["poll_options"] == []


def test_a_snapshot_frozen_with_scored_reads_as_a_format() -> None:
    from app.models import InjectFormat
    from app.schemas.ttx_msel import InjectRead

    def frozen(**values) -> dict:
        return InjectRead._frozen_scoring(values)

    assert frozen(scored=False)["format"] == InjectFormat.DISCUSSION
    assert "format" not in frozen(scored=True)
    assert frozen(scored=False, format="poll")["format"] == "poll"


# -- deadlines, check minutes, unscored injects ------------------------------------


def test_an_unscored_inject_needs_no_objective_and_stays_out_of_the_eeg(
    client: TestClient, exercise: dict
) -> None:
    payload = example_payload(exercise["msel"])
    last = _row(payload, "m12")
    last.update(format="discussion", expected_actions=[])
    # Its objective is still sent: an unscored inject drops it.
    assert last["objective_ids"]

    saved = _put(client, exercise["ttx"]["id"], payload).json()

    # A discussion inject: its own prefix on the shared number series.
    inject = next(i for i in saved["injects"] if i["code"] == "DSC-13")
    assert inject["format"] == "discussion"
    assert inject["objective_ids"] == []
    codes = _codes(saved["validation"]["ready"])
    assert "INJECT_WITHOUT_OBJECTIVE" not in codes
    assert "INJECT_WITHOUT_EXPECTED_ACTION" not in codes
    eeg = client.get(f"/api/v1/ttx/{exercise['ttx']['id']}/eeg").json()
    listed = {a["inject_code"] for o in eeg["objectives"] for a in o["expected_actions"]}
    assert "DSC-13" not in listed


def test_switching_the_scoring_moves_the_prefix_and_rewrites_references(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    example = _saved_example(client, exercise)
    payload = _payload_from(example)
    target = next(i for i in payload["injects"] if i["expected_actions"])
    other = next(i for i in payload["injects"] if i["id"] != target["id"])
    code = next(i["code"] for i in example["injects"] if i["id"] == target["id"])
    number = code.removeprefix("INJ-")
    other["facilitator_notes"] = f"Follows {code} (see {code}-A1)."
    target.update(format="discussion", objective_ids=[])

    saved = _put(client, ttx_id, payload).json()

    by_id = {i["id"]: i for i in saved["injects"]}
    assert by_id[target["id"]]["code"] == f"DSC-{number}"
    assert by_id[target["id"]]["expected_actions"][0]["code"] == f"DSC-{number}-A1"
    assert by_id[other["id"]]["facilitator_notes"] == f"Follows DSC-{number} (see DSC-{number}-A1)."

    # Scored again: the same number, back under INJ.
    payload = _payload_from(saved)
    next(i for i in payload["injects"] if i["id"] == target["id"])["format"] = "inject"
    again = _put(client, ttx_id, payload).json()
    assert {i["id"]: i["code"] for i in again["injects"]}[target["id"]] == code


def test_check_minutes_and_phase_deadlines_round_trip_and_reach_the_eeg(
    client: TestClient, exercise: dict
) -> None:
    payload = example_payload(exercise["msel"])
    objective = payload["phases"][1]["objective_ids"][0]
    payload["phases"][1]["due_objective_ids"] = [objective, str(uuid.uuid4())]
    _row(payload, "c0").update(fires_at_minute=20)
    # A mandatory inject has no check minute.
    _row(payload, "m0").update(fires_at_minute=5)

    saved = _put(client, exercise["ttx"]["id"], payload).json()

    # Only an objective the phase works on can be due there.
    assert saved["phases"][1]["due_objective_ids"] == [objective]
    assert saved["phases"][0]["due_objective_ids"] == []
    by_code = {i["code"]: i for i in saved["injects"]}
    assert by_code["INJ-01"]["fires_at_minute"] is None
    assert next(i for i in saved["injects"] if i["kind"] == "contingent")["fires_at_minute"] == 20
    eeg = client.get(f"/api/v1/ttx/{exercise['ttx']['id']}/eeg").json()
    due = next(o for o in eeg["objectives"] if o["id"] == objective)["due_phases"]
    assert due == [{"code": "PH-02", "name": "Escalation", "end_offset": 90}]
