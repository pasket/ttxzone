"""Organization roles offered by invitation (organization_role_invitation_service):
a Program Manager's offers (Admin -> Users and roles) and the invited
account's own (accept or decline)."""

import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.v1.endpoints.organizations import require_program_manager_of
from app.core.db import get_session
from app.core.i18n import get_locale
from app.core.security import get_current_user, verify_csrf
from app.models import User
from app.schemas.organization import (
    MyRoleInvitationListResponse,
    MyRoleInvitationRead,
    OrgRoleInvitationCreateRequest,
    OrgRoleInvitationCreateResponse,
    OrgRoleInvitationListResponse,
    OrgRoleInvitationRead,
    RoleInvitationAcceptResponse,
)
from app.services import organization_role_invitation_service as service

router = APIRouter(prefix="/organizations", tags=["role-invitations"])
# The invited account's routes: no organization in the path, the offer
# belongs to the signed-in account's address.
me_router = APIRouter(prefix="/role-invitations", tags=["role-invitations"])


@router.post(
    "/{organization_id}/role-invitations",
    response_model=OrgRoleInvitationCreateResponse,
    dependencies=[Depends(verify_csrf)],
)
def create_role_invitation_endpoint(
    payload: OrgRoleInvitationCreateRequest,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> OrgRoleInvitationCreateResponse:
    """Offer organization roles to an email address."""
    outcome = service.invite(
        session, organization_id, user, payload.email, payload.roles, payload.tag_ids, locale
    )
    return OrgRoleInvitationCreateResponse(outcome=outcome)


@router.get("/{organization_id}/role-invitations", response_model=OrgRoleInvitationListResponse)
def list_role_invitations_endpoint(
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> OrgRoleInvitationListResponse:
    """The organization's offers still waiting for an answer."""
    return OrgRoleInvitationListResponse(
        items=[
            OrgRoleInvitationRead(
                id=invitation.id,
                email=invitation.email,
                roles=invitation.roles,
                invited_by_name=inviter.full_name if inviter else None,
                sent_at=invitation.sent_at,
                expires_at=invitation.expires_at,
            )
            for invitation, inviter in service.list_for_organization(session, organization_id)
        ]
    )


@router.delete(
    "/{organization_id}/role-invitations/{invitation_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def withdraw_role_invitation_endpoint(
    invitation_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Withdraw an offer."""
    service.withdraw(session, organization_id, invitation_id, user)


@me_router.get("/mine", response_model=MyRoleInvitationListResponse)
def list_my_role_invitations_endpoint(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MyRoleInvitationListResponse:
    """The organizations offering the signed-in account a role."""
    return MyRoleInvitationListResponse(
        items=[
            MyRoleInvitationRead(
                id=invitation.id,
                organization_id=organization.id,
                organization_name=organization.name,
                organization_domain=organization.domain,
                roles=invitation.roles,
                invited_by_name=inviter.full_name if inviter else None,
                sent_at=invitation.sent_at,
                expires_at=invitation.expires_at,
            )
            for invitation, organization, inviter in service.list_mine(session, user)
        ]
    )


@me_router.post(
    "/{invitation_id}/accept",
    response_model=RoleInvitationAcceptResponse,
    dependencies=[Depends(verify_csrf)],
)
def accept_role_invitation_endpoint(
    invitation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RoleInvitationAcceptResponse:
    """Accept an offer: its roles are granted."""
    organization, roles = service.accept(session, user, invitation_id)
    return RoleInvitationAcceptResponse(organization_id=organization.id, roles=roles)


@me_router.post("/{invitation_id}/decline", status_code=204, dependencies=[Depends(verify_csrf)])
def decline_role_invitation_endpoint(
    invitation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Decline an offer."""
    service.decline(session, user, invitation_id)
