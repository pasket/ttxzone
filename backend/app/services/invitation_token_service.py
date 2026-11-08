import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.core.security import require_not_archived, require_ttx_role
from app.models import (
    TTX,
    AccessRequestStatus,
    InvitationToken,
    InvitationTokenRedemption,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
    User,
)
from app.schemas.invitation_token import (
    InvitationTokenCreateRequest,
    RedeemAccountCreate,
    TokenRedemptionRead,
)
from app.services.security_policy_service import check_new_password, set_password

logger = logging.getLogger(__name__)
# Onboarding sub-flow (redeeming a token, whether or not it creates a new
# account) routes through auth.log instead -- create/revoke/list below are
# admin actions and stay on the module logger above.
auth_logger = logging.getLogger(AUTH_LOGGER_NAME)

# How long after a rejection the same person can't ask to join that exercise
# again, with any code: without it a rejected user could re-apply at once.
REJECTION_COOLDOWN = timedelta(hours=24)


def create_invitation_token(
    session: Session, ttx: TTX, creator: User, payload: InvitationTokenCreateRequest
) -> InvitationToken:
    invitation_token = InvitationToken(
        token=secrets.token_urlsafe(32),
        ttx_id=ttx.id,
        role=payload.role,
        description=payload.description,
        created_by_id=creator.id,
        expires_at=payload.expires_at,
        max_uses=payload.max_uses,
    )
    session.add(invitation_token)
    session.commit()
    session.refresh(invitation_token)

    logger.info(
        "Invitation token created for TTX %s by user %s (role=%s).",
        ttx.id,
        creator.id,
        payload.role,
    )
    return invitation_token


def _invalid_or_expired_token() -> AppException:
    # No direct logger call here on purpose -- the AppException below is
    # what main.py's handler logs (see logger_name), so a rejection is
    # one log line. The client-facing message stays deliberately generic
    # across all four rejection reasons (not-found/expired/exhausted/
    # revoked), so there's no per-reason detail worth a second log line.
    return AppException(
        "INVALID_OR_EXPIRED_TOKEN",
        "This invitation token is invalid or has expired.",
        400,
        log_level=logging.WARNING,
        logger_name=AUTH_LOGGER_NAME,
    )


def redeem_invitation_token(
    session: Session,
    token_plaintext: str,
    account: RedeemAccountCreate | None,
    current_user: User | None,
) -> tuple[TTXAccessRequest, User, bool]:
    token = session.exec(
        select(InvitationToken).where(InvitationToken.token == token_plaintext).with_for_update()
    ).first()
    if token is None:
        raise _invalid_or_expired_token()
    # Timestamps are aware UTC end to end (SQLModel's UTCDateTime).
    if token.expires_at < datetime.now(UTC):
        raise _invalid_or_expired_token()
    if token.max_uses is not None and token.redemption_count >= token.max_uses:
        raise _invalid_or_expired_token()
    if token.revoked_at is not None:
        raise _invalid_or_expired_token()
    require_not_archived(session.get(TTX, token.ttx_id))

    created_new_account = False
    if current_user is not None:
        user = current_user
    else:
        if account is None:
            # Only a signed-in client redeems without account details, so
            # here its session has expired (the browser drops the cookie
            # with it): answer like any route needing a session, and the
            # client sends the user to sign in again.
            raise AppException(
                "NOT_AUTHENTICATED",
                "Sign in, or give account details, to redeem this token.",
                401,
                log_level=logging.WARNING,
                logger_name=AUTH_LOGGER_NAME,
            )
        email = account.email.lower()
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing is not None:
            raise AppException(
                "EMAIL_ALREADY_REGISTERED",
                "An account with this email already exists.",
                409,
                log_level=logging.WARNING,
                logger_name=AUTH_LOGGER_NAME,
            )
        check_new_password(session, account.password, email=email, full_name=account.full_name)
        user = User(email=email, full_name=account.full_name)
        set_password(session, user, account.password)
        session.flush()
        created_new_account = True

    existing_access = session.exec(
        select(TTXAccess).where(TTXAccess.user_id == user.id, TTXAccess.ttx_id == token.ttx_id)
    ).first()
    if existing_access is not None:
        raise AppException(
            "ALREADY_HAS_TTX_ACCESS",
            "You already have access to this TTX.",
            409,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )

    existing_request = session.exec(
        select(TTXAccessRequest).where(
            TTXAccessRequest.user_id == user.id,
            TTXAccessRequest.ttx_id == token.ttx_id,
            # Only a pending one: an approved request whose TTXAccess is gone
            # (the Player left or was removed) mustn't keep them out --
            # holding access is checked just above.
            TTXAccessRequest.status == AccessRequestStatus.PENDING,
        )
    ).first()
    if existing_request is not None:
        raise AppException(
            "ACCESS_REQUEST_ALREADY_PENDING",
            "You already have a pending request for this TTX.",
            409,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )

    recently_rejected = session.exec(
        select(TTXAccessRequest).where(
            TTXAccessRequest.user_id == user.id,
            TTXAccessRequest.ttx_id == token.ttx_id,
            TTXAccessRequest.status == AccessRequestStatus.REJECTED,
            TTXAccessRequest.decided_at > datetime.now(UTC) - REJECTION_COOLDOWN,
        )
    ).first()
    if recently_rejected is not None:
        raise AppException(
            "ACCESS_REQUEST_RECENTLY_REJECTED",
            "Your request for this TTX was rejected recently. Try again in 24 hours.",
            409,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )

    access_request = TTXAccessRequest(
        user_id=user.id, ttx_id=token.ttx_id, role=token.role, invitation_token_id=token.id
    )
    session.add(access_request)
    session.add(InvitationTokenRedemption(invitation_token_id=token.id, user_id=user.id))
    token.redemption_count += 1
    session.add(token)

    session.commit()
    session.refresh(access_request)
    session.refresh(user)

    auth_logger.info(
        "User %s requested access to TTX %s (role=%s).",
        user.id,
        token.ttx_id,
        token.role,
    )
    return access_request, user, created_new_account


def revoke_invitation_token(session: Session, user: User, token_id: uuid.UUID) -> InvitationToken:
    token = session.get(InvitationToken, token_id)
    if token is None:
        raise AppException("TOKEN_NOT_FOUND", "Invitation token not found.", 404)

    ttx = session.get(TTX, token.ttx_id)
    require_ttx_role(session, user, ttx, (RoleEnum.PLANNER,))

    if token.revoked_at is None:
        token.revoked_at = datetime.now(UTC)
        session.add(token)
        session.commit()
        session.refresh(token)
        logger.info("Invitation token %s revoked by user %s.", token.id, user.id)

    return token


def list_invitation_tokens_for_ttx(
    session: Session,
    ttx_id: uuid.UUID,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name"] = "created_at",
    q: str | None = None,
) -> tuple[list[InvitationToken], dict[uuid.UUID, list[TokenRedemptionRead]], int]:
    where_clause = [InvitationToken.ttx_id == ttx_id]
    if q:
        where_clause.append(InvitationToken.description.ilike(f"%{q}%"))

    total = session.exec(
        select(func.count()).select_from(InvitationToken).where(*where_clause)
    ).one()

    sort_column = InvitationToken.description if sort_by == "name" else InvitationToken.created_at
    order = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    # description is nullable, so every NULL row forms one large tie group --
    # without the primary-key tiebreaker paginated queries have no stable
    # order among them at all.
    items = list(
        session.exec(
            select(InvitationToken)
            .where(*where_clause)
            .order_by(order, InvitationToken.id)
            .limit(limit)
            .offset(offset)
        )
    )

    page_ids = [token.id for token in items]
    redemptions_by_token: dict[uuid.UUID, list[TokenRedemptionRead]] = {}
    if page_ids:
        rows = session.exec(
            select(InvitationTokenRedemption, User)
            .join(User, User.id == InvitationTokenRedemption.user_id)
            .where(InvitationTokenRedemption.invitation_token_id.in_(page_ids))
        )
        for redemption, user in rows:
            redemptions_by_token.setdefault(redemption.invitation_token_id, []).append(
                TokenRedemptionRead(
                    user_id=user.id,
                    email=user.email,
                    full_name=user.full_name,
                    redeemed_at=redemption.redeemed_at,
                )
            )

    return items, redemptions_by_token, total
