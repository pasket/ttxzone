"""Organization roles offered by invitation where any account may found an
organization ("open", the test suite's default): outside the
organization's own domain a Program Manager offers, the account accepts."""

import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core import crypto
from app.core.config import settings
from app.main import app
from app.models import (
    EmailOutbox,
    EmailSettings,
    OrganizationMembership,
    OrganizationRoleInvitation,
    OrganizationTag,
    PlatformAuditEvent,
    User,
)
from app.services import organization_role_invitation_service

PASSWORD = "Correcthorse123!"


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _owner(client: TestClient, db_session: Session, email: str = "owner@acme.com") -> str:
    """Founds an organization on `client` (domain acme.com) with TOTP on;
    returns its id."""
    response = client.post(
        "/api/v1/organizations",
        json={
            "organization": {"name": "Acme", "tax_id": None},
            "admin": {"email": email, "password": PASSWORD, "full_name": "Owner"},
        },
    )
    assert response.status_code == 201, response.text
    user = db_session.exec(select(User).where(User.email == email)).one()
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    return response.json()["organization"]["id"]


def _register(email: str, full_name: str = "Pat") -> TestClient:
    """A plain account, signed in on a client of its own (close it after)."""
    other = TestClient(app)
    other.__enter__()
    response = other.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    return other


def _invite(client: TestClient, org_id: str, email: str, roles: list[str], **extra):
    return client.post(
        f"/api/v1/organizations/{org_id}/role-invitations",
        json={"email": email, "roles": roles, **extra},
        headers=_csrf(client),
    )


def _roles(db_session: Session, org_id: str, email: str) -> set[str]:
    db_session.expire_all()
    rows = db_session.exec(
        select(OrganizationMembership)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(
            User.email == email,
            OrganizationMembership.organization_id == uuid.UUID(org_id),
        )
    )
    return {str(row.role) for row in rows}


def _actions(db_session: Session) -> list[str]:
    db_session.expire_all()
    return [event.action for event in db_session.exec(select(PlatformAuditEvent))]


def test_a_direct_grant_outside_the_own_domain_asks_for_an_invitation_either_way(
    client: TestClient, db_session: Session
) -> None:
    org_id = _owner(client, db_session)
    other = _register("someone@elsewhere.com")
    other.__exit__(None, None, None)

    answers = [
        client.post(
            f"/api/v1/organizations/{org_id}/observers",
            json={"email": email},
            headers=_csrf(client),
        )
        for email in ("someone@elsewhere.com", "nobody@elsewhere.com")
    ]

    # Same answer whether the address holds an account: no oracle.
    assert [a.status_code for a in answers] == [409, 409]
    assert {a.json()["error"]["code"] for a in answers} == {"ROLE_INVITATION_REQUIRED"}
    assert answers[0].json()["error"]["message"] == answers[1].json()["error"]["message"]
    assert _roles(db_session, org_id, "someone@elsewhere.com") == set()


def test_the_own_domain_is_still_granted_directly(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session)
    _register("colleague@acme.com").__exit__(None, None, None)

    direct = client.post(
        f"/api/v1/organizations/{org_id}/evaluators",
        json={"email": "colleague@acme.com"},
        headers=_csrf(client),
    )
    offered = _invite(client, org_id, "colleague@acme.com", ["observer"])

    assert direct.status_code == 201
    assert offered.status_code == 200
    assert offered.json() == {"outcome": "granted"}
    assert _roles(db_session, org_id, "colleague@acme.com") == {"evaluator", "observer"}


def test_an_offer_answers_the_same_whether_an_account_exists(
    client: TestClient, db_session: Session
) -> None:
    org_id = _owner(client, db_session)
    _register("auditor@elsewhere.com").__exit__(None, None, None)

    existing = _invite(client, org_id, "Auditor@Elsewhere.com", ["observer", "evaluator"])
    missing = _invite(client, org_id, "ghost@elsewhere.com", ["observer"])

    assert existing.status_code == missing.status_code == 200
    assert existing.json() == missing.json() == {"outcome": "invited"}
    # Nothing granted until accepted.
    assert _roles(db_session, org_id, "auditor@elsewhere.com") == set()

    listed = client.get(f"/api/v1/organizations/{org_id}/role-invitations").json()["items"]
    assert {(row["email"], tuple(row["roles"])) for row in listed} == {
        ("auditor@elsewhere.com", ("observer", "evaluator")),
        ("ghost@elsewhere.com", ("observer",)),
    }
    assert {row["invited_by_name"] for row in listed} == {"Owner"}
    assert "organization.role_invited" in _actions(db_session)


def test_the_invited_account_accepts_and_gets_the_roles_and_tags(
    client: TestClient, db_session: Session
) -> None:
    org_id = _owner(client, db_session)
    tag = OrganizationTag(organization_id=uuid.UUID(org_id), name="Audit", color="teal")
    db_session.add(tag)
    db_session.commit()
    invitee = _register("auditor@elsewhere.com")
    try:
        assert (
            _invite(
                client, org_id, "auditor@elsewhere.com", ["evaluator"], tag_ids=[str(tag.id)]
            ).status_code
            == 200
        )

        mine = invitee.get("/api/v1/role-invitations/mine").json()["items"]
        assert len(mine) == 1
        assert mine[0]["organization_name"] == "Acme"
        assert mine[0]["organization_domain"] == "acme.com"
        assert mine[0]["roles"] == ["evaluator"]

        accepted = invitee.post(
            f"/api/v1/role-invitations/{mine[0]['id']}/accept", headers=_csrf(invitee)
        )
        assert accepted.status_code == 200
        assert accepted.json() == {"organization_id": org_id, "roles": ["evaluator"]}
        assert invitee.get("/api/v1/role-invitations/mine").json()["items"] == []
    finally:
        invitee.__exit__(None, None, None)

    assert _roles(db_session, org_id, "auditor@elsewhere.com") == {"evaluator"}
    members = client.get(f"/api/v1/organizations/{org_id}/members").json()["items"]
    auditor = next(m for m in members if m["email"] == "auditor@elsewhere.com")
    assert [t["name"] for t in auditor["tags"]] == ["Audit"]
    assert client.get(f"/api/v1/organizations/{org_id}/role-invitations").json()["items"] == []
    assert "organization.role_invitation_accepted" in _actions(db_session)

    # Now in the organization: more roles go straight to them.
    more = client.post(
        f"/api/v1/organizations/{org_id}/observers",
        json={"email": "auditor@elsewhere.com"},
        headers=_csrf(client),
    )
    assert more.status_code == 201


def test_declining_grants_nothing(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session)
    invitee = _register("auditor@elsewhere.com")
    try:
        _invite(client, org_id, "auditor@elsewhere.com", ["observer"])
        invitation_id = invitee.get("/api/v1/role-invitations/mine").json()["items"][0]["id"]
        declined = invitee.post(
            f"/api/v1/role-invitations/{invitation_id}/decline", headers=_csrf(invitee)
        )
        again = invitee.post(
            f"/api/v1/role-invitations/{invitation_id}/accept", headers=_csrf(invitee)
        )
    finally:
        invitee.__exit__(None, None, None)

    assert declined.status_code == 204
    assert again.status_code == 404
    assert _roles(db_session, org_id, "auditor@elsewhere.com") == set()
    assert "organization.role_invitation_declined" in _actions(db_session)


def test_only_the_address_owner_sees_and_accepts_an_offer(
    client: TestClient, db_session: Session
) -> None:
    org_id = _owner(client, db_session)
    _invite(client, org_id, "auditor@elsewhere.com", ["observer"])
    invitation = db_session.exec(select(OrganizationRoleInvitation)).one()
    intruder = _register("intruder@elsewhere.com")
    try:
        assert intruder.get("/api/v1/role-invitations/mine").json()["items"] == []
        stolen = intruder.post(
            f"/api/v1/role-invitations/{invitation.id}/accept", headers=_csrf(intruder)
        )
    finally:
        intruder.__exit__(None, None, None)

    assert stolen.status_code == 404
    assert stolen.json()["error"]["code"] == "ROLE_INVITATION_NOT_FOUND"
    assert _roles(db_session, org_id, "intruder@elsewhere.com") == set()


def test_an_expired_offer_is_gone(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session)
    _invite(client, org_id, "auditor@elsewhere.com", ["observer"])
    invitation = db_session.exec(select(OrganizationRoleInvitation)).one()
    invitation.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.add(invitation)
    db_session.commit()
    invitee = _register("auditor@elsewhere.com")
    try:
        assert invitee.get("/api/v1/role-invitations/mine").json()["items"] == []
        late = invitee.post(
            f"/api/v1/role-invitations/{invitation.id}/accept", headers=_csrf(invitee)
        )
    finally:
        invitee.__exit__(None, None, None)

    assert late.status_code == 404
    assert client.get(f"/api/v1/organizations/{org_id}/role-invitations").json()["items"] == []


def test_withdrawing_an_offer(client: TestClient, db_session: Session) -> None:
    org_id = _owner(client, db_session)
    _invite(client, org_id, "auditor@elsewhere.com", ["observer"])
    invitation = db_session.exec(select(OrganizationRoleInvitation)).one()

    response = client.delete(
        f"/api/v1/organizations/{org_id}/role-invitations/{invitation.id}", headers=_csrf(client)
    )

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.exec(select(OrganizationRoleInvitation)).all() == []
    assert "organization.role_invitation_withdrawn" in _actions(db_session)


def test_planner_and_program_manager_offers_keep_the_allowlist(
    client: TestClient, db_session: Session
) -> None:
    org_id = _owner(client, db_session)
    _register("planner@elsewhere.com").__exit__(None, None, None)

    answers = [
        _invite(client, org_id, email, ["planner"])
        for email in ("planner@elsewhere.com", "ghost@elsewhere.com")
    ]

    assert [a.status_code for a in answers] == [403, 403]
    assert {a.json()["error"]["code"] for a in answers} == {"DOMAIN_NOT_ALLOWED"}


def test_offers_are_rate_limited_per_organization(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(organization_role_invitation_service, "MAX_PER_ORGANIZATION_PER_HOUR", 2)
    org_id = _owner(client, db_session)

    answers = [
        _invite(client, org_id, f"person{i}@elsewhere.com", ["observer"]).status_code
        for i in range(3)
    ]

    assert answers == [200, 200, 429]


def test_the_email_goes_only_to_an_existing_account(
    client: TestClient, db_session: Session
) -> None:
    # Both accounts exist before the deployment sends email, so neither has
    # an address to confirm.
    org_id = _owner(client, db_session)
    _register("auditor@elsewhere.com").__exit__(None, None, None)
    db_session.add(EmailSettings(from_address="ttx@acme.com", smtp_host="smtp.acme.com"))
    db_session.commit()

    _invite(client, org_id, "auditor@elsewhere.com", ["observer"])
    _invite(client, org_id, "ghost@elsewhere.com", ["observer"])

    db_session.expire_all()
    sent = list(
        db_session.exec(select(EmailOutbox).where(EmailOutbox.template == "role_invitation"))
    )
    assert [row.to_address for row in sent] == ["auditor@elsewhere.com"]
    params = json.loads(crypto.decrypt_secret(sent[0].payload_encrypted or ""))
    assert params["organization"] == "Acme"
    assert params["roles"] == "Observer"


def test_managed_tenancy_keeps_the_direct_grant(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    org_id = _owner(client, db_session)
    _register("auditor@elsewhere.com").__exit__(None, None, None)
    monkeypatch.setattr(settings, "TENANCY_MODE", "managed")
    monkeypatch.setattr(settings, "TENANCY_MAX_ORGANIZATIONS", None)

    response = client.post(
        f"/api/v1/organizations/{org_id}/observers",
        json={"email": "auditor@elsewhere.com"},
        headers=_csrf(client),
    )

    assert response.status_code == 201
    assert _roles(db_session, org_id, "auditor@elsewhere.com") == {"observer"}


def test_deleting_the_organization_drops_its_offers(
    client: TestClient, db_session: Session
) -> None:
    org_id = _owner(client, db_session)
    _invite(client, org_id, "auditor@elsewhere.com", ["observer"])

    response = client.request(
        "DELETE",
        f"/api/v1/organizations/{org_id}",
        json={"confirmation": "Acme"},
        headers=_csrf(client),
    )

    assert response.status_code == 204, response.text
    db_session.expire_all()
    assert db_session.exec(select(OrganizationRoleInvitation)).all() == []
