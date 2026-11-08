import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, ForeignKey, Uuid
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    # None: the account signs in only through single sign-on (created by
    # it, oidc_service); it may set a password later.
    hashed_password: str | None = Field(default=None)
    full_name: str = Field(max_length=255)
    is_active: bool = Field(default=True)
    # Runs the deployment (Platform: tenancy mode, organizations) -- above
    # any organization. The first from scripts.instance_admin, the rest
    # from Platform too (instance_admin_service).
    is_instance_admin: bool = Field(default=False)
    # Suspended by an instance administrator (Platform -> Accounts): no
    # sign-in, no session, data kept, email still taken. Reversible, unlike
    # is_active=False (the account deleted and anonymized).
    suspended_at: datetime | None = Field(default=None)
    # Set when an instance administrator resets the password (Platform ->
    # Accounts): the temporary one only reaches /auth/... until the person
    # picks their own (POST /auth/password clears it).
    password_change_required: bool = Field(
        default=False, sa_column_kwargs={"server_default": "false"}
    )
    # When the current password was set (security_policy_service.set_password);
    # a password older than the deployment's maximum age must be changed.
    password_changed_at: datetime | None = Field(default=None)
    # The address proved to reach the person (a link from
    # account_email_service opened, or a single sign-on provider vouching
    # for it). Accounts from before confirmation existed count as confirmed.
    email_verified_at: datetime | None = Field(default=None)
    # Signed up while the deployment sent email: until the address is
    # confirmed the account reaches only /auth/... (core/security.py).
    email_verification_required: bool = Field(
        default=False, sa_column_kwargs={"server_default": "false"}
    )
    # Periodic reconfirmation: set when the account was asked to confirm its
    # address again (at sign-in); past it, and still unconfirmed, the
    # account reaches only /auth/... (account_email_service).
    email_reconfirm_deadline: datetime | None = Field(default=None)
    # Encrypted (core/crypto.py); read and set through totp_service.
    totp_secret_encrypted: str | None = Field(default=None, max_length=500)
    totp_enabled: bool = Field(default=False)
    # A one-time code by email as a second factor (email_mfa_service);
    # counts as the factor only where two-factor isn't mandatory.
    email_mfa_enabled: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    # The method a second-factor challenge opens on ("totp" or "email");
    # None, or one no longer enrolled: the first the account has.
    mfa_preferred: str | None = Field(default=None, max_length=10)
    avatar_preset: str | None = Field(default=None, max_length=64)
    avatar_upload_path: str | None = Field(default=None, max_length=255)
    default_organization_id: uuid.UUID | None = Field(default=None, foreign_key="organization.id")
    # The rest of the login-time default context (Preferences -> Default
    # selection): which role to act as and which exercise to open in
    # default_organization_id. Both optional; the client falls back to the
    # first available combination whenever they're unset or no longer valid
    # (e.g. access revoked since). One of organization_service.ContextRole.
    default_role: str | None = Field(default=None, max_length=20)
    # use_alter + an explicit name: user -> ttx closes a cycle with
    # ttx.created_by_id -> user, which SQLAlchemy can only create/drop by
    # adding this constraint separately (name matches the migration).
    default_ttx_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey(
                "ttx.id",
                ondelete="SET NULL",
                use_alter=True,
                name="user_default_ttx_id_fkey",
            ),
            nullable=True,
        ),
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Last time a session was issued for this user (password login, two-factor
    # completion, or the signup/registration that logs the user straight in).
    # None = never logged in since the column was added.
    last_login_at: datetime | None = Field(default=None)
    # TOTP anti-replay: the last 30-second time step a code was accepted
    # for. A code for that step or an earlier one is refused.
    totp_last_step: int | None = Field(default=None)
    # Two-factor brute-force limits (totp_service): failed codes since
    # `mfa_failed_since`, a temporary lock, and the one login challenge
    # (mfa_pending token `jti`) that may still be answered.
    mfa_failed_attempts: int = Field(default=0)
    mfa_failed_since: datetime | None = Field(default=None)
    mfa_locked_until: datetime | None = Field(default=None)
    mfa_pending_jti: str | None = Field(default=None, max_length=64)
