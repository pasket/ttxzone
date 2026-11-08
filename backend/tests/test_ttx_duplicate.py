"""Duplicating an exercise: its design and team, never its people's
answers, invitations, sessions or approvals."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import (
    TTX,
    Inject,
    InvitationToken,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    User,
)
from tests.test_scenario_library import designed, image_dir  # noqa: F401
from tests.test_ttx_needs_form import _csrf, _get, _manager
from tests.test_ttx_tags import _register_bare


def _duplicate(client: TestClient, ttx: dict, name: str = "Ransomware drill II"):
    return client.post(
        f"/api/v1/ttx/{ttx['id']}/duplicate",
        json={"name": name, "organization_id": ttx["organization_id"]},
        headers=_csrf(client),
    )


def _member(
    db_session: Session,
    org_id: str,
    ttx_id: str,
    email: str,
    grants: list[OrgRoleEnum],
    **access,
) -> uuid.UUID:
    """Someone of the organization seated on the exercise, written straight
    to the database (no sign-in needed: they never act here)."""
    user_id = uuid.UUID(_register_bare(TestClient(app), email))
    for role in grants:
        db_session.add(
            OrganizationMembership(user_id=user_id, organization_id=uuid.UUID(org_id), role=role)
        )
    db_session.add(TTXAccess(user_id=user_id, ttx_id=uuid.UUID(ttx_id), **access))
    db_session.commit()
    return user_id


def _team(db_session: Session, ttx_id: str) -> dict[str, TTXAccess]:
    db_session.expire_all()
    return {
        user.email: access
        for access, user in db_session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == uuid.UUID(ttx_id))
        )
    }


def test_a_duplicate_carries_the_design_as_a_fresh_draft(
    client: TestClient,
    db_session: Session,
    designed: dict,  # noqa: F811
) -> None:
    source = designed["ttx"]
    response = _duplicate(client, source)
    assert response.status_code == 201, response.text
    body = response.json()
    copy = body["ttx"]

    assert copy["id"] != source["id"]
    assert copy["name"] == "Ransomware drill II"
    assert copy["code"] != source["code"] and copy["code"].startswith("TTX-")
    assert copy["needs_form_status"] == "draft"
    assert copy["msel_status"] == "draft"
    assert [t["name"] for t in copy["tags"]] == ["Ransomware"]
    assert copy["lead_planner"]["user_id"] == source["created_by_id"]
    assert body["skipped_members"] == []

    form = _get(client, copy["id"])
    assert [o["code"] for o in form["objectives"]] == ["OBJ-01", "OBJ-02", "OBJ-03"]
    counts = client.get(f"/api/v1/ttx/{copy['id']}/scenario").json()
    assert counts == client.get(f"/api/v1/ttx/{source['id']}/scenario").json()
    injects = db_session.exec(select(Inject).where(Inject.ttx_id == uuid.UUID(copy["id"]))).all()
    assert len(injects) == len(designed["msel"]["injects"])

    # The source is untouched.
    db_session.expire_all()
    assert db_session.get(TTX, uuid.UUID(source["id"])).name == "Ransomware drill"


def test_a_duplicate_seats_the_team_its_grants_still_allow_and_no_players(
    client: TestClient,
    db_session: Session,
    designed: dict,  # noqa: F811
) -> None:
    source = designed["ttx"]
    org_id = designed["org_id"]
    _member(
        db_session, org_id, source["id"], "ctl@acme.com", [OrgRoleEnum.PLANNER],
        role=RoleEnum.PLANNER, controls=True, facilitates=True,
    )  # fmt: skip
    _member(
        db_session, org_id, source["id"], "lead.eval@acme.com", [OrgRoleEnum.EVALUATOR],
        role=RoleEnum.EVALUATOR, leads=True,
    )  # fmt: skip
    _member(
        db_session, org_id, source["id"], "obs@acme.com", [OrgRoleEnum.OBSERVER],
        role=RoleEnum.OBSERVER,
    )  # fmt: skip
    # Granted Planner once; the grant is gone, only the Evaluator one stays.
    _member(
        db_session, org_id, source["id"], "former@acme.com", [OrgRoleEnum.EVALUATOR],
        role=RoleEnum.PLANNER, plans=True, evaluates=True,
    )  # fmt: skip
    _member(
        db_session, org_id, source["id"], "gone@acme.com", [],
        role=RoleEnum.PLANNER, plans=True,
    )  # fmt: skip
    _member(db_session, org_id, source["id"], "player@acme.com", [], role=RoleEnum.PLAYER)
    db_session.add(
        InvitationToken(
            ttx_id=uuid.UUID(source["id"]),
            role=RoleEnum.PLAYER,
            token="x" * 32,
            created_by_id=uuid.UUID(source["created_by_id"]),
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
    )
    db_session.commit()

    response = _duplicate(client, source)
    assert response.status_code == 201, response.text
    assert response.json()["skipped_members"] == ["Eve"]
    copy_id = response.json()["ttx"]["id"]

    team = _team(db_session, copy_id)
    assert set(team) == {
        "owner@acme.com", "ctl@acme.com", "lead.eval@acme.com", "obs@acme.com", "former@acme.com",
    }  # fmt: skip
    ctl = team["ctl@acme.com"]
    assert (ctl.role, ctl.plans, ctl.controls, ctl.facilitates) == (
        RoleEnum.PLANNER, False, True, True,
    )  # fmt: skip
    assert (team["lead.eval@acme.com"].role, team["lead.eval@acme.com"].leads) == (
        RoleEnum.EVALUATOR, True,
    )  # fmt: skip
    assert team["obs@acme.com"].role == RoleEnum.OBSERVER
    assert team["former@acme.com"].role == RoleEnum.EVALUATOR
    owner = team["owner@acme.com"]
    assert (owner.plans, owner.controls) == (True, True)
    assert (
        db_session.exec(
            select(InvitationToken).where(InvitationToken.ttx_id == uuid.UUID(copy_id))
        ).all()
        == []
    )


def test_only_a_planner_of_the_exercise_in_its_organization_duplicates_it(
    client: TestClient,
    db_session: Session,
    designed: dict,  # noqa: F811
) -> None:
    source = designed["ttx"]
    wrong_org = client.post(
        f"/api/v1/ttx/{source['id']}/duplicate",
        json={"name": "Copy", "organization_id": str(uuid.uuid4())},
        headers=_csrf(client),
    )
    assert wrong_org.status_code == 404

    other = TestClient(app)
    _manager(other, db_session, "intruder@other.com", "Other")
    refused = _duplicate(other, source)
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "TTX_ACCESS_DENIED"
