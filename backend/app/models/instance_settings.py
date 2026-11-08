import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel

# The one row this table ever holds.
INSTANCE_SETTINGS_ID = 1


class InstanceSettings(SQLModel, table=True):
    """Deployment-wide rules an instance administrator sets from the web
    (Platform). Ignored while the environment pins them (TENANCY_MODE in
    Settings) -- see tenancy_service.effective_policy."""

    __tablename__ = "instance_settings"

    id: int = Field(default=INSTANCE_SETTINGS_ID, primary_key=True)
    # One of tenancy_service.TenancyMode: "open" (any account founds
    # organizations), "single" (one organization) or "managed" (only an
    # instance administrator creates them).
    tenancy_mode: str = Field(default="managed", max_length=16)
    # Cap on organizations in the whole deployment; None = no cap.
    max_organizations: int | None = Field(default=1)
    # Every account confirms its address again after this many days; None:
    # never (account_email_service). Ignored while EMAIL_RECONFIRMATION_DAYS
    # pins it.
    email_reconfirmation_days: int | None = Field(default=None)
    # Password rules on top of the fixed floor (StrongPassword: 8 chars,
    # lower/upper/digit/symbol), read by security_policy_service. They
    # apply to passwords set from now on; an expiry forces the change.
    password_min_length: int = Field(default=8, sa_column_kwargs={"server_default": "8"})
    # Refuse a password containing the account's email name or full name.
    password_reject_personal: bool = Field(
        default=False, sa_column_kwargs={"server_default": "false"}
    )
    # Days a password lasts before the account must change it; None: never.
    password_max_age_days: int | None = Field(default=None)
    # How many previous passwords can't be reused; 0: no check.
    password_history_count: int = Field(default=0, sa_column_kwargs={"server_default": "0"})
    # Mandatory second factor per role (security_policy_service). The
    # instance administrator always needs one, so it has no flag. Planner
    # covers every planning and control team member (Controller,
    # Facilitator).
    mfa_required_program_manager: bool = Field(
        default=True, sa_column_kwargs={"server_default": "true"}
    )
    mfa_required_planner: bool = Field(default=True, sa_column_kwargs={"server_default": "true"})
    mfa_required_evaluator: bool = Field(default=True, sa_column_kwargs={"server_default": "true"})
    mfa_required_observer: bool = Field(default=True, sa_column_kwargs={"server_default": "true"})
    mfa_required_player: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    # The AI assistant (services/assistant): personal access tokens and the
    # MCP endpoint. Off until an instance administrator turns it on
    # (Platform -> AI assistant); ignored while ASSISTANT_ENABLED pins it.
    assistant_enabled: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    updated_at: datetime | None = Field(default=None)
    updated_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
