import io
import uuid
from datetime import UTC, datetime

import pyotp
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    TTX,
    RoleEnum,
    TTXAccess,
    TTXNeedsForm,
    TTXNeedsFormApproval,
    TTXNeedsFormEvidence,
    User,
)
from app.services import totp_service

YEAR = datetime.now(UTC).year


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada Manager"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _manager(client: TestClient, db_session: Session, email: str, org_name: str) -> dict:
    """Sign up an org (its founder is also an org Planner) with TOTP."""
    body = _signup(client, email, org_name)
    user = db_session.get(User, uuid.UUID(body["user"]["id"]))
    totp_service.store_secret(user, pyotp.random_base32())
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    return body


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _create_ttx(client: TestClient, org_id: str, name: str = "Drill", locale: str = "en") -> dict:
    response = client.post(
        "/api/v1/ttx",
        json={"name": name, "organization_id": org_id},
        headers={**_csrf(client), "Accept-Language": locale},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _url(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/needs-form{suffix}"


def _get(client: TestClient, ttx_id: str) -> dict:
    response = client.get(_url(ttx_id))
    assert response.status_code == 200, response.text
    return response.json()


def _complete_payload(form: dict) -> dict:
    """The sample form from the spec: ransomware with potential impact on a
    control centre -- complete, so it can reach APPROVED."""
    return {
        "revision": form["revision"],
        "tlp": "amber",
        "document_date": "2026-09-27",
        "design_lead": "Design Lead Example",
        "sponsor_name": "Sponsor Example",
        "sponsor_role": "Chief Operating Officer",
        "sponsor_motivation": "Prove we can make the NIS2 early-warning call under pressure.",
        "findings_closure_commitment": True,
        "findings_owner": "Head of Security",
        "aar_recipient": "crisis_committee",
        "aar_recipient_other": "",
        "triggers": ["regulatory", "pending_aar_actions"],
        "regulatory_frameworks": ["NIS2", "NCCS"],
        "trigger_other": "",
        "capabilities": [
            "crisis_decision_making",
            "regulatory_notification",
            "cross_unit_coordination",
        ],
        "levels": ["strategic", "tactical"],
        "participating_areas": ["Crisis Committee", "SOC", "OT Operations"],
        "third_parties": ["National CSIRT"],
        "perimeter": "Headquarters and the main control centre.",
        "out_of_scope": "Technical recovery of OT systems.",
        "date_window_start": "2026-11-02",
        "date_window_end": "2026-11-20",
        "max_duration_hours": 4,
        "key_participants_availability": "Committee members confirmed for two dates.",
        "confidentiality_restrictions": "",
        "budget_and_external_support": "",
        "stop_exercise_keyword": "BLUE SKY",
        "needs": [
            {
                "key": "n1",
                "source": "previous_aar",
                "title": "Slow early-warning decision",
                "finding": "Last AAR: the early-warning decision took three hours.",
                "affected_capability": "regulatory_notification",
                "priority": "high",
            },
            {
                "key": "n2",
                "source": "risk_analysis",
                "title": "Control-centre isolation criterion",
                "finding": "No agreed criterion for isolating the control centre.",
                "affected_capability": "cross_unit_coordination",
                "priority": "high",
            },
            {
                "key": "n3",
                "source": "regulatory",
                "title": "Untested crisis committee",
                "finding": "Crisis committee never exercised under NCCS.",
                "affected_capability": "crisis_decision_making",
                "priority": "medium",
            },
        ],
        "objectives": [
            {
                "title": "NIS2 early-warning decision",
                "statement": "The committee decides whether an NIS2 early warning is due "
                "within 60 minutes of exercise time.",
                "capability": "regulatory_notification",
                "linked_need_keys": ["n1"],
                "success_criterion": "Documented decision with its rationale in 60 minutes.",
                "evidence": "Minutes and timeline.",
                "regulatory_requirement_ids": ["NIS2-23"],
            },
            {
                "title": "Control-centre isolation",
                "statement": "IT and OT agree whether to isolate the control centre.",
                "capability": "cross_unit_coordination",
                "linked_need_keys": ["n2"],
                "success_criterion": "Isolation decision logged within 45 minutes.",
                "evidence": "Decision log.",
                "regulatory_requirement_ids": ["NCCS-CRISIS"],
            },
            {
                "title": "Crisis committee takes command",
                "statement": "The crisis committee is convened and takes command.",
                "capability": "crisis_decision_making",
                "linked_need_keys": ["n3"],
                "success_criterion": "Committee convened within 30 minutes.",
                "evidence": "Call log and minutes.",
                "regulatory_requirement_ids": ["NIS2-21-2-C"],
            },
        ],
        "risks": [
            {
                "id": risk["id"],
                "risk": risk["risk"],
                "mitigation": risk["mitigation"],
                "owner": "",
            }
            for risk in form["risks"]
        ],
    }


def _payload_from(form: dict, **changes) -> dict:
    """A save payload that keeps a saved form exactly as it is."""
    payload = {
        key: form[key]
        for key in (
            "revision",
            "tlp",
            "document_date",
            "design_lead",
            "sponsor_name",
            "sponsor_role",
            "sponsor_motivation",
            "findings_closure_commitment",
            "findings_owner",
            "aar_recipient",
            "aar_recipient_other",
            "triggers",
            "regulatory_frameworks",
            "regulatory_framework_other",
            "trigger_other",
            "capabilities",
            "levels",
            "participating_areas",
            "third_parties",
            "perimeter",
            "out_of_scope",
            "date_window_start",
            "date_window_end",
            "max_duration_hours",
            "key_participants_availability",
            "confidentiality_restrictions",
            "budget_and_external_support",
            "stop_exercise_keyword",
        )
    }
    payload["needs"] = [
        {
            "id": need["id"],
            # Saved rows are named by their id.
            "key": need["id"],
            **{
                k: need[k]
                for k in ("source", "title", "finding", "affected_capability", "priority")
            },
        }
        for need in form["needs"]
    ]
    payload["objectives"] = [
        {
            **{k: v for k, v in objective.items() if k not in ("code", "linked_need_ids")},
            "key": objective["id"],
            "linked_need_keys": objective["linked_need_ids"],
        }
        for objective in form["objectives"]
    ]
    payload["risks"] = [
        {k: risk[k] for k in ("id", "risk", "mitigation", "owner")} for risk in form["risks"]
    ]
    payload.update(changes)
    return payload


def _left_out_of_scenarios(form: dict) -> dict:
    """What a scenario never carries (people, dates), filled in -- all a
    Planner has to add before the approval."""
    return _payload_from(
        form,
        document_date="2026-09-27",
        design_lead="Design Lead Example",
        sponsor_name="Sponsor Example",
        sponsor_role="Chief Operating Officer",
        sponsor_motivation="Prove the crisis committee decides in time.",
        findings_closure_commitment=True,
        findings_owner="Head of Security",
        aar_recipient="crisis_committee",
        date_window_start="2026-11-02",
        date_window_end="2026-11-20",
        key_participants_availability="Committee members confirmed for two dates.",
    )


def _save(client: TestClient, ttx_id: str, payload: dict):
    return client.put(_url(ttx_id), json=payload, headers=_csrf(client))


def _transition(client: TestClient, ttx_id: str, to: str):
    return client.post(_url(ttx_id, "/transitions"), json={"to": to}, headers=_csrf(client))


def _approve(client: TestClient, ttx_id: str, kind: str):
    return client.post(
        _url(ttx_id, "/approvals"),
        json={
            "approver_kind": kind,
            "approver_name": f"{kind} example",
            "approver_role": "Role",
            "approved_on": "2026-09-27",
        },
        headers=_csrf(client),
    )


def _to_approved(client: TestClient, ttx_id: str) -> dict:
    saved = _save(client, ttx_id, _complete_payload(_get(client, ttx_id)))
    assert saved.status_code == 200, saved.text
    assert _transition(client, ttx_id, "ready_for_approval").status_code == 200
    assert _approve(client, ttx_id, "sponsor").status_code == 201
    assert _approve(client, ttx_id, "design_lead").status_code == 201
    approved = _transition(client, ttx_id, "approved")
    assert approved.status_code == 200, approved.text
    return approved.json()


def _codes(report: list[dict]) -> set[str]:
    return {issue["code"] for issue in report}


# -- creation, codes, defaults ---------------------------------------------


def test_new_exercise_gets_a_sequential_code_and_a_draft_form(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    org_id = owner["organization"]["id"]

    first = _create_ttx(client, org_id, "First")
    second = _create_ttx(client, org_id, "Second", locale="es")

    assert first["code"] == f"TTX-{YEAR}-01"
    assert second["code"] == f"TTX-{YEAR}-02"
    assert first["needs_form_status"] == "draft"
    assert first["tlp"] == "amber"

    form = _get(client, second["id"])
    assert form["exercise_code"] == f"TTX-{YEAR}-02"
    assert form["version"] == 1
    assert form["design_lead"] == "Ada Manager"
    # The three default risks, in the creator's language.
    assert [risk["risk"] for risk in form["risks"]] == [
        "Filtración del escenario",
        "Ausencia de asistentes imprescindibles",
        "Coincidencia con un incidente real",
    ]
    listed = client.get(f"/api/v1/ttx?organization_id={org_id}").json()["items"]
    assert {item["code"] for item in listed} == {f"TTX-{YEAR}-01", f"TTX-{YEAR}-02"}


def test_codes_are_numbered_per_organization(client: TestClient, db_session: Session) -> None:
    first_org = _manager(client, db_session, "a@acme.com", "Acme")
    _create_ttx(client, first_org["organization"]["id"])
    client.cookies.clear()
    second_org = _manager(client, db_session, "b@globex.com", "Globex")

    assert _create_ttx(client, second_org["organization"]["id"])["code"] == f"TTX-{YEAR}-01"


def test_every_ttx_gets_a_form_even_when_created_outside_the_api(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    ttx = TTX(
        name="Seeded",
        organization_id=uuid.UUID(owner["organization"]["id"]),
        created_by_id=uuid.UUID(owner["user"]["id"]),
    )
    db_session.add(ttx)
    db_session.commit()

    form = db_session.exec(select(TTXNeedsForm).where(TTXNeedsForm.ttx_id == ttx.id)).one()
    assert ttx.code == f"TTX-{YEAR}-01"
    assert form.status == "draft"


# -- access ------------------------------------------------------------------


def test_player_cannot_read_or_write_the_form(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    player = User(
        email="p@acme.com", hashed_password=hash_password("Correcthorse123!"), full_name="P"
    )
    db_session.add(player)
    db_session.commit()
    db_session.add(TTXAccess(user_id=player.id, ttx_id=uuid.UUID(ttx["id"]), role=RoleEnum.PLAYER))
    db_session.commit()

    client.cookies.clear()
    client.post("/api/v1/auth/login", json={"email": "p@acme.com", "password": "Correcthorse123!"})

    assert client.get(_url(ttx["id"])).status_code == 403
    assert _transition(client, ttx["id"], "ready_for_approval").status_code == 403


def test_manager_of_another_organization_is_denied(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    client.cookies.clear()
    _manager(client, db_session, "other@globex.com", "Globex")

    response = client.get(_url(ttx["id"]))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "TTX_ACCESS_DENIED"


def test_program_manager_of_the_organization_can_read_the_form(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    user = db_session.get(User, uuid.UUID(owner["user"]["id"]))
    user.totp_enabled = True
    db_session.add(user)
    ttx = TTX(
        name="Other manager's drill",
        organization_id=uuid.UUID(owner["organization"]["id"]),
        created_by_id=user.id,
    )
    db_session.add(ttx)
    db_session.commit()

    assert client.get(_url(str(ttx.id))).status_code == 200


# -- lifecycle ---------------------------------------------------------------


def test_the_sample_form_reaches_approved(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    approved = _to_approved(client, ttx["id"])

    assert approved["status"] == "approved"
    assert approved["validation"] == {"ready": [], "approved": [], "warnings": []}
    assert [need["code"] for need in approved["needs"]] == ["NEED-01", "NEED-02", "NEED-03"]
    assert [o["code"] for o in approved["objectives"]] == ["OBJ-01", "OBJ-02", "OBJ-03"]
    listed = client.get(f"/api/v1/ttx?organization_id={owner['organization']['id']}").json()
    assert listed["items"][0]["needs_form_status"] == "approved"


def test_the_msel_is_gated_until_the_form_is_approved(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    blocked = client.get(f"/api/v1/ttx/{ttx['id']}/msel")
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "NEEDS_FORM_NOT_APPROVED"

    _to_approved(client, ttx["id"])
    assert client.get(f"/api/v1/ttx/{ttx['id']}/msel").status_code == 200


def test_editing_an_approved_form_withdraws_approval_and_opens_a_new_version(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    approved = _to_approved(client, ttx["id"])

    payload = _complete_payload(approved)
    payload["sponsor_motivation"] = "Changed after approval."
    edited = _save(client, ttx["id"], payload).json()

    assert edited["status"] == "draft"
    assert edited["version"] == 2
    # Version 1's approvals stay as history; version 2 has none yet.
    assert {a["version"] for a in edited["approvals"]} == {1}
    assert _codes(edited["validation"]["approved"]) == {"APPROVALS_MISSING"}


def test_editing_a_ready_form_drops_the_approvals_recorded_for_it(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _save(client, ttx["id"], _complete_payload(_get(client, ttx["id"])))
    _transition(client, ttx["id"], "ready_for_approval")
    ready = _approve(client, ttx["id"], "sponsor").json()

    edited = _save(client, ttx["id"], _complete_payload(ready)).json()

    assert edited["status"] == "draft"
    assert edited["version"] == 1
    assert edited["approvals"] == []


def test_a_stale_revision_is_rejected(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    form = _get(client, ttx["id"])
    assert _save(client, ttx["id"], _complete_payload(form)).status_code == 200

    stale = _save(client, ttx["id"], _complete_payload(form))

    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "NEEDS_FORM_STALE"


def test_rows_keep_their_ids_and_codes_are_never_reused(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    saved = _save(client, ttx["id"], _complete_payload(_get(client, ttx["id"]))).json()
    first_objective = saved["objectives"][0]

    # Drop NEED-03 and OBJ-03, keep the rest by id, add one new need.
    payload = _complete_payload(saved)
    kept_needs = saved["needs"][:2]
    payload["needs"] = [
        {**{k: need[k] for k in ("id", "source", "finding", "affected_capability", "priority")},
         "key": need["id"]}
        for need in kept_needs
    ] + [
        {
            "key": "new",
            "source": "threat_intel",
            "title": "Sector ransomware campaign",
            "finding": "New ransomware campaign in the sector.",
            "affected_capability": "crisis_decision_making",
            "priority": "low",
        }
    ]  # fmt: skip
    payload["objectives"] = [
        {**objective, "id": saved_objective["id"], "linked_need_keys": [need["id"]]}
        for objective, saved_objective, need in zip(
            payload["objectives"][:2], saved["objectives"][:2], kept_needs, strict=True
        )
    ]
    payload["capabilities"] = ["regulatory_notification", "cross_unit_coordination"]
    payload["revision"] = saved["revision"]
    resaved = _save(client, ttx["id"], payload)

    assert resaved.status_code == 200, resaved.text
    body = resaved.json()
    assert [need["code"] for need in body["needs"]] == ["NEED-01", "NEED-02", "NEED-04"]
    assert body["objectives"][0]["id"] == first_objective["id"]
    assert [o["code"] for o in body["objectives"]] == ["OBJ-01", "OBJ-02"]


def test_approvals_are_recorded_only_while_ready(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    response = _approve(client, ttx["id"], "sponsor")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "NEEDS_FORM_NOT_READY"


def test_recording_an_approval_again_replaces_it(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _save(client, ttx["id"], _complete_payload(_get(client, ttx["id"])))
    _transition(client, ttx["id"], "ready_for_approval")
    _approve(client, ttx["id"], "sponsor")
    body = _approve(client, ttx["id"], "sponsor").json()

    assert len(body["approvals"]) == 1
    approval_id = body["approvals"][0]["id"]
    removed = client.delete(_url(ttx["id"], f"/approvals/{approval_id}"), headers=_csrf(client))
    assert removed.status_code == 200
    assert removed.json()["approvals"] == []
    assert db_session.exec(select(TTXNeedsFormApproval)).all() == []


def test_a_draft_cannot_jump_straight_to_approved(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    response = _transition(client, ttx["id"], "approved")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_TRANSITION"


def test_an_approved_form_can_be_reopened_as_a_new_draft(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])

    reopened = _transition(client, ttx["id"], "draft").json()

    assert reopened["status"] == "draft"
    assert reopened["version"] == 2


# -- validation rules --------------------------------------------------------


def test_a_blank_form_reports_every_problem_at_once(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    report = _get(client, ttx["id"])["validation"]
    incomplete = {
        (issue["section"], issue["field"])
        for issue in report["ready"]
        if issue["code"] == "NEEDS_FORM_INCOMPLETE"
    }

    # V11 -- one entry per missing field, across sections.
    assert {(1, "sponsor_name"), (2, "triggers"), (3, "needs"), (5, "objectives")} <= incomplete
    assert {(7, "date_window_start"), (8, "stop_exercise_keyword")} <= incomplete
    assert "OUT_OF_SCOPE_REQUIRED" in _codes(report["ready"])  # V07
    assert _codes(report["approved"]) == {"FINDINGS_COMMITMENT_REQUIRED", "APPROVALS_MISSING"}

    blocked = _transition(client, ttx["id"], "ready_for_approval")
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "NEEDS_FORM_INVALID"


def _saved_with(client: TestClient, db_session: Session, **changes) -> tuple[dict, object]:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    payload = _complete_payload(_get(client, ttx["id"]))
    for key, value in changes.items():
        if callable(value):
            value(payload)
        else:
            payload[key] = value
    return ttx, _save(client, ttx["id"], payload)


def test_v01_limits_capabilities_and_objectives(client: TestClient, db_session: Session) -> None:
    _, response = _saved_with(
        client,
        db_session,
        capabilities=[
            "crisis_decision_making",
            "regulatory_notification",
            "cross_unit_coordination",
            "legal_forensics",
            "continuity_recovery",
        ],
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "NEEDS_FORM_LIMIT"


def test_v01_accepts_four_capabilities(client: TestClient, db_session: Session) -> None:
    _, response = _saved_with(
        client,
        db_session,
        capabilities=[
            "crisis_decision_making",
            "regulatory_notification",
            "cross_unit_coordination",
            "legal_forensics",
        ],
    )
    assert response.status_code == 200


def test_v02_objective_needs_a_linked_need(client: TestClient, db_session: Session) -> None:
    def unlink(payload: dict) -> None:
        payload["objectives"][0]["linked_need_keys"] = []

    _, response = _saved_with(client, db_session, objectives=unlink)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "OBJECTIVE_WITHOUT_NEED"


def test_v03_objective_needs_criterion_and_evidence(
    client: TestClient, db_session: Session
) -> None:
    def blank_evidence(payload: dict) -> None:
        payload["objectives"][1]["evidence"] = " "

    ttx, response = _saved_with(client, db_session, objectives=blank_evidence)
    assert response.status_code == 200
    issues = response.json()["validation"]["ready"]
    assert [(i["code"], i["field"]) for i in issues] == [("OBJECTIVE_NOT_MEASURABLE", "evidence")]
    assert issues[0]["item_id"] == response.json()["objectives"][1]["id"]


def test_v04_objective_capability_must_be_selected(client: TestClient, db_session: Session) -> None:
    def other_capability(payload: dict) -> None:
        payload["objectives"][0]["capability"] = "legal_forensics"

    _, response = _saved_with(client, db_session, objectives=other_capability)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "OBJECTIVE_CAPABILITY_NOT_SELECTED"


def test_v05_every_capability_needs_an_objective(client: TestClient, db_session: Session) -> None:
    def add_capability(payload: dict) -> None:
        payload["capabilities"] = [*payload["capabilities"], "legal_forensics"]

    _, response = _saved_with(client, db_session, capabilities=add_capability)
    issues = response.json()["validation"]["ready"]
    assert [(i["code"], i["section"], i["item_id"]) for i in issues] == [
        ("CAPABILITY_WITHOUT_OBJECTIVE", 5, "legal_forensics")
    ]


def test_v06_orphan_high_need_is_only_a_warning(client: TestClient, db_session: Session) -> None:
    def orphan(payload: dict) -> None:
        payload["needs"].append(
            {
                "key": "n4",
                "source": "incident_history",
                "title": "Phishing near miss",
                "finding": "Phishing near miss last spring.",
                "affected_capability": "crisis_decision_making",
                "priority": "high",
            }
        )

    _, response = _saved_with(client, db_session, needs=orphan)
    report = response.json()["validation"]
    assert report["ready"] == []
    assert _codes(report["warnings"]) == {"HIGH_NEED_WITHOUT_OBJECTIVE"}


def test_v07_out_of_scope_is_required(client: TestClient, db_session: Session) -> None:
    _, response = _saved_with(client, db_session, out_of_scope="")
    assert _codes(response.json()["validation"]["ready"]) == {"OUT_OF_SCOPE_REQUIRED"}


def test_v08_findings_commitment_is_required_to_approve(
    client: TestClient, db_session: Session
) -> None:
    ttx, response = _saved_with(client, db_session, findings_closure_commitment=False)
    report = response.json()["validation"]
    assert report["ready"] == []
    assert "FINDINGS_COMMITMENT_REQUIRED" in _codes(report["approved"])

    assert _transition(client, ttx["id"], "ready_for_approval").status_code == 200
    _approve(client, ttx["id"], "sponsor")
    _approve(client, ttx["id"], "design_lead")
    assert _transition(client, ttx["id"], "approved").status_code == 409


def test_v09_sponsor_and_design_lead_must_approve(client: TestClient, db_session: Session) -> None:
    ttx, _ = _saved_with(client, db_session)
    _transition(client, ttx["id"], "ready_for_approval")
    body = _approve(client, ttx["id"], "sponsor").json()

    assert [(i["code"], i["item_id"]) for i in body["validation"]["approved"]] == [
        ("APPROVALS_MISSING", "design_lead")
    ]
    assert _transition(client, ttx["id"], "approved").status_code == 409


def test_v10_regulatory_trigger_needs_a_regulatory_objective(
    client: TestClient, db_session: Session
) -> None:
    def no_requirements(payload: dict) -> None:
        for objective in payload["objectives"]:
            objective["regulatory_requirement_ids"] = []

    _, response = _saved_with(client, db_session, objectives=no_requirements)
    assert _codes(response.json()["validation"]["ready"]) == {"REGULATORY_OBJECTIVE_REQUIRED"}


def test_other_regulation_needs_its_description(client: TestClient, db_session: Session) -> None:
    ttx, response = _saved_with(client, db_session, regulatory_frameworks=["NIS2", "OTHER"])
    issues = response.json()["validation"]["ready"]
    assert [(i["code"], i["field"]) for i in issues] == [
        ("NEEDS_FORM_INCOMPLETE", "regulatory_framework_other")
    ]

    payload = _complete_payload(response.json())
    payload["regulatory_frameworks"] = ["NIS2", "OTHER"]
    payload["regulatory_framework_other"] = "Ley 8/2011 PIC"
    response = _save(client, ttx["id"], payload)
    assert response.json()["validation"]["ready"] == []
    assert response.json()["regulatory_framework_other"] == "Ley 8/2011 PIC"


def test_v10_is_only_a_warning_when_the_regulation_is_other(
    client: TestClient, db_session: Session
) -> None:
    def only_other(payload: dict) -> None:
        payload["regulatory_frameworks"] = ["OTHER"]
        payload["regulatory_framework_other"] = "Ley 8/2011 PIC"
        for objective in payload["objectives"]:
            objective["regulatory_requirement_ids"] = []

    _, response = _saved_with(client, db_session, objectives=only_other)
    validation = response.json()["validation"]
    assert validation["ready"] == []
    assert "REGULATORY_OBJECTIVE_SUGGESTED" in _codes(validation["warnings"])


def test_unknown_regulation_is_rejected(client: TestClient, db_session: Session) -> None:
    _, response = _saved_with(client, db_session, regulatory_frameworks=["CRA"])
    assert response.status_code == 422


def test_v10_does_not_apply_without_a_regulatory_trigger(
    client: TestClient, db_session: Session
) -> None:
    def no_requirements(payload: dict) -> None:
        payload["triggers"] = ["pending_aar_actions"]
        payload["regulatory_frameworks"] = []
        for objective in payload["objectives"]:
            objective["regulatory_requirement_ids"] = []

    _, response = _saved_with(client, db_session, triggers=no_requirements)
    assert response.json()["validation"]["ready"] == []


def test_vague_success_criterion_warns_in_both_languages(
    client: TestClient, db_session: Session
) -> None:
    def vague(payload: dict) -> None:
        payload["objectives"][0]["success_criterion"] = "The committee reacts properly."
        payload["objectives"][1]["success_criterion"] = "El comité decide bien."

    _, response = _saved_with(client, db_session, objectives=vague)
    warnings = response.json()["validation"]["warnings"]
    assert [w["code"] for w in warnings] == ["VAGUE_SUCCESS_CRITERION"] * 2


def test_unknown_regulatory_requirement_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    def unknown(payload: dict) -> None:
        payload["objectives"][0]["regulatory_requirement_ids"] = ["NIS2-99"]

    _, response = _saved_with(client, db_session, objectives=unknown)
    assert response.status_code == 422


def test_regulatory_catalog_is_served(client: TestClient, db_session: Session) -> None:
    _manager(client, db_session, "owner@acme.com", "Acme")

    body = client.get("/api/v1/regulatory-requirements").json()

    assert "NIS2-23" in {item["id"] for item in body["items"]}
    frameworks = [f["id"] for f in body["frameworks"]]
    assert frameworks == [
        "NIS2", "GDPR", "CER", "DORA", "NCCS", "ENS",
        "UK_NIS", "UK_OPRES", "SEC", "NYDFS_500", "HIPAA", "PCI_DSS",
    ]  # fmt: skip
    # OTHER is implied (free text), never a catalog entry.
    assert "OTHER" not in frameworks
    gdpr = next(f for f in body["frameworks"] if f["id"] == "GDPR")
    assert (gdpr["label_en"], gdpr["label_es"]) == ("GDPR / UK GDPR", "RGPD / UK GDPR")
    assert gdpr["rationale_reference"] == "Arts. 32.1.d, 33–34"
    pci = next(f for f in body["frameworks"] if f["id"] == "PCI_DSS")
    assert (pci["binding"], pci["requires_exercises"]) == (False, True)
    # Every regulation-backed requirement points at a framework id.
    ids = set(frameworks)
    assert all(
        item["framework"] in ids or item["framework"].startswith("ISO") for item in body["items"]
    )


def test_deleting_the_organization_removes_its_forms(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    org_id = owner["organization"]["id"]
    ttx = _create_ttx(client, org_id)
    _to_approved(client, ttx["id"])

    response = client.request(
        "DELETE",
        f"/api/v1/organizations/{org_id}",
        json={"confirmation": "Acme"},
        headers=_csrf(client),
    )

    assert response.status_code == 204, response.text
    assert db_session.exec(select(TTXNeedsForm)).all() == []


# -- dry-run validation --------------------------------------------------------


def _validate(client: TestClient, ttx_id: str, payload: dict):
    return client.post(_url(ttx_id, "/validate"), json=payload, headers=_csrf(client))


def test_dry_run_reports_without_saving(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    before = _get(client, ttx["id"])

    response = _validate(client, ttx["id"], _complete_payload(before))

    assert response.status_code == 200
    assert response.json()["ready"] == []
    assert response.json()["warnings"] == []
    assert _codes(response.json()["approved"]) == {"APPROVALS_MISSING"}
    after = _get(client, ttx["id"])
    assert after["revision"] == before["revision"]
    assert after["needs"] == []


def test_dry_run_names_unsaved_rows_by_their_key(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    payload = _complete_payload(_get(client, ttx["id"]))
    payload["objectives"][0]["key"] = "new-1"
    payload["objectives"][0]["evidence"] = ""
    payload["needs"].append(
        {
            "key": "new-need",
            "source": "threat_intel",
            "title": "New campaign",
            "finding": "New campaign.",
            "affected_capability": "crisis_decision_making",
            "priority": "high",
        }
    )

    report = _validate(client, ttx["id"], payload).json()

    assert [(i["code"], i["item_id"]) for i in report["ready"]] == [
        ("OBJECTIVE_NOT_MEASURABLE", "new-1")
    ]
    assert [(i["code"], i["item_id"]) for i in report["warnings"]] == [
        ("HIGH_NEED_WITHOUT_OBJECTIVE", "new-need")
    ]


def test_dry_run_reports_what_would_block_the_save(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    payload = _complete_payload(_get(client, ttx["id"]))
    payload["objectives"][0]["key"] = "o1"
    payload["objectives"][0]["linked_need_keys"] = []
    payload["objectives"][1]["key"] = "o2"
    payload["objectives"][1]["capability"] = "legal_forensics"

    report = _validate(client, ttx["id"], payload).json()

    assert {(i["code"], i["item_id"]) for i in report["ready"]} >= {
        ("OBJECTIVE_WITHOUT_NEED", "o1"),
        ("OBJECTIVE_CAPABILITY_NOT_SELECTED", "o2"),
    }


def test_player_cannot_dry_run(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    payload = _complete_payload(_get(client, ttx["id"]))
    player = User(
        email="p@acme.com", hashed_password=hash_password("Correcthorse123!"), full_name="P"
    )
    db_session.add(player)
    db_session.commit()
    db_session.add(TTXAccess(user_id=player.id, ttx_id=uuid.UUID(ttx["id"]), role=RoleEnum.PLAYER))
    db_session.commit()
    client.cookies.clear()
    client.post("/api/v1/auth/login", json={"email": "p@acme.com", "password": "Correcthorse123!"})

    assert _validate(client, ttx["id"], payload).status_code == 403


# -- approval evidence -----------------------------------------------------------

PDF = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"


@pytest.fixture
def evidence_dir(tmp_path, monkeypatch):
    from app.services import ttx_needs_form_evidence_service

    monkeypatch.setattr(ttx_needs_form_evidence_service, "EVIDENCE_DIR", tmp_path)
    return tmp_path


def _ready_with_sponsor(client: TestClient, db_session: Session) -> tuple[dict, dict]:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _save(client, ttx["id"], _complete_payload(_get(client, ttx["id"])))
    _transition(client, ttx["id"], "ready_for_approval")
    form = _approve(client, ttx["id"], "sponsor").json()
    return ttx, form["approvals"][0]


def _upload(client: TestClient, ttx_id: str, approval_id: str, name: str, content: bytes):
    return client.post(
        _url(ttx_id, f"/approvals/{approval_id}/evidence"),
        files={"file": (name, content, "application/octet-stream")},
        headers=_csrf(client),
    )


def test_evidence_is_attached_and_downloaded_as_an_attachment(
    client: TestClient, db_session: Session, evidence_dir
) -> None:
    ttx, approval = _ready_with_sponsor(client, db_session)

    response = _upload(client, ttx["id"], approval["id"], "signed approval.pdf", PDF)

    assert response.status_code == 201, response.text
    evidence = response.json()["approvals"][0]["evidence"]
    assert [(e["filename"], e["content_type"], e["size_bytes"]) for e in evidence] == [
        ("signed approval.pdf", "application/pdf", len(PDF))
    ]
    assert len(list(evidence_dir.iterdir())) == 1

    download = client.get(
        _url(ttx["id"], f"/approvals/{approval['id']}/evidence/{evidence[0]['id']}")
    )
    assert download.status_code == 200
    assert download.content == PDF
    assert download.headers["content-type"] == "application/pdf"
    assert download.headers["content-disposition"].startswith("attachment")
    assert download.headers["cache-control"] == "private, no-store"


def test_evidence_must_match_its_extension(
    client: TestClient, db_session: Session, evidence_dir
) -> None:
    ttx, approval = _ready_with_sponsor(client, db_session)

    disguised = _upload(client, ttx["id"], approval["id"], "approval.pdf", b"<html>not a pdf")
    unknown = _upload(client, ttx["id"], approval["id"], "script.exe", b"MZ\x90\x00")

    assert disguised.status_code == 422
    assert disguised.json()["error"]["code"] == "EVIDENCE_FILE_TYPE"
    assert unknown.status_code == 422
    assert list(evidence_dir.iterdir()) == []


def test_evidence_can_be_added_after_approval_but_not_removed(
    client: TestClient, db_session: Session, evidence_dir
) -> None:
    ttx, _ = _ready_with_sponsor(client, db_session)
    _approve(client, ttx["id"], "design_lead")
    approved = _transition(client, ttx["id"], "approved").json()
    approval = approved["approvals"][0]

    added = _upload(client, ttx["id"], approval["id"], "email.eml", b"From: sponsor\n\nApproved.")
    assert added.status_code == 201
    evidence_id = next(a for a in added.json()["approvals"] if a["id"] == approval["id"])[
        "evidence"
    ][0]["id"]

    removed = client.delete(
        _url(ttx["id"], f"/approvals/{approval['id']}/evidence/{evidence_id}"),
        headers=_csrf(client),
    )
    assert removed.status_code == 409


def test_evidence_files_go_with_their_approval(
    client: TestClient, db_session: Session, evidence_dir
) -> None:
    ttx, approval = _ready_with_sponsor(client, db_session)
    _upload(client, ttx["id"], approval["id"], "scan.png", b"\x89PNG\r\n\x1a\n" + b"0" * 10)

    # Correcting the approval keeps its evidence...
    corrected = _approve(client, ttx["id"], "sponsor").json()
    assert len(corrected["approvals"][0]["evidence"]) == 1

    # ...removing it deletes the evidence rows and files.
    client.delete(_url(ttx["id"], f"/approvals/{approval['id']}"), headers=_csrf(client))
    assert db_session.exec(select(TTXNeedsFormEvidence)).all() == []
    assert list(evidence_dir.iterdir()) == []


def test_evidence_limits(
    client: TestClient, db_session: Session, evidence_dir, monkeypatch
) -> None:
    from app.core.config import settings as app_settings

    monkeypatch.setattr(app_settings, "NEEDS_EVIDENCE_MAX_FILES_PER_APPROVAL", 1)
    monkeypatch.setattr(app_settings, "NEEDS_EVIDENCE_MAX_BYTES", 64)
    ttx, approval = _ready_with_sponsor(client, db_session)

    too_big = _upload(client, ttx["id"], approval["id"], "big.pdf", PDF + b"0" * 64)
    first = _upload(client, ttx["id"], approval["id"], "a.pdf", PDF)
    second = _upload(client, ttx["id"], approval["id"], "b.pdf", PDF)

    assert too_big.status_code == 413
    assert first.status_code == 201
    assert second.status_code == 409


def test_a_draft_form_takes_no_evidence(
    client: TestClient, db_session: Session, evidence_dir
) -> None:
    ttx, approval = _ready_with_sponsor(client, db_session)
    _transition(client, ttx["id"], "draft")

    response = _upload(client, ttx["id"], approval["id"], "a.pdf", PDF)

    # Back to draft dropped this version's approvals (and would have taken
    # any evidence with them).
    assert response.status_code in (404, 409)


# -- PDF export ----------------------------------------------------------------


def test_pdf_export_in_the_callers_language(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    payload = _complete_payload(_get(client, ttx["id"]))
    # Markup in user text must be printed, not interpreted by reportlab.
    payload["sponsor_motivation"] = "<img src='/etc/passwd'/> <b>bold?</b> & more"
    _save(client, ttx["id"], payload)

    response = client.get(_url(ttx["id"], "/pdf?lang=es"), headers={"Accept-Language": "en"})

    assert response.status_code == 200, response.text
    assert response.content.startswith(b"%PDF-")
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["content-disposition"] == (
        f'attachment; filename="{ttx["code"]}_v1_AMBER.pdf"'
    )


def test_pdf_explains_why_each_regulation_is_worth_a_tabletop(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    payload = _complete_payload(_get(client, ttx["id"]))
    payload["regulatory_frameworks"] = ["GDPR", "SEC", "OTHER"]
    payload["regulatory_framework_other"] = "Ley 8/2011 PIC"
    _save(client, ttx["id"], payload)

    response = client.get(_url(ttx["id"], "/pdf?lang=es"))

    assert response.status_code == 200, response.text
    reader = PdfReader(io.BytesIO(response.content))
    text = " ".join(" ".join(page.extract_text() for page in reader.pages).split())
    assert "RGPD / UK GDPR, SEC, Ley 8/2011 PIC" in text
    assert "Por qué entrenarla con un ejercicio de tabletop" in text
    assert "Form 8-K Item 1.05" in text
    assert "NYDFS" not in text
    # Coded rows: code first, then title -- linked needs as "NEED-01 | …",
    # never a bare code list.
    assert "NEED-01 | " in text
    assert "NEED-01, NEED-02" not in text


def test_an_incomplete_needs_analysis_exports_as_a_marked_draft(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    response = client.get(_url(ttx["id"], "/pdf?lang=es"))

    # Readable for review, never mistaken for what the approvers sign.
    assert response.status_code == 200, response.text
    assert response.headers["content-disposition"] == (
        f'attachment; filename="{ttx["code"]}_v1_DRAFT_AMBER.pdf"'
    )
    reader = PdfReader(io.BytesIO(response.content))
    pages = [" ".join(page.extract_text().split()) for page in reader.pages]
    assert all("BORRADOR – NO VÁLIDO PARA APROBACIÓN" in page for page in pages)
    assert "Borrador para revisión: faltan" in pages[0]


def test_markdown_export_mirrors_the_pdf_and_escapes_user_text(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    payload = _complete_payload(_get(client, ttx["id"]))
    payload["sponsor_motivation"] = "<script>x</script> **bold** | [link](http://x.example)"
    payload["regulatory_frameworks"] = ["GDPR"]
    _save(client, ttx["id"], payload)

    response = client.get(_url(ttx["id"], "/export.md?lang=es"))

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "text/markdown; charset=utf-8"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["content-disposition"] == (
        f'attachment; filename="{ttx["code"]}_v1_AMBER.md"'
    )
    text = response.text
    # The TLP opens and closes it; the sections and copy are the PDF's.
    assert text.startswith("**TLP:AMBER**") and text.rstrip().endswith("**TLP:AMBER**")
    assert "# Análisis de necesidades" in text
    assert "## 5. Objetivos SMART" in text
    assert "### **OBJ-01** · " in text
    assert "Por qué entrenarla con un ejercicio de tabletop" in text
    # User text can't become HTML, emphasis, a link or a table cell break.
    assert "\\<script\\>x\\</script\\> \\*\\*bold\\*\\* \\| \\[link\\](http://x.example)" in text
    assert "<script>" not in text


def test_an_incomplete_markdown_export_is_a_marked_draft(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    response = client.get(_url(ttx["id"], "/export.md?lang=en"))

    assert response.headers["content-disposition"] == (
        f'attachment; filename="{ttx["code"]}_v1_DRAFT_AMBER.md"'
    )
    assert "> **DRAFT – NOT VALID FOR APPROVAL**" in response.text


def test_player_cannot_export_the_pdf(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    player = User(
        email="p@acme.com", hashed_password=hash_password("Correcthorse123!"), full_name="P"
    )
    db_session.add(player)
    db_session.commit()
    db_session.add(TTXAccess(user_id=player.id, ttx_id=uuid.UUID(ttx["id"]), role=RoleEnum.PLAYER))
    db_session.commit()
    client.cookies.clear()
    client.post("/api/v1/auth/login", json={"email": "p@acme.com", "password": "Correcthorse123!"})

    assert client.get(_url(ttx["id"], "/pdf")).status_code == 403


def test_a_need_is_named_by_its_title(client: TestClient, db_session: Session) -> None:
    def untitled(payload: dict) -> None:
        payload["needs"][1]["title"] = ""

    _, response = _saved_with(client, db_session, needs=untitled)
    body = response.json()
    assert body["needs"][0]["title"] == "Slow early-warning decision"
    missing = [i for i in body["validation"]["ready"] if i["code"] == "NEEDS_FORM_INCOMPLETE"]
    assert [(i["field"], i["item_id"]) for i in missing] == [("title", body["needs"][1]["id"])]
