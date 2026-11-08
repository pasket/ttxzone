from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProviderKindField = Literal["entra", "generic"]


class OidcSettingsRead(BaseModel):
    """Platform -> Single sign-on. Never carries the client secret:
    `has_client_secret` says whether one is stored, `client_secret_readable`
    whether the current key still decrypts it."""

    # Whether the sign-in page offers it right now (oidc_service.effective_config).
    active: bool
    # Set in the server's configuration (OIDC_PROVIDER): read-only here.
    pinned_by_env: bool
    # The callback to register with the provider; None without PUBLIC_BASE_URL.
    redirect_uri: str | None
    # Whether a configuration exists (from the server or the web).
    configured: bool
    enabled: bool = False
    provider_kind: ProviderKindField | None = None
    display_name: str | None = None
    entra_tenant_id: str | None = None
    issuer_url: str | None = None
    client_id: str | None = None
    allow_jit: bool = False
    trust_provider_mfa: bool = True
    has_client_secret: bool = False
    client_secret_readable: bool = True
    # Accounts linked to the provider.
    linked_accounts: int = 0
    updated_at: datetime | None = None


class OidcSettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    provider_kind: ProviderKindField = "entra"
    display_name: str | None = Field(default=None, max_length=60)
    entra_tenant_id: str | None = Field(default=None, max_length=36)
    issuer_url: str | None = Field(default=None, max_length=500)
    client_id: str = Field(min_length=1, max_length=255)
    # None keeps the stored secret.
    client_secret: str | None = Field(default=None, max_length=2000)
    allow_jit: bool = False
    trust_provider_mfa: bool = True


class OidcTestRead(BaseModel):
    ok: bool
    # The reason (oidc_service.OidcError) and what the provider said.
    error: str | None = None
    detail: str | None = None
