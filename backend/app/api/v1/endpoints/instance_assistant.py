"""Platform -> AI assistant: the instance switch and the recent use of the
MCP endpoint (docs/features/ai-assistant.md)."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import RequireRecentAuthentication, require_instance_admin, verify_csrf
from app.models import User
from app.schemas.assistant import (
    AssistantCallerRead,
    AssistantCallListResponse,
    AssistantCallRead,
    AssistantSettingsRead,
    AssistantSettingsUpdateRequest,
)
from app.services.assistant import calls, switch, tokens

router = APIRouter(prefix="/instance/assistant", tags=["instance"])


def _read(session: Session) -> AssistantSettingsRead:
    return AssistantSettingsRead(
        enabled=switch.effective_enabled(session),
        pinned_by_env=switch.pinned_by_env(),
        disclaimer_version=switch.ASSISTANT_DISCLAIMER_VERSION,
        active_tokens=tokens.active_token_count(session),
    )


@router.get("", response_model=AssistantSettingsRead)
def get_assistant_settings_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> AssistantSettingsRead:
    """The AI assistant's switch for this instance."""
    return _read(session)


@router.put(
    "",
    response_model=AssistantSettingsRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def save_assistant_settings_endpoint(
    payload: AssistantSettingsUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> AssistantSettingsRead:
    """Recorded, with step-up. Turning it off stops every token at once
    (they stay, and work again if it's turned back on before they expire)."""
    switch.save_enabled(session, admin, payload.enabled)
    return _read(session)


@router.get("/calls", response_model=AssistantCallListResponse)
def recent_calls_endpoint(
    user_id: uuid.UUID | None = Query(None),
    limit: int = Query(calls.RECENT_CALLS_MAX, ge=1, le=calls.RECENT_CALLS_MAX),
    _: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> AssistantCallListResponse:
    """The latest tool calls: who, through which token, which tool, about
    which exercise, how it ended and how long it took -- never what was
    asked or answered (it isn't kept)."""
    return AssistantCallListResponse(
        items=[
            AssistantCallRead(
                id=call.id,
                created_at=call.created_at,
                user_id=user.id,
                user_name=user.full_name,
                user_email=user.email,
                token_name=token.name,
                token_prefix=token.prefix,
                tool=call.tool,
                ttx_id=call.ttx_id,
                ttx_code=ttx.code if ttx else None,
                ttx_name=ttx.name if ttx else None,
                organization_name=organization.name if organization else None,
                outcome=call.outcome,
                duration_ms=call.duration_ms,
            )
            for call, user, token, ttx, organization in calls.recent(session, user_id, limit)
        ],
        callers=[
            AssistantCallerRead(user_id=u.id, name=u.full_name, email=u.email)
            for u in calls.callers(session)
        ],
        retention_days=calls.ASSISTANT_CALL_RETENTION_DAYS,
    )
