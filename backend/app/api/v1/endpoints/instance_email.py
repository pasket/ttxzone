"""Platform -> Email: how the deployment sends email (docs/architecture/email.md)."""

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.i18n import get_locale
from app.core.security import RequireRecentAuthentication, require_instance_admin, verify_csrf
from app.models import User
from app.schemas.email import (
    EmailOutboxListResponse,
    EmailOutboxRead,
    EmailReconfirmationRead,
    EmailReconfirmationUpdateRequest,
    EmailSettingsRead,
    EmailSettingsUpdateRequest,
    EmailTestRead,
    EmailTestRequest,
)
from app.services import account_email_service, email_service

router = APIRouter(prefix="/instance/email", tags=["instance"])


def _settings_read(session: Session) -> EmailSettingsRead:
    stats = email_service.outbox_stats(session)
    common = {
        "active": email_service.is_enabled(session),
        "pinned_by_env": email_service.pinned_by_env(),
        "allow_insecure": settings.EMAIL_ALLOW_INSECURE,
        "pending": stats.pending,
        "failed": stats.failed,
        "last_sent_at": stats.last_sent_at,
        "last_failed_at": stats.last_failed_at,
        "last_error": stats.last_error,
    }
    if email_service.pinned_by_env():
        smtp = settings.EMAIL_TRANSPORT == "smtp"
        return EmailSettingsRead(
            **common,
            configured=True,
            enabled=True,
            transport=settings.EMAIL_TRANSPORT,
            from_address=settings.EMAIL_FROM_ADDRESS,
            from_name=settings.EMAIL_FROM_NAME,
            reply_to=settings.EMAIL_REPLY_TO,
            smtp_host=settings.SMTP_HOST if smtp else None,
            smtp_port=settings.SMTP_PORT if smtp else None,
            smtp_security=settings.SMTP_SECURITY if smtp else None,
            smtp_username=settings.SMTP_USERNAME if smtp else None,
            has_password=smtp and settings.SMTP_PASSWORD is not None,
        )
    row = email_service.get_settings_row(session)
    if row is None:
        return EmailSettingsRead(**common, configured=False)
    return EmailSettingsRead(
        **common,
        configured=True,
        enabled=row.enabled,
        transport=row.transport,
        from_address=row.from_address,
        from_name=row.from_name,
        reply_to=row.reply_to,
        smtp_host=row.smtp_host,
        smtp_port=row.smtp_port,
        smtp_security=row.smtp_security,  # type: ignore[arg-type]
        smtp_username=row.smtp_username,
        has_password=row.smtp_password_encrypted is not None,
        password_readable=email_service.stored_password_readable(row),
        updated_at=row.updated_at,
    )


@router.get("", response_model=EmailSettingsRead)
def get_email_settings_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> EmailSettingsRead:
    """The outgoing email settings."""
    return _settings_read(session)


@router.put(
    "",
    response_model=EmailSettingsRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def save_email_settings_endpoint(
    payload: EmailSettingsUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> EmailSettingsRead:
    """Recorded (without the password), with step-up: whoever controls the
    mail server reads every message the deployment sends."""
    email_service.save_settings(
        session,
        admin,
        enabled=payload.enabled,
        from_address=payload.from_address,
        from_name=payload.from_name,
        reply_to=payload.reply_to or None,
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port,
        smtp_security=payload.smtp_security,
        smtp_username=payload.smtp_username,
        smtp_password=payload.smtp_password,
    )
    return _settings_read(session)


@router.delete(
    "",
    status_code=204,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def delete_email_settings_endpoint(
    admin: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> None:
    """Remove the outgoing email settings stored from Platform."""
    email_service.delete_settings(session, admin)


@router.post(
    "/test",
    response_model=EmailTestRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def send_test_email_endpoint(
    payload: EmailTestRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> EmailTestRead:
    """Sends a test message now (in the administrator's language) and says
    how the server answered. Recorded; a few per minute at most."""
    to = payload.to or admin.email
    ok, error = email_service.send_test(session, admin, to, locale)
    return EmailTestRead(ok=ok, to=email_service.normalize_address(to), error=error)


@router.get("/outbox", response_model=EmailOutboxListResponse)
def list_outbox_endpoint(
    status: email_service.OutboxStatus | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> EmailOutboxListResponse:
    """The outgoing messages and their state."""
    rows, total = email_service.list_outbox(session, status, limit, offset)
    return EmailOutboxListResponse(
        items=[EmailOutboxRead.model_validate(row, from_attributes=True) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
        retention_days=email_service.EMAIL_RETENTION_DAYS,
    )


def _reconfirmation_read(session: Session) -> EmailReconfirmationRead:
    return EmailReconfirmationRead(
        days=account_email_service.reconfirmation_days(session),
        pinned_by_env=account_email_service.reconfirmation_pinned_by_env(),
        grace_days=account_email_service.RECONFIRMATION_GRACE.days,
    )


@router.get("/reconfirmation", response_model=EmailReconfirmationRead)
def get_email_reconfirmation_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> EmailReconfirmationRead:
    """The periodic email reconfirmation rule."""
    return _reconfirmation_read(session)


@router.put(
    "/reconfirmation",
    response_model=EmailReconfirmationRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def save_email_reconfirmation_endpoint(
    payload: EmailReconfirmationUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> EmailReconfirmationRead:
    """Recorded, with step-up: it can hold every account at a confirmation
    screen."""
    account_email_service.save_reconfirmation_days(session, admin, payload.days)
    return _reconfirmation_read(session)
