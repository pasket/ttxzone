import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

# The one row OidcSettings ever holds.
OIDC_SETTINGS_ID = 1


class OidcSettings(SQLModel, table=True):
    """The single sign-on provider, as an instance administrator set it in
    Platform -> Single sign-on. Ignored while the environment pins it
    (OIDC_PROVIDER in Settings) -- see oidc_service.effective_config. The
    client secret is stored encrypted (core/crypto.py) and never returned
    by the API."""

    __tablename__ = "oidc_settings"

    id: int = Field(default=OIDC_SETTINGS_ID, primary_key=True)
    # Off keeps the configuration (secret included) but hides the button.
    enabled: bool = Field(default=True)
    # "entra" (Microsoft Entra ID, one tenant) or "generic" (any provider
    # by its issuer URL).
    provider_kind: str = Field(default="entra", max_length=16)
    display_name: str = Field(max_length=60)
    entra_tenant_id: str | None = Field(default=None, max_length=36)
    issuer_url: str | None = Field(default=None, max_length=500)
    client_id: str = Field(max_length=255)
    client_secret_encrypted: str | None = Field(default=None, max_length=2000)
    allow_jit: bool = Field(default=False)
    trust_provider_mfa: bool = Field(default=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")


class OidcLoginState(SQLModel, table=True):
    """One trip to the provider and back, in flight: what the callback
    needs to finish it and checks it against. Single use (deleted when the
    callback reads it) and short-lived (oidc_service.STATE_TTL). Bound to
    the browser that started it by a cookie whose hash is kept here, so a
    callback URL can't be replayed in someone else's browser (login CSRF).
    The PKCE verifier is kept as is: on its own -- without the code the
    provider only hands to that browser -- it opens nothing."""

    __tablename__ = "oidc_login_state"

    state: str = Field(primary_key=True, max_length=64)
    nonce: str = Field(max_length=64)
    code_verifier: str = Field(max_length=128)
    browser_binding_hash: str = Field(max_length=64)
    # "login", "step_up" or "link".
    purpose: str = Field(max_length=16)
    # For step_up and link: the account and the session asking.
    user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id", index=True)
    session_id: uuid.UUID | None = Field(default=None)
    # Where the application goes afterwards: a path of its own.
    return_to: str = Field(default="/", max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime = Field(index=True)


class ExternalIdentity(SQLModel, table=True):
    """An account's identity at a single sign-on provider: the provider's
    issuer and its immutable id for the person (`sub`, or `oid` for Entra).
    Sign-ins are matched on this pair, never on the email, which the
    provider may let people change."""

    __tablename__ = "external_identity"
    __table_args__ = (
        UniqueConstraint("issuer", "subject", name="uq_external_identity_issuer_subject"),
        UniqueConstraint("user_id", "provider_key", name="uq_external_identity_user_provider"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    # Which configured provider: "instance" (Platform) for now.
    provider_key: str = Field(default="instance", max_length=64)
    issuer: str = Field(max_length=500)
    subject: str = Field(max_length=255)
    # The email the provider gave when the link was made (for the record).
    email_at_link: str | None = Field(default=None, max_length=320)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_login_at: datetime | None = Field(default=None)
