"""Evaluator role: granted in the organization by a Program Manager,
assigned to the exercise by its Planners, reads the EEG of an approved
needs analysis, and reaches nothing of the design."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.security import hash_password
from app.models import RoleEnum, TTXAccess, User
from tests.test_ttx_needs_form import (
    _complete_payload,
    _create_ttx,
    _csrf,
    _get,
    _manager,
    _save,
    _to_approved,
)

PASSWORD = "Correcthorse123!"


def _account(db_session: Session, email: str, name: str = "Eva Luator") -> User:
    user = User(email=email, hashed_password=hash_password(PASSWORD), full_name=name)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _login(client: TestClient, email: str) -> None:
    client.cookies.clear()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text


def _enable_totp(db_session: Session, user: User) -> None:
    # The session cookie is already issued; the mandate only checks the flag.
    db_session.refresh(user)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _evaluators_url(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/evaluators{suffix}"


def _eeg_url(ttx_id: str) -> str:
    return f"/api/v1/ttx/{ttx_id}/eeg"


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    """A Planner's exercise with an Evaluator (external domain, TOTP on),
    the client signed in as the Planner."""
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    evaluator = _account(db_session, "auditor@external-audit.org")
    granted = client.post(
        f"/api/v1/organizations/{owner['organization']['id']}/evaluators",
        json={"email": evaluator.email},
        headers=_csrf(client),
    )
    assert granted.status_code == 201, granted.text
    added = client.post(
        _evaluators_url(ttx["id"]), json={"email": evaluator.email}, headers=_csrf(client)
    )
    assert added.status_code == 201, added.text
    return {"ttx": ttx, "evaluator": evaluator, "org_id": owner["organization"]["id"]}


def _as_evaluator(client: TestClient, db_session: Session, exercise: dict) -> None:
    _login(client, exercise["evaluator"].email)
    _enable_totp(db_session, exercise["evaluator"])


def test_a_planner_adds_an_evaluator_from_any_domain(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    listed = client.get(_evaluators_url(exercise["ttx"]["id"])).json()["items"]

    assert [item["email"] for item in listed] == ["auditor@external-audit.org"]
    access = db_session.exec(
        select(TTXAccess).where(TTXAccess.user_id == exercise["evaluator"].id)
    ).one()
    assert access.role == RoleEnum.EVALUATOR


def test_adding_someone_without_the_org_grant_or_already_on_the_exercise_is_refused(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _account(db_session, "ungranted@external-audit.org")

    unknown = client.post(
        _evaluators_url(ttx_id), json={"email": "nobody@acme.com"}, headers=_csrf(client)
    )
    ungranted = client.post(
        _evaluators_url(ttx_id),
        json={"email": "ungranted@external-audit.org"},
        headers=_csrf(client),
    )
    again = client.post(
        _evaluators_url(ttx_id),
        json={"email": exercise["evaluator"].email},
        headers=_csrf(client),
    )
    planner = client.post(
        _evaluators_url(ttx_id), json={"email": "planner@acme.com"}, headers=_csrf(client)
    )

    # Same answer for "no account" and "no grant", so the form can't probe.
    for refused in (unknown, ungranted, planner):
        assert refused.status_code == 400
        assert refused.json()["error"]["code"] == "NOT_ORG_EVALUATOR"
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "ALREADY_ON_EXERCISE"
    candidates = client.get(_evaluators_url(ttx_id, "/candidates")).json()["items"]
    assert candidates == []


def test_the_evaluator_sees_the_exercise_with_their_role(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    _as_evaluator(client, db_session, exercise)

    items = client.get("/api/v1/ttx").json()["items"]

    assert [(item["id"], item["role"]) for item in items] == [(exercise["ttx"]["id"], "evaluator")]


def test_the_eeg_waits_for_an_approved_needs_analysis(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    # A Planner previews it at any stage.
    assert client.get(_eeg_url(ttx_id)).status_code == 200

    _as_evaluator(client, db_session, exercise)
    blocked = client.get(_eeg_url(ttx_id))

    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "NEEDS_FORM_NOT_APPROVED"


def test_the_evaluator_reads_the_eeg_and_nothing_of_the_design(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _to_approved(client, ttx_id)
    _as_evaluator(client, db_session, exercise)

    eeg = client.get(_eeg_url(ttx_id))

    assert eeg.status_code == 200, eeg.text
    body = eeg.json()
    assert [o["code"] for o in body["objectives"]] == ["OBJ-01", "OBJ-02", "OBJ-03"]
    assert body["objectives"][0]["observation_points"] == [
        "Documented decision with its rationale in 60 minutes"
    ]
    assert body["rating_scale"] == ["P", "S", "M", "U"]
    # Nothing of the design leaks through the EEG.
    for design_field in ("needs", "risks", "sponsor_name", "stop_exercise_keyword", "perimeter"):
        assert design_field not in body


DESIGN_ENDPOINTS = [
    ("GET", "/attention"),
    ("GET", "/assistant/proposals"),
    ("POST", "/assistant/proposals/00000000-0000-0000-0000-000000000000/applied"),
    ("POST", "/assistant/proposals/00000000-0000-0000-0000-000000000000/discard"),
    ("GET", "/needs-form"),
    ("PUT", "/needs-form"),
    ("POST", "/needs-form/validate"),
    ("POST", "/needs-form/transitions"),
    ("POST", "/needs-form/renumber"),
    ("GET", "/needs-form/pdf"),
    ("GET", "/needs-form/export.md"),
    ("GET", "/dashboard"),
    ("GET", "/invitation-tokens"),
    ("GET", "/email-invitations"),
    ("POST", "/email-invitations"),
    ("POST", "/email-invitations/00000000-0000-0000-0000-000000000000/resend"),
    ("DELETE", "/email-invitations/00000000-0000-0000-0000-000000000000"),
    ("GET", "/access-requests"),
    ("GET", "/planning-team"),
    ("PUT", "/planning-team/lead"),
    ("PUT", "/planning-team/00000000-0000-0000-0000-000000000000/functions"),
    ("GET", "/evaluators"),
    ("POST", "/evaluators"),
    ("GET", "/evaluators/candidates"),
    ("PUT", "/evaluators/lead"),
    ("DELETE", "/evaluators/lead"),
    ("GET", "/observers"),
    ("POST", "/observers"),
    ("GET", "/observers/candidates"),
    ("GET", "/people"),
    ("GET", "/people/candidates"),
    ("POST", "/people"),
    ("PUT", "/people/00000000-0000-0000-0000-000000000000/role"),
    ("PUT", "/people/00000000-0000-0000-0000-000000000000/tags"),
    ("DELETE", "/people/00000000-0000-0000-0000-000000000000"),
    ("GET", "/players"),
    ("DELETE", "/players/00000000-0000-0000-0000-000000000000"),
    ("GET", "/leave-requests"),
    ("POST", "/leave-requests/00000000-0000-0000-0000-000000000000/approve"),
    ("POST", "/leave-requests/00000000-0000-0000-0000-000000000000/reject"),
    ("GET", "/rooms"),
    ("PUT", "/rooms/settings"),
    ("POST", "/rooms"),
    ("PUT", "/rooms/assignments"),
    ("PATCH", "/rooms/00000000-0000-0000-0000-000000000000"),
    ("DELETE", "/rooms/00000000-0000-0000-0000-000000000000"),
    ("GET", "/msel"),
    ("PUT", "/msel"),
    ("POST", "/msel/validate"),
    ("POST", "/msel/transitions"),
    ("POST", "/msel/renumber"),
    ("POST", "/msel/acknowledge-needs-version"),
    ("POST", "/msel/attack-upgrade"),
    ("GET", "/actors"),
    ("POST", "/actors"),
    ("POST", "/msel/injects"),
    ("DELETE", "/msel/injects/00000000-0000-0000-0000-000000000000"),
    ("POST", "/msel/threat-actors"),
    ("DELETE", "/msel/threat-actors/00000000-0000-0000-0000-000000000000"),
    ("GET", "/msel/export/msel.pdf"),
    ("POST", "/msel/images"),
    ("GET", "/msel/images/00000000-0000-0000-0000-000000000000"),
    ("POST", "/msel/files"),
    ("GET", "/msel/files/00000000-0000-0000-0000-000000000000"),
    ("GET", "/msel/files/00000000-0000-0000-0000-000000000000/preview"),
    ("GET", "/conduct-prep/export/sitman.pdf"),
    ("GET", "/conduct-prep/export/eeg.pdf"),
    ("GET", "/conduct-prep"),
    ("PUT", "/conduct-prep"),
    ("POST", "/conduct-prep/validate"),
    ("POST", "/conduct-prep/transitions"),
    ("POST", "/conduct-prep/eeg/reseed"),
    ("PATCH", ""),
    ("POST", "/duplicate"),
    ("PUT", "/tags/apply"),
    ("GET", "/tags"),
    ("POST", "/tags"),
    ("GET", "/scenario"),
    ("GET", "/scenario/export"),
    ("POST", "/scenario/apply"),
    ("POST", "/scenario/import"),
    ("POST", "/aar"),
    ("PUT", "/aar"),
    ("POST", "/aar/transitions"),
]


def test_the_evaluator_is_refused_every_design_endpoint(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _to_approved(client, ttx_id)
    _as_evaluator(client, db_session, exercise)

    for method, suffix in DESIGN_ENDPOINTS:
        response = client.request(
            method, f"/api/v1/ttx/{ttx_id}{suffix}", json={}, headers=_csrf(client)
        )
        assert response.status_code == 403, (method, suffix, response.status_code)
        assert response.json()["error"]["code"] == "TTX_ACCESS_DENIED", (method, suffix)


def test_a_program_manager_off_the_team_reads_the_design_but_never_changes_it(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    """Oversight, not design: a Program Manager without a seat on the
    exercise's team reads every part of it and writes none."""
    ttx_id = exercise["ttx"]["id"]
    _to_approved(client, ttx_id)
    manager = _account(db_session, "co-manager@acme.com", "Co Manager")
    granted = client.post(
        f"/api/v1/organizations/{exercise['org_id']}/program-managers",
        json={"email": manager.email},
        headers=_csrf(client),
    )
    assert granted.status_code == 201, granted.text
    _login(client, manager.email)
    _enable_totp(db_session, manager)

    for method, suffix in DESIGN_ENDPOINTS:
        response = client.request(
            method, f"/api/v1/ttx/{ttx_id}{suffix}", json={}, headers=_csrf(client)
        )
        if method == "GET":
            assert response.status_code != 403, (method, suffix, response.status_code)
        else:
            assert response.status_code == 403, (method, suffix, response.status_code)
            assert response.json()["error"]["code"] == "TTX_ACCESS_DENIED", (method, suffix)


def test_the_evaluator_needs_a_second_factor(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _to_approved(client, ttx_id)
    _login(client, exercise["evaluator"].email)

    response = client.get(_eeg_url(ttx_id))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "MFA_REQUIRED"


def test_players_cannot_read_the_eeg(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _to_approved(client, ttx_id)
    player = _account(db_session, "player@acme.com", "Player")
    db_session.add(TTXAccess(user_id=player.id, ttx_id=uuid.UUID(ttx_id), role=RoleEnum.PLAYER))
    db_session.commit()
    _login(client, player.email)

    assert client.get(_eeg_url(ttx_id)).status_code == 403


def test_removing_an_evaluator_ends_their_access(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _to_approved(client, ttx_id)
    removed = client.delete(
        _evaluators_url(ttx_id, f"/{exercise['evaluator'].id}"), headers=_csrf(client)
    )
    assert removed.status_code == 204

    _as_evaluator(client, db_session, exercise)
    assert client.get(_eeg_url(ttx_id)).status_code == 403


def test_the_evaluator_role_can_be_the_login_default(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    _as_evaluator(client, db_session, exercise)

    response = client.put(
        "/api/v1/auth/default-context",
        json={
            "organization_id": exercise["org_id"],
            "role": "evaluator",
            "ttx_id": exercise["ttx"]["id"],
        },
        headers=_csrf(client),
    )

    assert response.status_code in (200, 204), response.text
    assert client.get("/api/v1/auth/me").json()["default_role"] == "evaluator"


def test_a_planner_still_saves_while_an_evaluator_exists(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    saved = _save(client, ttx_id, _complete_payload(_get(client, ttx_id)))

    assert saved.status_code == 200


def test_each_condition_of_a_success_criterion_is_an_observation_point() -> None:
    from app.services.eeg_service import observation_points

    # One per line; a sentence of prose stays whole.
    assert observation_points("Decision documented. With its owner.\n\n Rationale recorded;\n") == [
        "Decision documented. With its owner",
        "Rationale recorded",
    ]
    assert observation_points("  ") == []


def _second_evaluator(client: TestClient, db_session: Session, exercise: dict) -> User:
    other = _account(db_session, "second@external-audit.org", "Second Evaluator")
    granted = client.post(
        f"/api/v1/organizations/{exercise['org_id']}/evaluators",
        json={"email": other.email},
        headers=_csrf(client),
    )
    assert granted.status_code == 201, granted.text
    added = client.post(
        _evaluators_url(exercise["ttx"]["id"]), json={"email": other.email}, headers=_csrf(client)
    )
    assert added.status_code == 201, added.text
    return other


def _set_lead(client: TestClient, ttx_id: str, user_id: uuid.UUID):
    return client.put(
        _evaluators_url(ttx_id, "/lead"), json={"user_id": str(user_id)}, headers=_csrf(client)
    )


def _leads(client: TestClient, ttx_id: str) -> list[str]:
    return [i["email"] for i in client.get(_evaluators_url(ttx_id)).json()["items"] if i["leads"]]


def test_one_evaluator_leads_and_a_new_pick_replaces_them(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    other = _second_evaluator(client, db_session, exercise)

    assert _set_lead(client, ttx_id, exercise["evaluator"].id).status_code == 204
    assert _leads(client, ttx_id) == [exercise["evaluator"].email]
    assert _set_lead(client, ttx_id, other.id).status_code == 204
    assert _leads(client, ttx_id) == [other.email]
    people = client.get(f"/api/v1/ttx/{ttx_id}/people").json()["items"]
    assert [p["email"] for p in people if p["leads"]] == [other.email]

    assert client.delete(_evaluators_url(ttx_id, "/lead"), headers=_csrf(client)).status_code == 204
    assert _leads(client, ttx_id) == []


def test_only_an_evaluator_of_the_exercise_can_lead(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    planner = db_session.exec(select(User).where(User.email == "planner@acme.com")).one()

    for user_id in (planner.id, uuid.uuid4()):
        refused = _set_lead(client, ttx_id, user_id)
        assert refused.status_code == 404
        assert refused.json()["error"]["code"] == "EVALUATOR_NOT_FOUND"


def test_a_lead_who_stops_evaluating_stops_leading(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    evaluator = exercise["evaluator"]
    granted = client.post(
        f"/api/v1/organizations/{exercise['org_id']}/observers",
        json={"email": evaluator.email},
        headers=_csrf(client),
    )
    assert granted.status_code == 201, granted.text
    _set_lead(client, ttx_id, evaluator.id)

    moved = client.put(
        f"/api/v1/ttx/{ttx_id}/people/{evaluator.id}/role",
        json={"role": "observer"},
        headers=_csrf(client),
    )
    assert moved.status_code == 204, moved.text
    access = db_session.exec(select(TTXAccess).where(TTXAccess.user_id == evaluator.id)).one()
    db_session.refresh(access)
    assert access.leads is False


def test_the_database_keeps_one_lead_per_exercise(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    from sqlalchemy.exc import IntegrityError

    _second_evaluator(client, db_session, exercise)
    rows = db_session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == uuid.UUID(exercise["ttx"]["id"]),
            TTXAccess.role == RoleEnum.EVALUATOR,
        )
    ).all()
    for row in rows:
        row.leads = True
        db_session.add(row)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
