"""Leaving an organization oneself (Preferences -> Privacy): every grant
goes with every seat on its exercises but a Player's; the last Program
Manager hands the role over first."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import (
    TTX,
    Organization,
    OrganizationAllowedDomain,
    OrganizationMembership,
    OrgRoleEnum,
    PlatformAuditEvent,
    RoleEnum,
    TTXAccess,
    User,
    UserSession,
)

PASSWORD = "Correcthorse123!"


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _account(client: TestClient, db_session: Session, email: str, name: str) -> User:
    response = client.post(
        "/api/v1/auth/register", json={"email": email, "password": PASSWORD, "full_name": name}
    )
    assert response.status_code == 201, response.text
    user = db_session.exec(select(User).where(User.email == email)).one()
    # Program Managers and Planners need a second factor; not under test here.
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    return user


def _grant(db_session: Session, org: Organization, user: User, *roles: OrgRoleEnum) -> None:
    for role in roles:
        db_session.add(OrganizationMembership(user_id=user.id, organization_id=org.id, role=role))
    db_session.commit()


def _exercise(db_session: Session, org: Organization, creator: User, name: str) -> TTX:
    ttx = TTX(name=name, organization_id=org.id, created_by_id=creator.id)
    db_session.add(ttx)
    db_session.commit()
    db_session.refresh(ttx)
    return ttx


def _seat(db_session: Session, ttx: TTX, user: User, role: RoleEnum, **flags) -> None:
    db_session.add(TTXAccess(user_id=user.id, ttx_id=ttx.id, role=role, **flags))
    db_session.commit()


def _org(db_session: Session) -> Organization:
    org = Organization(name="Acme Corp")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    db_session.add(
        OrganizationAllowedDomain(
            organization_id=org.id, domain="acme.com", allows_program_manager=True
        )
    )
    db_session.commit()
    return org


def _leave(client: TestClient, org: Organization, **body):
    return client.post(
        f"/api/v1/organizations/{org.id}/leave",
        json={"confirmation": "Acme Corp", **body},
        headers=_csrf(client),
    )


def _roles(db_session: Session, org: Organization, user: User) -> set[str]:
    db_session.expire_all()
    return {
        m.role.value
        for m in db_session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == org.id,
                OrganizationMembership.user_id == user.id,
            )
        )
    }


def test_a_planner_leaves_and_their_default_goes(client: TestClient, db_session: Session) -> None:
    org = _org(db_session)
    with TestClient(app) as other:
        manager = _account(other, db_session, "pm@acme.com", "Pat Manager")
    _grant(db_session, org, manager, OrgRoleEnum.PROGRAM_MANAGER)
    planner = _account(client, db_session, "plan@acme.com", "Lee Planner")
    _grant(db_session, org, planner, OrgRoleEnum.PLANNER, OrgRoleEnum.OBSERVER)
    planner.default_organization_id = org.id
    planner.default_role = "planner"
    db_session.add(planner)
    db_session.commit()

    preview = client.get(f"/api/v1/organizations/{org.id}/leave-preview").json()
    assert preview["organization_name"] == "Acme Corp"
    assert preview["is_program_manager"] is False
    assert preview["exercises"] == []

    wrong = _leave(client, org, confirmation="Acme")
    assert wrong.status_code == 400
    assert wrong.json()["error"]["code"] == "CONFIRMATION_MISMATCH"
    assert _leave(client, org).status_code == 204

    assert _roles(db_session, org, planner) == set()
    db_session.refresh(planner)
    assert planner.default_organization_id is None
    assert planner.default_role is None
    gone = client.get(f"/api/v1/organizations/{org.id}/leave-preview")
    assert gone.status_code == 404


def test_the_last_program_manager_hands_over(client: TestClient, db_session: Session) -> None:
    org = _org(db_session)
    manager = _account(client, db_session, "pm@acme.com", "Pat Manager")
    _grant(db_session, org, manager, OrgRoleEnum.PROGRAM_MANAGER, OrgRoleEnum.PLANNER)
    with TestClient(app) as other:
        member = _account(other, db_session, "plan@acme.com", "Lee Planner")
        outsider = _account(other, db_session, "out@else.com", "Out Sider")
    _grant(db_session, org, member, OrgRoleEnum.PLANNER)
    # A member, but their domain can't hold the Program Manager role.
    _grant(db_session, org, outsider, OrgRoleEnum.OBSERVER)

    preview = client.get(f"/api/v1/organizations/{org.id}/leave-preview").json()
    assert preview["is_last_program_manager"] is True
    assert [c["email"] for c in preview["program_manager_candidates"]] == ["plan@acme.com"]

    refused = _leave(client, org)
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "PROGRAM_MANAGER_SUCCESSOR_REQUIRED"
    stranger = _leave(client, org, program_manager_successor_id=str(outsider.id))
    assert stranger.status_code == 400
    assert stranger.json()["error"]["code"] == "INVALID_PROGRAM_MANAGER_SUCCESSOR"

    assert _leave(client, org, program_manager_successor_id=str(member.id)).status_code == 204
    assert _roles(db_session, org, manager) == set()
    assert _roles(db_session, org, member) == {"planner", "program_manager"}


def test_a_non_manager_cannot_hand_over_the_role(client: TestClient, db_session: Session) -> None:
    org = _org(db_session)
    with TestClient(app) as other:
        manager = _account(other, db_session, "pm@acme.com", "Pat Manager")
    _grant(db_session, org, manager, OrgRoleEnum.PROGRAM_MANAGER)
    planner = _account(client, db_session, "plan@acme.com", "Lee Planner")
    _grant(db_session, org, planner, OrgRoleEnum.PLANNER)
    with TestClient(app) as other:
        member = _account(other, db_session, "obs@acme.com", "Obi Server")
    _grant(db_session, org, member, OrgRoleEnum.OBSERVER)

    refused = _leave(client, org, program_manager_successor_id=str(member.id))
    assert refused.status_code == 400
    assert _roles(db_session, org, member) == {"observer"}


def test_seats_go_leads_hand_over_and_player_seats_stay(
    client: TestClient, db_session: Session
) -> None:
    org = _org(db_session)
    leaver = _account(client, db_session, "lee@acme.com", "Lee Leaver")
    with TestClient(app) as other:
        kim = _account(other, db_session, "kim@acme.com", "Kim Planner")
        sam = _account(other, db_session, "sam@acme.com", "Sam Planner")
        pm = _account(other, db_session, "pm@acme.com", "Pat Manager")
    _grant(db_session, org, pm, OrgRoleEnum.PROGRAM_MANAGER)
    _grant(db_session, org, leaver, OrgRoleEnum.PLANNER, OrgRoleEnum.EVALUATOR)
    _grant(db_session, org, kim, OrgRoleEnum.PLANNER)
    _grant(db_session, org, sam, OrgRoleEnum.PLANNER)

    led = _exercise(db_session, org, leaver, "Led drill")
    _seat(db_session, led, leaver, RoleEnum.PLANNER, plans=True, controls=True, evaluates=True)
    _seat(db_session, led, kim, RoleEnum.PLANNER, plans=True, controls=True)
    _seat(db_session, led, sam, RoleEnum.PLANNER, plans=True)
    evaluated = _exercise(db_session, org, kim, "Evaluated drill")
    _seat(db_session, evaluated, kim, RoleEnum.PLANNER, plans=True, controls=True)
    _seat(db_session, evaluated, leaver, RoleEnum.EVALUATOR)
    played = _exercise(db_session, org, kim, "Played drill")
    _seat(db_session, played, kim, RoleEnum.PLANNER, plans=True, controls=True)
    _seat(db_session, played, leaver, RoleEnum.PLAYER)

    preview = client.get(f"/api/v1/organizations/{org.id}/leave-preview").json()
    by_name = {e["ttx_name"]: e for e in preview["exercises"]}
    assert set(by_name) == {"Led drill", "Evaluated drill"}
    assert by_name["Led drill"]["blocked"] is None
    assert {c["full_name"] for c in by_name["Led drill"]["lead_candidates"]} == {
        "Kim Planner",
        "Sam Planner",
    }
    assert by_name["Evaluated drill"]["seats"] == ["evaluator"]

    missing = _leave(client, org)
    assert missing.status_code == 409
    assert missing.json()["error"]["code"] == "LEAD_SUCCESSOR_REQUIRED"
    left = _leave(client, org, lead_successors={str(led.id): str(sam.id)})
    assert left.status_code == 204, left.text

    db_session.expire_all()
    seats = db_session.exec(select(TTXAccess).where(TTXAccess.user_id == leaver.id)).all()
    assert [(s.ttx_id, s.role) for s in seats] == [(played.id, RoleEnum.PLAYER)]
    assert db_session.get(TTX, led.id).lead_planner_id == sam.id
    assert _roles(db_session, org, leaver) == set()


def test_the_only_planner_or_controller_cannot_leave(
    client: TestClient, db_session: Session
) -> None:
    org = _org(db_session)
    leaver = _account(client, db_session, "lee@acme.com", "Lee Leaver")
    with TestClient(app) as other:
        kim = _account(other, db_session, "kim@acme.com", "Kim Planner")
        pm = _account(other, db_session, "pm@acme.com", "Pat Manager")
    _grant(db_session, org, pm, OrgRoleEnum.PROGRAM_MANAGER)
    _grant(db_session, org, leaver, OrgRoleEnum.PLANNER)
    ttx = _exercise(db_session, org, kim, "Drill")
    _seat(db_session, ttx, kim, RoleEnum.PLANNER, plans=True)
    _seat(db_session, ttx, leaver, RoleEnum.PLANNER, controls=True)

    preview = client.get(f"/api/v1/organizations/{org.id}/leave-preview").json()
    assert preview["exercises"][0]["blocked"] == "controller"
    refused = _leave(client, org)
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "ONLY_PLANNER_OR_CONTROLLER"
    assert _roles(db_session, org, leaver) == {"planner"}


def test_leaving_needs_no_step_up_and_is_audited(client: TestClient, db_session: Session) -> None:
    org = _org(db_session)
    user = _account(client, db_session, "lee@acme.com", "Lee Leaver")
    _grant(db_session, org, user, OrgRoleEnum.OBSERVER)
    for row in db_session.exec(select(UserSession).where(UserSession.user_id == user.id)):
        row.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(row)
    db_session.commit()
    left = _leave(client, org)
    assert left.status_code == 204, left.text
    assert _roles(db_session, org, user) == set()
    assert db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "organization.leave")
    ).first()
