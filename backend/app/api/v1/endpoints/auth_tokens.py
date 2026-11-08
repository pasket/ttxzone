"""Preferences -> AI assistant: the account's personal access tokens
(docs/features/ai-assistant.md). Managed with the cookie session; a token
itself only ever authenticates the MCP endpoint."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import (
    RequireRecentAuthentication,
    get_current_user,
    get_current_user_session,
    verify_csrf,
)
from app.models import PersonalAccessToken, User, UserSession
from app.schemas.assistant import (
    PersonalAccessTokenCreated,
    PersonalAccessTokenCreateRequest,
    PersonalAccessTokenListResponse,
    PersonalAccessTokenRead,
)
from app.services.assistant import switch, tokens

router = APIRouter(prefix="/auth/tokens", tags=["auth"])


def _read(token: PersonalAccessToken) -> PersonalAccessTokenRead:
    return PersonalAccessTokenRead(
        id=token.id,
        name=token.name,
        prefix=token.prefix,
        created_at=token.created_at,
        expires_at=token.expires_at,
        last_used_at=token.last_used_at,
        expired=token.expires_at <= datetime.now(UTC),
    )


@router.get("", response_model=PersonalAccessTokenListResponse)
def list_tokens_endpoint(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> PersonalAccessTokenListResponse:
    """The caller's personal access tokens."""
    return PersonalAccessTokenListResponse(
        items=[_read(t) for t in tokens.list_tokens(session, user)],
        enabled=switch.effective_enabled(session),
        disclaimer_version=switch.ASSISTANT_DISCLAIMER_VERSION,
        max_active=tokens.MAX_ACTIVE_TOKENS,
        expiry_days_choices=list(tokens.EXPIRY_DAYS_CHOICES),
    )


@router.post(
    "",
    response_model=PersonalAccessTokenCreated,
    status_code=201,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def create_token_endpoint(
    payload: PersonalAccessTokenCreateRequest,
    user: User = Depends(get_current_user),
    current: UserSession = Depends(get_current_user_session),
    session: Session = Depends(get_session),
) -> PersonalAccessTokenCreated:
    """Create a personal access token, shown only in this answer."""
    token, raw = tokens.create_token(
        session,
        user,
        current,
        name=payload.name,
        expires_in_days=payload.expires_in_days,
        acknowledge=payload.acknowledge,
        disclaimer_version=payload.disclaimer_version,
    )
    return PersonalAccessTokenCreated(**_read(token).model_dump(), token=raw)


@router.delete("/{token_id}", status_code=204, dependencies=[Depends(verify_csrf)])
def revoke_token_endpoint(
    token_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Revoke one of the caller's personal access tokens."""
    tokens.revoke_token(session, user, token_id)
