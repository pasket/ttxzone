import uuid
from contextlib import nullcontext

from fastapi import APIRouter, Depends, Request, Response
from sqlmodel import Session

from app.core.db import get_session
from app.core.i18n import get_locale
from app.core.security import (
    client_address,
    get_current_user,
    get_current_user_optional,
    start_session,
    verify_csrf,
)
from app.models import TTX, Organization, User
from app.schemas.invitation_token import (
    InvitationTokenAuditRead,
    InvitationTokenRedeemRequest,
    InvitationTokenRedeemResponse,
    InvitationTokenRevokeResponse,
)
from app.schemas.ttx_tag import TTXTagAssignmentRequest, TTXTagRead
from app.services import account_email_service, legal_service
from app.services.auth_service import record_signup
from app.services.invitation_token_service import redeem_invitation_token, revoke_invitation_token
from app.services.login_throttle_service import guarded_signup
from app.services.ttx_tag_service import set_invitation_token_tags

router = APIRouter(prefix="/invitation-tokens", tags=["invitation-tokens"])


@router.post("/redeem", response_model=InvitationTokenRedeemResponse)
def redeem_invitation_token_endpoint(
    payload: InvitationTokenRedeemRequest,
    response: Response,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
    locale: str = Depends(get_locale),
) -> InvitationTokenRedeemResponse:
    """Join an exercise with an invitation token, creating the account if asked."""
    if current_user is not None:
        verify_csrf(request)
    creates_account = current_user is None and payload.account is not None
    if creates_account:
        legal_service.require_signup_acceptance(session, payload.account.accepted_legal)

    # Only the account details carry an email anyone can type.
    guard = (
        guarded_signup(session, payload.account.email, client_address(request))
        if creates_account
        else nullcontext()
    )
    with guard:
        access_request, user, created_new_account = redeem_invitation_token(
            session, payload.token, payload.account, current_user
        )

    if created_new_account:
        legal_service.record_signup_acceptance(session, user, payload.account.accepted_legal)
        account_email_service.start_verification(session, user, locale)
        record_signup(session, user, "invitation")
        start_session(request, response, session, user)

    ttx = session.get(TTX, access_request.ttx_id)
    organization = session.get(Organization, ttx.organization_id)

    return InvitationTokenRedeemResponse(
        ttx_id=access_request.ttx_id,
        ttx_name=ttx.name,
        organization_name=organization.name,
        organization_domain=organization.domain,
        role=access_request.role,
        status="pending",
        user=user,
    )


@router.delete(
    "/{token_id}",
    response_model=InvitationTokenRevokeResponse,
    dependencies=[Depends(verify_csrf)],
)
def revoke_invitation_token_endpoint(
    token_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> InvitationTokenRevokeResponse:
    """Revoke an invitation token."""
    token = revoke_invitation_token(session, user, token_id)
    return InvitationTokenRevokeResponse(id=token.id, revoked_at=token.revoked_at)


@router.put(
    "/{token_id}/tags", response_model=InvitationTokenAuditRead, dependencies=[Depends(verify_csrf)]
)
def set_invitation_token_tags_endpoint(
    token_id: uuid.UUID,
    payload: TTXTagAssignmentRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> InvitationTokenAuditRead:
    """Set the tags a Player gets from this invitation token."""
    token, tags = set_invitation_token_tags(session, user, token_id, payload.tag_ids)
    return InvitationTokenAuditRead(
        id=token.id,
        ttx_id=token.ttx_id,
        role=token.role,
        description=token.description,
        token=token.token,
        expires_at=token.expires_at,
        max_uses=token.max_uses,
        redemption_count=token.redemption_count,
        revoked_at=token.revoked_at,
        created_at=token.created_at,
        created_by_id=token.created_by_id,
        # not fetched here -- caller re-fetches the full list after closing the tag modal
        redemptions=[],
        tags=[TTXTagRead.model_validate(t) for t in tags],
    )
