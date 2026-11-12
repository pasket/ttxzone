"""Granting organization roles in tests.

The suite runs on "open" tenancy, where a role for someone outside the
organization's own domain is an invitation the person accepts
(organization_role_invitation_service). `grant_org_role` offers it as the
Program Manager signed in on `client` and accepts it on the person's
behalf, so a fixture ends with the grant either way."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import OrganizationRoleInvitation, User
from app.services import organization_role_invitation_service


def grant_org_role(
    client: TestClient, db_session: Session, organization_id: str, email: str, role: str
) -> None:
    offered = client.post(
        f"/api/v1/organizations/{organization_id}/role-invitations",
        json={"email": email, "roles": [role]},
        headers={settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]},
    )
    assert offered.status_code == 200, offered.text
    if offered.json()["outcome"] == "granted":
        return
    db_session.expire_all()
    invitation = db_session.exec(
        select(OrganizationRoleInvitation).where(
            OrganizationRoleInvitation.organization_id == uuid.UUID(organization_id),
            OrganizationRoleInvitation.email == email.lower(),
        )
    ).one()
    user = db_session.exec(select(User).where(User.email == email.lower())).one()
    organization_role_invitation_service.accept(db_session, user, invitation.id)
