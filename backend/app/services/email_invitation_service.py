"""Personal invitations to be a Player of an exercise, sent by email
(docs/features/invitations-and-enrollment.md -> Email invitations).

A Planner types addresses; each gets a link of its own. Opening it proves
the holder reads that mailbox, so accepting grants the exercise at once --
no access request, no approval -- but only to the account with that
address (created on the spot when there is none). Offered only while the
deployment sends email and knows its public address
(account_email_service.available). The link carries a random token in its
fragment; the database keeps its SHA-256 only.
"""

import hashlib
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.core.security import require_not_archived
from app.models import TTX, EmailInvitation, Organization, RoleEnum, TTXAccess, User
from app.schemas.email_invitation import EmailInvitationAccountCreate
from app.services import account_email_service, email_service
from app.services.email_mfa_service import masked_address
from app.services.security_policy_service import check_new_password, set_password

logger = logging.getLogger(__name__)
auth_logger = logging.getLogger(AUTH_LOGGER_NAME)

INVITATION_TTL = timedelta(days=14)
MAX_ADDRESSES_PER_REQUEST = 50
# The SPA's page that opens the link (frontend/src/App.tsx).
_PAGE = "/join"

SendOutcome = Literal["sent", "resent", "already_player", "on_team", "dropped"]
InvitationStatus = Literal["pending", "accepted", "expired", "revoked"]


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _unavailable() -> AppException:
    return AppException(
        "EMAIL_INVITATIONS_UNAVAILABLE",
        "This deployment doesn't send email invitations.",
        409,
        log_level=logging.WARNING,
    )


def _invalid() -> AppException:
    # The same answer whatever went wrong (unknown, expired, revoked,
    # already used): the link is all the holder has.
    return AppException(
        "INVITATION_INVALID",
        "This invitation is invalid or has expired.",
        400,
        log_level=logging.WARNING,
        logger_name=AUTH_LOGGER_NAME,
    )


def status_of(invitation: EmailInvitation, now: datetime | None = None) -> InvitationStatus:
    if invitation.accepted_at is not None:
        return "accepted"
    if invitation.revoked_at is not None:
        return "revoked"
    if invitation.expires_at <= (now or datetime.now(UTC)):
        return "expired"
    return "pending"


def _send(
    session: Session,
    invitation: EmailInvitation,
    ttx: TTX,
    inviter: User,
    locale: str | None,
) -> bool:
    """A new link for this invitation, in the caller's transaction (the
    previous one stops working). False when the outbox dropped the
    message (the address's hourly limit): nothing changes then."""
    token = secrets.token_urlsafe(32)
    organization = session.get(Organization, ttx.organization_id)
    params = {
        "inviter": inviter.full_name,
        "organization": organization.name if organization else "",
        "exercise": ttx.name,
        "link": f"{settings.PUBLIC_BASE_URL}{_PAGE}#token={token}",
        "days": INVITATION_TTL.days,
    }
    if email_service.queue(session, invitation.email, "email_invitation", params, locale) is None:
        return False
    now = datetime.now(UTC)
    invitation.token_hash = _hash(token)
    invitation.invited_by_id = inviter.id
    invitation.sent_at = now
    invitation.expires_at = now + INVITATION_TTL
    invitation.revoked_at = None
    session.add(invitation)
    return True


def invite(
    session: Session, ttx: TTX, inviter: User, emails: list[str], locale: str | None
) -> list[tuple[str, SendOutcome]]:
    """Sends an invitation to each address and commits. Each address gets
    its outcome; someone already in the exercise gets nothing."""
    if not account_email_service.available(session):
        raise _unavailable()
    addresses: list[str] = []
    for raw in emails:
        address = email_service.normalize_address(raw).lower()
        if address not in addresses:
            addresses.append(address)

    seats = {
        user.email: access.role
        for access, user in session.exec(
            select(TTXAccess, User)
            .join(User, col(User.id) == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == ttx.id, col(User.email).in_(addresses))
        )
    }
    live = {
        invitation.email: invitation
        for invitation in session.exec(
            select(EmailInvitation)
            .where(
                EmailInvitation.ttx_id == ttx.id,
                col(EmailInvitation.email).in_(addresses),
                col(EmailInvitation.accepted_at).is_(None),
            )
            .with_for_update()
        )
    }

    results: list[tuple[str, SendOutcome]] = []
    for address in addresses:
        role = seats.get(address)
        if role is not None:
            results.append((address, "already_player" if role == RoleEnum.PLAYER else "on_team"))
            continue
        invitation = live.get(address)
        outcome: SendOutcome = "resent" if invitation is not None else "sent"
        if invitation is None:
            # A placeholder hash until _send gives it its link.
            invitation = EmailInvitation(
                ttx_id=ttx.id,
                email=address,
                token_hash=_hash(secrets.token_urlsafe(32)),
                invited_by_id=inviter.id,
                expires_at=datetime.now(UTC),
            )
        if not _send(session, invitation, ttx, inviter, locale):
            outcome = "dropped"
        results.append((address, outcome))
    session.commit()
    logger.info(
        "Email invitations for TTX %s by user %s: %d sent of %d addresses.",
        ttx.id,
        inviter.id,
        sum(1 for _, outcome in results if outcome in ("sent", "resent")),
        len(results),
    )
    return results


def resend(
    session: Session, ttx: TTX, inviter: User, invitation_id: uuid.UUID, locale: str | None
) -> EmailInvitation:
    if not account_email_service.available(session):
        raise _unavailable()
    invitation = _get(session, ttx, invitation_id, lock=True)
    if invitation.accepted_at is not None:
        raise AppException(
            "INVITATION_ALREADY_ACCEPTED",
            "This invitation has already been accepted.",
            409,
            log_level=logging.WARNING,
        )
    if not _send(session, invitation, ttx, inviter, locale):
        raise AppException(
            "INVITATION_RATE_LIMITED",
            "This address has received too many messages. Try again in an hour.",
            429,
            log_level=logging.WARNING,
        )
    session.commit()
    session.refresh(invitation)
    return invitation


def revoke(session: Session, ttx: TTX, invitation_id: uuid.UUID) -> EmailInvitation:
    """Idempotent; an accepted invitation is history and stays as it is."""
    invitation = _get(session, ttx, invitation_id, lock=True)
    if invitation.accepted_at is None and invitation.revoked_at is None:
        invitation.revoked_at = datetime.now(UTC)
        session.add(invitation)
        session.commit()
        session.refresh(invitation)
    return invitation


def _get(
    session: Session, ttx: TTX, invitation_id: uuid.UUID, lock: bool = False
) -> EmailInvitation:
    query = select(EmailInvitation).where(
        EmailInvitation.id == invitation_id, EmailInvitation.ttx_id == ttx.id
    )
    invitation = session.exec(query.with_for_update() if lock else query).first()
    if invitation is None:
        raise AppException(
            "INVITATION_NOT_FOUND",
            "Invitation not found.",
            404,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    return invitation


def list_for_ttx(
    session: Session,
    ttx_id: uuid.UUID,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name"] = "created_at",
    q: str | None = None,
) -> tuple[list[tuple[EmailInvitation, User | None]], int]:
    """Each invitation with whoever sent it last, newest first by default;
    `name` sorts by the address."""
    where_clause = [EmailInvitation.ttx_id == ttx_id]
    if q:
        where_clause.append(col(EmailInvitation.email).ilike(f"%{q}%"))
    total = session.exec(
        select(func.count()).select_from(EmailInvitation).where(*where_clause)
    ).one()
    sort_column = EmailInvitation.email if sort_by == "name" else EmailInvitation.sent_at
    order = col(sort_column).desc() if sort_dir == "desc" else col(sort_column).asc()
    rows = session.exec(
        select(EmailInvitation, User)
        .join(User, col(User.id) == EmailInvitation.invited_by_id, isouter=True)
        .where(*where_clause)
        .order_by(order, EmailInvitation.id)
        .limit(limit)
        .offset(offset)
    )
    return [(invitation, user) for invitation, user in rows], total


def accepted_player_ids(session: Session, ttx_id: uuid.UUID) -> set[uuid.UUID]:
    """The accounts that joined this exercise through an email invitation."""
    return {
        user_id
        for user_id in session.exec(
            select(EmailInvitation.accepted_user_id).where(
                EmailInvitation.ttx_id == ttx_id,
                col(EmailInvitation.accepted_user_id).is_not(None),
            )
        )
        if user_id is not None
    }


# --- The link ---------------------------------------------------------------


def _live(session: Session, token: str, lock: bool = False) -> EmailInvitation:
    query = select(EmailInvitation).where(EmailInvitation.token_hash == _hash(token))
    invitation = session.exec(query.with_for_update() if lock else query).first()
    if invitation is None or status_of(invitation) != "pending":
        raise _invalid()
    # An archived exercise takes no one new.
    ttx = session.get(TTX, invitation.ttx_id)
    if ttx is not None:
        require_not_archived(ttx)
    return invitation


def preview(session: Session, token: str) -> tuple[EmailInvitation, TTX, Organization, bool]:
    """What the link opens, without spending it: the exercise, its
    organization, and whether the address already has an account."""
    invitation = _live(session, token)
    ttx = session.get(TTX, invitation.ttx_id)
    organization = session.get(Organization, ttx.organization_id) if ttx else None
    if ttx is None or organization is None:
        raise _invalid()
    account_exists = (
        session.exec(select(User.id).where(User.email == invitation.email)).first() is not None
    )
    return invitation, ttx, organization, account_exists


def masked(invitation: EmailInvitation) -> str:
    return masked_address(invitation.email)


def accept(
    session: Session,
    token: str,
    current_user: User | None,
    account: EmailInvitationAccountCreate | None,
) -> tuple[EmailInvitation, User, bool]:
    """Grants the exercise to the invited account and commits. Signed in,
    it must be the account with the invited address; signed out, a new
    account is created with that address. Returns the invitation, the
    account and whether it was created here (the caller records the
    signup, its legal acceptances and its session)."""
    invitation = _live(session, token, lock=True)
    now = datetime.now(UTC)

    created = False
    if current_user is not None:
        if current_user.email.lower() != invitation.email:
            raise AppException(
                "INVITATION_OTHER_ACCOUNT",
                "This invitation is for another email address. Sign out and use that one.",
                409,
                log_level=logging.WARNING,
                logger_name=AUTH_LOGGER_NAME,
            )
        user = current_user
    else:
        if account is None:
            raise AppException(
                "NOT_AUTHENTICATED",
                "Sign in, or give account details, to accept this invitation.",
                401,
                log_level=logging.WARNING,
                logger_name=AUTH_LOGGER_NAME,
            )
        if session.exec(select(User.id).where(User.email == invitation.email)).first():
            raise AppException(
                "EMAIL_ALREADY_REGISTERED",
                "An account with this email already exists.",
                409,
                log_level=logging.WARNING,
                logger_name=AUTH_LOGGER_NAME,
            )
        check_new_password(
            session, account.password, email=invitation.email, full_name=account.full_name
        )
        user = User(email=invitation.email, full_name=account.full_name)
        set_password(session, user, account.password)
        session.flush()
        created = True

    # The link reached the mailbox: the address is confirmed (again).
    user.email_verified_at = now
    user.email_reconfirm_deadline = None
    session.add(user)

    access = session.exec(
        select(TTXAccess).where(TTXAccess.user_id == user.id, TTXAccess.ttx_id == invitation.ttx_id)
    ).first()
    if access is None:
        session.add(
            TTXAccess(
                user_id=user.id,
                ttx_id=invitation.ttx_id,
                role=RoleEnum.PLAYER,
                granted_by_id=invitation.invited_by_id,
            )
        )
    elif access.role != RoleEnum.PLAYER:
        # On the team since the invitation went out: one seat per exercise.
        raise AppException(
            "ALREADY_HAS_TTX_ACCESS",
            "You already have access to this TTX.",
            409,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )

    invitation.accepted_at = now
    invitation.accepted_user_id = user.id
    session.add(invitation)
    session.commit()
    session.refresh(invitation)
    session.refresh(user)
    auth_logger.info(
        "User %s joined TTX %s as a Player through an email invitation.",
        user.id,
        invitation.ttx_id,
    )
    return invitation, user, created


def forget_address(session: Session, user: User) -> None:
    """When an account is deleted (in the caller's transaction): invitations
    still waiting for its address go, accepted ones keep the account's
    link and lose the address."""
    for invitation in session.exec(
        select(EmailInvitation).where(
            (EmailInvitation.email == user.email.lower())
            | (EmailInvitation.accepted_user_id == user.id)
        )
    ):
        if invitation.accepted_at is None:
            session.delete(invitation)
        else:
            invitation.email = f"deleted-{user.id}@deleted.ttx-zone.invalid"
            session.add(invitation)


def delete_for_ttxs(session: Session, ttx_ids: list[uuid.UUID]) -> None:
    """Part of the exercise delete (ttx_service.delete_exercises)."""
    for invitation in session.exec(
        select(EmailInvitation).where(col(EmailInvitation.ttx_id).in_(ttx_ids))
    ):
        session.delete(invitation)
