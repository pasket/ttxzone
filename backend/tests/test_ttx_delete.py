"""Deleting an exercise: only its Lead Planner or a Program Manager of its
organization, with its name typed and a recent sign-in -- and then every
row that hangs off it goes, while the organization's other exercises stay."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import (
    TTX,
    Inject,
    InvitationToken,
    MselSimulatedActor,
    OrganizationMembership,
    OrgRoleEnum,
    PlatformAuditEvent,
    RoleEnum,
    TTXAccess,
    TTXConductPrep,
    TTXMsel,
    TTXNeed,
    TTXNeedsForm,
    TTXTag,
    User,
    UserSession,
)
from tests.msel_helpers import example_payload
from tests.test_ttx_evaluation import _account, _enable_totp, _login
from tests.test_ttx_msel import _open, _put
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager, _to_approved


def _delete(client: TestClient, ttx: dict, confirmation: str | None = None):
    return client.request(
        "DELETE",
        f"/api/v1/ttx/{ttx['id']}",
        json={"confirmation": confirmation if confirmation is not None else ttx["name"]},
        headers=_csrf(client),
    )


def _designed(client: TestClient, org_id: str, name: str) -> dict:
    ttx = _create_ttx(client, org_id, name)
    _to_approved(client, ttx["id"])
    saved = _put(client, ttx["id"], example_payload(_open(client, ttx["id"])))
    assert saved.status_code == 200, saved.text
    client.post(
        f"/api/v1/ttx/{ttx['id']}/tags", json={"name": "Drill", "color": "rose"},
        headers=_csrf(client),
    )  # fmt: skip
    token = client.post(
        f"/api/v1/ttx/{ttx['id']}/invitation-tokens",
        json={
            "role": "player",
            "expires_at": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
            "max_uses": 10,
        },
        headers=_csrf(client),
    )
    assert token.status_code == 201, token.text
    return ttx


def test_the_lead_planner_deletes_the_exercise_and_everything_under_it(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "lead@acme.com", "Acme")
    org_id = owner["organization"]["id"]
    doomed = _designed(client, org_id, "Doomed drill")
    kept = _create_ttx(client, org_id, "Kept drill")
    listed = {t["id"]: t for t in client.get("/api/v1/ttx").json()["items"]}
    assert listed[doomed["id"]]["can_delete"] is True

    response = _delete(client, doomed)

    assert response.status_code == 204, response.text
    db_session.expire_all()
    ttx_id = uuid.UUID(doomed["id"])
    assert db_session.get(TTX, ttx_id) is None
    for model, column in (
        (TTXNeedsForm, TTXNeedsForm.ttx_id),
        (TTXMsel, TTXMsel.ttx_id),
        (Inject, Inject.ttx_id),
        (MselSimulatedActor, MselSimulatedActor.ttx_id),
        (TTXTag, TTXTag.ttx_id),
        (TTXConductPrep, TTXConductPrep.ttx_id),
        (InvitationToken, InvitationToken.ttx_id),
        (TTXAccess, TTXAccess.ttx_id),
    ):
        assert db_session.exec(select(model).where(column == ttx_id)).all() == [], model
    # Only that exercise: the organization's other one is still there.
    assert db_session.get(TTX, uuid.UUID(kept["id"])) is not None
    assert db_session.exec(select(TTXNeed)).all() == []


def test_only_the_lead_planner_or_a_program_manager_may_delete(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "lead@acme.com", "Acme")
    org_id = owner["organization"]["id"]
    ttx = _create_ttx(client, org_id, "Drill")
    # A co-planner of the exercise, not its lead.
    co = _account(db_session, "co@acme.com", "Co Planner")
    db_session.add(
        OrganizationMembership(
            user_id=co.id, organization_id=uuid.UUID(org_id), role=OrgRoleEnum.PLANNER
        )
    )
    db_session.add(
        TTXAccess(user_id=co.id, ttx_id=uuid.UUID(ttx["id"]), role=RoleEnum.PLANNER, plans=True)
    )
    db_session.commit()
    _login(client, "co@acme.com")
    _enable_totp(db_session, co)

    listed = client.get("/api/v1/ttx").json()["items"]
    assert [t["can_delete"] for t in listed] == [False]
    refused = _delete(client, ttx)
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "TTX_DELETE_FORBIDDEN"

    # A Program Manager of the organization (who isn't its lead) may.
    pm = _account(db_session, "pm@acme.com", "Pat Manager")
    db_session.add(
        OrganizationMembership(
            user_id=pm.id, organization_id=uuid.UUID(org_id), role=OrgRoleEnum.PROGRAM_MANAGER
        )
    )
    db_session.commit()
    _login(client, "pm@acme.com")
    _enable_totp(db_session, pm)
    assert _delete(client, ttx).status_code == 204


def test_the_name_must_be_typed_but_no_step_up_is_asked(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "lead@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"], "Drill")

    mismatch = _delete(client, ttx, "Drll")
    assert mismatch.status_code == 422
    assert mismatch.json()["error"]["code"] == "CONFIRMATION_MISMATCH"

    user = db_session.exec(select(User).where(User.email == "lead@acme.com")).one()
    for user_session in db_session.exec(select(UserSession).where(UserSession.user_id == user.id)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()
    # A sign-in an hour old deletes it with the name typed; audited.
    deleted = _delete(client, ttx)
    assert deleted.status_code == 204, deleted.text
    db_session.expire_all()
    assert db_session.get(TTX, uuid.UUID(ttx["id"])) is None
    event = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "exercise.delete")
    ).one()
    assert event.target_id == uuid.UUID(ttx["id"])
    assert event.target_label and "Drill" in event.target_label
