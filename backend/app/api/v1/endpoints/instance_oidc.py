"""Platform -> Single sign-on: the deployment's OpenID Connect provider
(docs/architecture/sso.md)."""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import get_session
from app.core.security import RequireRecentAuthentication, require_instance_admin, verify_csrf
from app.models import ExternalIdentity, User
from app.schemas.oidc import OidcSettingsRead, OidcSettingsUpdateRequest, OidcTestRead
from app.services import oidc_service, platform_audit_service

router = APIRouter(prefix="/instance/oidc", tags=["instance"])


def _settings_read(session: Session) -> OidcSettingsRead:
    common = {
        "active": oidc_service.effective_config(session) is not None,
        "pinned_by_env": oidc_service.pinned_by_env(),
        "redirect_uri": oidc_service.redirect_uri(),
        "linked_accounts": session.exec(select(func.count()).select_from(ExternalIdentity)).one(),
    }
    if oidc_service.pinned_by_env():
        kind = settings.OIDC_PROVIDER or "generic"
        return OidcSettingsRead(
            **common,
            configured=True,
            enabled=True,
            provider_kind=kind,
            display_name=settings.OIDC_DISPLAY_NAME or oidc_service.default_display_name(kind),
            entra_tenant_id=settings.OIDC_ENTRA_TENANT_ID if kind == "entra" else None,
            issuer_url=settings.OIDC_ISSUER_URL if kind == "generic" else None,
            client_id=settings.OIDC_CLIENT_ID,
            allow_jit=settings.OIDC_ALLOW_JIT,
            trust_provider_mfa=settings.OIDC_TRUST_PROVIDER_MFA,
            has_client_secret=settings.OIDC_CLIENT_SECRET is not None,
        )
    row = oidc_service.get_settings_row(session)
    if row is None:
        return OidcSettingsRead(**common, configured=False)
    return OidcSettingsRead(
        **common,
        configured=True,
        enabled=row.enabled,
        provider_kind=row.provider_kind,  # type: ignore[arg-type]
        display_name=row.display_name,
        entra_tenant_id=row.entra_tenant_id,
        issuer_url=row.issuer_url,
        client_id=row.client_id,
        allow_jit=row.allow_jit,
        trust_provider_mfa=row.trust_provider_mfa,
        has_client_secret=row.client_secret_encrypted is not None,
        client_secret_readable=oidc_service.stored_secret_readable(row),
        updated_at=row.updated_at,
    )


@router.get("", response_model=OidcSettingsRead)
def get_oidc_settings_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> OidcSettingsRead:
    """The single sign-on settings."""
    return _settings_read(session)


@router.put(
    "",
    response_model=OidcSettingsRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def save_oidc_settings_endpoint(
    payload: OidcSettingsUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> OidcSettingsRead:
    """Recorded (without the secret), with step-up: whoever chooses the
    provider chooses who can sign in."""
    oidc_service.save_settings(
        session,
        admin,
        enabled=payload.enabled,
        provider_kind=payload.provider_kind,
        display_name=payload.display_name,
        entra_tenant_id=payload.entra_tenant_id,
        issuer_url=payload.issuer_url,
        client_id=payload.client_id,
        client_secret=payload.client_secret,
        allow_jit=payload.allow_jit,
        trust_provider_mfa=payload.trust_provider_mfa,
    )
    return _settings_read(session)


@router.delete(
    "",
    status_code=204,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def delete_oidc_settings_endpoint(
    admin: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> None:
    """Remove the single sign-on settings stored from Platform."""
    oidc_service.delete_settings(session, admin)


@router.post(
    "/test",
    response_model=OidcTestRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def test_oidc_endpoint(
    admin: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> OidcTestRead:
    """Fetches the provider's metadata and signing keys now and says how
    it went (no one signs in). Recorded."""
    config = oidc_service.configured_config(session)
    if config is None:
        result = OidcTestRead(ok=False, error="not_configured")
    else:
        try:
            oidc_service.check_provider(config)
            result = OidcTestRead(ok=True)
        except oidc_service.OidcError as exc:
            result = OidcTestRead(ok=False, error=exc.reason, detail=exc.detail)
    platform_audit_service.record(
        session,
        admin,
        "sso.test",
        "instance",
        details={"ok": result.ok, "error": result.error},
    )
    return result
