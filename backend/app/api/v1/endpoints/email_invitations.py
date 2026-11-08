"""Creator -> Players -> Invitations -> by email: personal invitations a
Planner sends to addresses (Planner-only, design), and the link each one
opens (public: its holder may have no account yet). See
email_invitation_service."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlmodel import Session

from app.core.db import get_session
from app.core.i18n import get_locale
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    get_current_user_optional,
    start_session,
    verify_csrf,
)
from app.models import TTX, EmailInvitation, Organization, RoleEnum, User
from app.schemas.email_invitation import (
    EmailInvitationAcceptRequest,
    EmailInvitationAcceptResponse,
    EmailInvitationCreateRequest,
    EmailInvitationCreateResponse,
    EmailInvitationListResponse,
    EmailInvitationOutcome,
    EmailInvitationPreview,
    EmailInvitationRead,
    EmailInvitationTokenRequest,
)
from app.services import email_invitation_service, legal_service
from app.services.auth_service import record_signup

router = APIRouter(prefix="/ttx", tags=["email-invitations"])
# The link's own routes: no exercise in the path, the token says which.
public_router = APIRouter(prefix="/email-invitations", tags=["email-invitations"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


def _read(invitation: EmailInvitation, inviter: User | None) -> EmailInvitationRead:
    return EmailInvitationRead(
        id=invitation.id,
        ttx_id=invitation.ttx_id,
        email=invitation.email,
        status=email_invitation_service.status_of(invitation),
        invited_by_name=inviter.full_name if inviter else None,
        created_at=invitation.created_at,
        sent_at=invitation.sent_at,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        revoked_at=invitation.revoked_at,
    )


@router.post(
    "/{ttx_id}/email-invitations",
    response_model=EmailInvitationCreateResponse,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def send_email_invitations_endpoint(
    payload: EmailInvitationCreateRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> EmailInvitationCreateResponse:
    """Invite people to the exercise as Players by email."""
    results = email_invitation_service.invite(session, ttx, user, payload.emails, locale)
    return EmailInvitationCreateResponse(
        results=[EmailInvitationOutcome(email=email, outcome=outcome) for email, outcome in results]
    )


@router.get("/{ttx_id}/email-invitations", response_model=EmailInvitationListResponse)
def list_email_invitations_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    sort_by: Literal["created_at", "name"] = Query("created_at"),
    q: str | None = Query(None, max_length=200),
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> EmailInvitationListResponse:
    """The exercise's email invitations."""
    rows, total = email_invitation_service.list_for_ttx(
        session, ttx.id, limit, offset, sort_dir, sort_by, q
    )
    return EmailInvitationListResponse(
        items=[_read(invitation, inviter) for invitation, inviter in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/{ttx_id}/email-invitations/{invitation_id}/resend",
    response_model=EmailInvitationRead,
    dependencies=[Depends(verify_csrf)],
)
def resend_email_invitation_endpoint(
    invitation_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> EmailInvitationRead:
    """Send an email invitation again."""
    invitation = email_invitation_service.resend(session, ttx, user, invitation_id, locale)
    return _read(invitation, user)


@router.delete(
    "/{ttx_id}/email-invitations/{invitation_id}",
    response_model=EmailInvitationRead,
    dependencies=[Depends(verify_csrf)],
)
def revoke_email_invitation_endpoint(
    invitation_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> EmailInvitationRead:
    """Revoke an email invitation."""
    invitation = email_invitation_service.revoke(session, ttx, invitation_id)
    return _read(invitation, session.get(User, invitation.invited_by_id))


@public_router.post("/preview", response_model=EmailInvitationPreview)
def preview_email_invitation_endpoint(
    payload: EmailInvitationTokenRequest, session: Session = Depends(get_session)
) -> EmailInvitationPreview:
    """What an email invitation's link grants, before accepting it."""
    invitation, ttx, organization, account_exists = email_invitation_service.preview(
        session, payload.token
    )
    return EmailInvitationPreview(
        organization_name=organization.name,
        ttx_name=ttx.name,
        email_hint=email_invitation_service.masked(invitation),
        account_exists=account_exists,
    )


@public_router.post("/accept", response_model=EmailInvitationAcceptResponse)
def accept_email_invitation_endpoint(
    payload: EmailInvitationAcceptRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> EmailInvitationAcceptResponse:
    """Accept an email invitation, creating the account when there is none."""
    if current_user is not None:
        verify_csrf(request)
    creates_account = current_user is None and payload.account is not None
    if creates_account:
        legal_service.require_signup_acceptance(session, payload.account.accepted_legal)

    invitation, user, created = email_invitation_service.accept(
        session, payload.token, current_user, payload.account
    )
    if created:
        legal_service.record_signup_acceptance(session, user, payload.account.accepted_legal)
        record_signup(session, user, "invitation")
        start_session(request, response, session, user)

    ttx = session.get(TTX, invitation.ttx_id)
    organization = session.get(Organization, ttx.organization_id)
    return EmailInvitationAcceptResponse(
        ttx_id=ttx.id,
        ttx_name=ttx.name,
        organization_id=ttx.organization_id,
        organization_name=organization.name,
        created_account=created,
    )
