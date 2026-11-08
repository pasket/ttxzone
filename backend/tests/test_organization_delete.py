import uuid
from datetime import UTC, datetime, timedelta

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    TTX,
    AllowedDomainTagAssignment,
    ConductPrepAttendee,
    ConductPrepEegObjective,
    ConductPrepEegPoint,
    ConductPrepEvaluator,
    ConductPrepEvaluatorObjective,
    ConductPrepFinding,
    ConductPrepSnapshot,
    Inject,
    InvitationTokenRedemption,
    MembershipTagAssignment,
    Organization,
    OrganizationAllowedDomain,
    OrganizationMembership,
    OrganizationTag,
    PlatformAuditEvent,
    TTXAccess,
    TTXAccessRequest,
    TTXConductPrep,
    TTXTag,
    TTXTagAssignment,
    User,
)
from app.services import totp_service
from tests.org_paths import org_base


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _enable_totp_with_secret(db_session: Session, user_id: str, secret: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    totp_service.store_secret(user, secret)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _login_with_totp(client: TestClient, email: str, secret: str) -> None:
    """Completes a full login + TOTP-verify round trip -- mandatory MFA for
    Program Manager/Planner means a bare password login alone never reaches
    an authenticated session (see core/security.py's mandate). Same shape
    as test_ttx_tag_assignment.py's own reference tests, which is what this
    helper mirrors in place of the brief's illustrative placeholder."""
    login_response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Correcthorse123!"}
    )
    assert login_response.status_code == 200
    mfa_pending_token = login_response.json()["mfa_pending_token"]
    verify_response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token, "code": pyotp.TOTP(secret).now()},
    )
    assert verify_response.status_code == 200


def test_delete_organization_removes_every_dependent_row(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "delorg-owner@acme.com", "DelOrg")
    organization_id = owner["organization"]["id"]
    owner_id = owner["user"]["id"]
    owner_secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, owner_id, owner_secret)
    headers = _csrf_headers(client)

    org_tag = OrganizationTag(
        organization_id=uuid.UUID(organization_id), name="OrgTag", color="indigo"
    )
    db_session.add(org_tag)
    db_session.commit()
    org_tag_id = org_tag.id

    # An allowed-domain row, tagged with the org tag above -- exercises
    # delete_organization's AllowedDomainTagAssignment cleanup, which FKs
    # to both organization_tag.id and organization_allowed_domain.id and
    # has no ondelete cascade.
    domain_id = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    ).json()["id"]
    client.put(
        f"{org_base(client)}/allowed-domains/{domain_id}/tags",
        json={"tag_ids": [str(org_tag_id)]},
        headers=headers,
    )

    # A second Planner grant, tagged with the org tag above -- exercises
    # delete_organization's MembershipTagAssignment cleanup, which FKs
    # to both organization_tag.id and organization_membership.id and has
    # no ondelete cascade.
    grantee = User(email="delorg-grantee@acme.com", hashed_password="unused", full_name="Grantee")
    db_session.add(grantee)
    db_session.commit()
    db_session.refresh(grantee)
    client.post(
        f"{org_base(client)}/planners",
        json={"email": "delorg-grantee@acme.com"},
        headers=headers,
    )
    client.put(
        f"{org_base(client)}/planners/{grantee.id}/tags",
        json={"tag_ids": [str(org_tag_id)]},
        headers=headers,
    )

    ttx = client.post(
        "/api/v1/ttx",
        json={"name": "Drill", "description": None, "organization_id": organization_id},
        headers=headers,
    ).json()
    ttx_id = ttx["id"]

    ttx_tag = client.post(
        f"/api/v1/ttx/{ttx_id}/tags",
        json={"name": "TTXTag", "color": "rose"},
        headers=headers,
    ).json()
    client.put(
        f"/api/v1/ttx/{ttx_id}/tags/apply", json={"tag_ids": [ttx_tag["id"]]}, headers=headers
    )

    db_session.add(
        Inject(
            ttx_id=uuid.UUID(ttx_id),
            created_by_id=uuid.UUID(owner_id),
            title="Go",
            content="Go time.",
        )
    )
    db_session.commit()

    # A conduct prep with one row of every child table -- none of their FKs
    # cascades.
    prep = TTXConductPrep(ttx_id=uuid.UUID(ttx_id), log_keeper_id=uuid.UUID(owner_id))
    db_session.add(prep)
    db_session.flush()
    eeg = ConductPrepEegObjective(prep_id=prep.id, objective_id=uuid.uuid4())
    evaluator = ConductPrepEvaluator(prep_id=prep.id, user_id=grantee.id)
    db_session.add_all(
        [
            eeg,
            evaluator,
            ConductPrepFinding(prep_id=prep.id, description="Ambiguous"),
            ConductPrepAttendee(prep_id=prep.id, name="Chief Executive"),
            ConductPrepSnapshot(
                prep_id=prep.id, version=1, payload={}, created_by_id=uuid.UUID(owner_id)
            ),
        ]
    )
    db_session.flush()
    db_session.add_all(
        [
            ConductPrepEegPoint(eeg_objective_id=eeg.id, text="Decision recorded"),
            ConductPrepEvaluatorObjective(evaluator_id=evaluator.id, eeg_objective_id=eeg.id),
        ]
    )
    db_session.commit()

    token = client.post(
        f"/api/v1/ttx/{ttx_id}/invitation-tokens",
        json={
            "role": "player",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "max_uses": None,
        },
        headers=headers,
    ).json()
    client.put(
        f"/api/v1/invitation-tokens/{token['id']}/tags",
        json={"tag_ids": [ttx_tag["id"]]},
        headers=headers,
    )

    # A second member whose default_organization_id points at this org --
    # signed up now (not earlier) since _signup's response overwrites the
    # TestClient's cookie jar with the new account's own session, which
    # would otherwise invalidate `headers`' CSRF token for the owner-
    # authenticated calls above.
    member = _signup(client, "delorg-member@example.com", "DelOrgMemberOrg")
    member_user = db_session.get(User, uuid.UUID(member["user"]["id"]))
    member_user.default_organization_id = uuid.UUID(organization_id)
    db_session.add(member_user)
    db_session.commit()

    redeem_headers = _csrf_headers(client)
    client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": token["token"]},
        headers=redeem_headers,
    )

    # Back to the owner for the delete call -- full login + TOTP-verify
    # round trip, since TOTP is mandatory for Planner/Program Manager.
    client.cookies.clear()
    _login_with_totp(client, "delorg-owner@acme.com", owner_secret)

    delete_headers = _csrf_headers(client)
    # The name typed is the confirmation (no step-up).
    mismatch = client.request(
        "DELETE",
        f"/api/v1/organizations/{organization_id}",
        json={"confirmation": "DelOrgg"},
        headers=delete_headers,
    )
    assert mismatch.status_code == 400
    assert mismatch.json()["error"]["code"] == "CONFIRMATION_MISMATCH"
    assert db_session.get(Organization, uuid.UUID(organization_id)) is not None
    delete_resp = client.request(
        "DELETE",
        f"/api/v1/organizations/{organization_id}",
        json={"confirmation": " DelOrg "},
        headers=delete_headers,
    )
    assert delete_resp.status_code == 204
    db_session.expire_all()
    event = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "organization.delete")
    ).one()
    assert (event.target_id, event.target_label) == (uuid.UUID(organization_id), "DelOrg")

    assert db_session.get(Organization, uuid.UUID(organization_id)) is None
    assert (
        db_session.exec(
            select(TTX).where(TTX.organization_id == uuid.UUID(organization_id))
        ).first()
        is None
    )
    assert db_session.exec(select(TTXTag).where(TTXTag.ttx_id == uuid.UUID(ttx_id))).first() is None
    assert (
        db_session.exec(select(TTXAccess).where(TTXAccess.ttx_id == uuid.UUID(ttx_id))).first()
        is None
    )
    assert (
        db_session.exec(
            select(TTXTagAssignment).where(TTXTagAssignment.ttx_tag_id == uuid.UUID(ttx_tag["id"]))
        ).first()
        is None
    )
    assert (
        db_session.exec(
            select(TTXAccessRequest).where(TTXAccessRequest.ttx_id == uuid.UUID(ttx_id))
        ).first()
        is None
    )
    assert (
        db_session.exec(
            select(InvitationTokenRedemption).where(
                InvitationTokenRedemption.invitation_token_id == uuid.UUID(token["id"])
            )
        ).first()
        is None
    )
    assert (
        db_session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == uuid.UUID(organization_id)
            )
        ).first()
        is None
    )
    assert (
        db_session.exec(
            select(OrganizationAllowedDomain).where(
                OrganizationAllowedDomain.organization_id == uuid.UUID(organization_id)
            )
        ).first()
        is None
    )
    assert (
        db_session.exec(
            select(OrganizationTag).where(
                OrganizationTag.organization_id == uuid.UUID(organization_id)
            )
        ).first()
        is None
    )
    assert db_session.exec(select(Inject).where(Inject.ttx_id == uuid.UUID(ttx_id))).first() is None
    assert db_session.exec(select(TTXConductPrep)).first() is None
    assert db_session.exec(select(ConductPrepEvaluator)).first() is None
    assert (
        db_session.exec(
            select(MembershipTagAssignment).where(
                MembershipTagAssignment.organization_tag_id == org_tag_id
            )
        ).first()
        is None
    )
    assert (
        db_session.exec(
            select(AllowedDomainTagAssignment).where(
                AllowedDomainTagAssignment.organization_tag_id == org_tag_id
            )
        ).first()
        is None
    )

    db_session.refresh(member_user)
    assert member_user.default_organization_id is None


def test_delete_organization_requires_program_manager_of_that_org(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "delorg-owner2@acme.com", "DelOrg2")
    other = _signup(client, "delorg-outsider@acme.com", "OtherOrg")
    other_secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, other["user"]["id"], other_secret)

    client.cookies.clear()
    _login_with_totp(client, "delorg-outsider@acme.com", other_secret)
    headers = _csrf_headers(client)
    response = client.request(
        "DELETE",
        f"/api/v1/organizations/{owner['organization']['id']}",
        json={"confirmation": "DelOrg2"},
        headers=headers,
    )
    assert response.status_code == 403
