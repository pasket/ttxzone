from pathlib import Path
from typing import Literal, Self
from urllib.parse import quote

from cryptography.fernet import Fernet
from pydantic import Field, SecretStr, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# SMTP ports accepted without EMAIL_ALLOW_INSECURE: relay (25), implicit TLS
# (465), submission (587) and the usual alternative (2525). Anything else
# needs the opt-out, so the host field can't probe other internal services.
SMTP_STANDARD_PORTS = frozenset({25, 465, 587, 2525})

_GENERATE_KEY = (
    'generate one with python -c "from cryptography.fernet import Fernet; '
    'print(Fernet.generate_key().decode())"'
)


class Settings(BaseSettings):
    PROJECT_NAME: str = "ttx-zone"
    API_V1_PREFIX: str = "/api/v1"
    # Production unless said otherwise: session cookies need HTTPS and the
    # example secrets are refused. Development (plain HTTP on a workstation)
    # is set explicitly by .env.example, the dev Compose file and the tests.
    ENVIRONMENT: str = "production"
    # What this process runs (one image, several roles -- docs/deployment.md):
    # "all" (development and single-container deployments: the API and the
    # background loops), "api-internal" (the API only), "worker" (the
    # background loops only: outgoing email, the activity log's forwarding
    # and retention), "api-public" (the Players' face only: app/api/exposure.py).
    APP_ROLE: Literal["all", "api-internal", "api-public", "worker"] = "all"
    # Whether the container migrates the database before starting. A
    # deployment with a one-shot `migrate` service sets it false on the rest.
    RUN_MIGRATIONS: bool = True
    # The worker's heartbeat, read by its health check.
    WORKER_HEARTBEAT_FILE: str = "/tmp/ttx-zone-worker.heartbeat"  # nosec B108
    LOG_LEVEL: str = "INFO"
    # Files under backend/logs/ rotate at this size, keeping LOG_FILE_BACKUPS
    # older copies (the oldest deleted): each log is capped at
    # size x (backups + 1). 0 = the app doesn't rotate; the server's
    # logrotate does (one process per file only -- docs/architecture/logging.md).
    LOG_FILE_MAX_MB: int = Field(default=10, ge=0)
    LOG_FILE_BACKUPS: int = Field(default=5, ge=1)

    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    DEFAULT_LOCALE: str = "en"
    SUPPORTED_LOCALES: list[str] = ["en", "es"]

    POSTGRES_USER: str
    # Required, from the environment or from POSTGRES_PASSWORD_FILE (a
    # Docker/Kubernetes secret; the postgres image reads the same variable).
    POSTGRES_PASSWORD: str
    POSTGRES_PASSWORD_FILE: str | None = None
    POSTGRES_DB: str
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    # Database connections per process: DB_POOL_SIZE kept open, up to
    # DB_MAX_OVERFLOW more under load. Together they must cover the worker
    # threads that run requests (40, Starlette's thread pool): with fewer,
    # requests holding a connection wait for a thread while threads wait
    # for a connection, and everything stalls until the pool timeout
    # (found by the load test, docs/deployment.md section 10). Mind
    # Postgres's max_connections across every process.
    DB_POOL_SIZE: int = Field(default=10, ge=1)
    DB_MAX_OVERFLOW: int = Field(default=30, ge=0)
    # Requests a process handles at once (ConcurrencyLimitMiddleware); the
    # rest queue without holding a thread or a connection. Keep it below
    # DB_POOL_SIZE + DB_MAX_OVERFLOW and below the 40 worker threads.
    MAX_CONCURRENT_REQUESTS: int = Field(default=30, ge=1)
    # Failed sign-ins from one address, over any accounts, in 15 minutes
    # before it's locked out for 15 (login_throttle_service). Raise it when
    # a very large room shares one public address.
    LOGIN_FAILURES_PER_ADDRESS: int = Field(default=100, ge=1)

    # Required, from the environment or from SECRET_KEY_FILE.
    SECRET_KEY: str
    SECRET_KEY_FILE: str | None = None
    JWT_ALGORITHM: str = "HS256"
    # Session policy (services/session_service.py): a session ends after this much
    # inactivity (soft timeout) -- shorter for accounts with mandatory MFA
    # (Program Manager, Planner, Evaluator) -- and, whatever the activity,
    # this many hours after sign-in (hard timeout).
    SESSION_IDLE_MINUTES_PRIVILEGED: int = 30
    SESSION_IDLE_MINUTES_PLAYER: int = 60
    SESSION_ABSOLUTE_HOURS: int = 12
    # How recently the user must have proved who they are (TOTP, or the
    # password without TOTP) for a sensitive action (step-up).
    STEP_UP_MINUTES: int = 15
    MAX_SESSIONS_PER_USER: int = 5
    ACCESS_TOKEN_COOKIE_NAME: str = "ttx_access_token"
    CSRF_COOKIE_NAME: str = "ttx_csrf_token"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"

    AVATAR_UPLOAD_DIR: str = "uploads/avatars"
    AVATAR_URL_PREFIX: str = "/media/avatars"
    AVATAR_MAX_BYTES: int = 2 * 1024 * 1024
    AVATAR_ALLOWED_CONTENT_TYPES: list[str] = ["image/png", "image/jpeg", "image/webp"]
    # Every stored upload is server-side re-encoded to at most this square
    # size as JPEG (see avatar_service._process_image) so a malicious or
    # careless upload can never persist a huge file regardless of what was
    # sent -- the raw AVATAR_MAX_BYTES cap above only guards the input.
    AVATAR_MAX_DIMENSION_PX: int = 512
    AVATAR_JPEG_QUALITY: int = 85

    # Organization logos reuse the AVATAR_* size/type/quality limits above --
    # same constraints, just a different storage location and URL prefix.
    ORG_LOGO_UPLOAD_DIR: str = "uploads/org-logos"
    ORG_LOGO_URL_PREFIX: str = "/media/org-logos"

    # TTX exercise images -- same AVATAR_* size/type/quality limits again,
    # own storage location and URL prefix.
    TTX_IMAGE_UPLOAD_DIR: str = "uploads/ttx-images"
    TTX_IMAGE_URL_PREFIX: str = "/media/ttx-images"
    # Needs-form approval evidence (signed PDFs, approval emails...). Kept
    # out of every StaticFiles mount on purpose: these are TLP-classified
    # and only served through the Planner-gated download endpoint.
    NEEDS_EVIDENCE_UPLOAD_DIR: str = "uploads/needs-evidence"
    NEEDS_EVIDENCE_MAX_BYTES: int = 10 * 1024 * 1024
    NEEDS_EVIDENCE_MAX_FILES_PER_APPROVAL: int = 5
    # Images attached to MSEL injects: TLP-classified too, so likewise only
    # served through the MSEL's guarded endpoint. Re-encoded on upload and
    # downscaled to MSEL_IMAGE_MAX_DIMENSION_PX on its longer side.
    MSEL_IMAGE_UPLOAD_DIR: str = "uploads/msel-images"
    MSEL_IMAGE_MAX_BYTES: int = 5 * 1024 * 1024
    MSEL_IMAGE_MAX_DIMENSION_PX: int = 2000
    MSEL_IMAGE_MAX_PER_MSEL: int = 60
    # Files the players download with an inject (logs, packet captures,
    # dumps...): stored as uploaded, any type, served only as opaque
    # downloads through guarded endpoints. A reverse proxy in front must
    # accept request bodies of at least MSEL_FILE_MAX_BYTES.
    MSEL_FILE_UPLOAD_DIR: str = "uploads/msel-files"
    MSEL_FILE_MAX_BYTES: int = 50 * 1024 * 1024
    MSEL_FILE_MAX_PER_MSEL: int = 60
    # A shared scenario file (.ttx.md), images and inject files embedded.
    SCENARIO_MAX_BYTES: int = 200 * 1024 * 1024

    # Fraud/abuse controls on an account founding its own organization in an
    # "open" deployment (org_creation_security.py) -- off entirely bypasses
    # the free-webmail and MX checks.
    ORG_CREATION_DOMAIN_POLICY_ENABLED: bool = True
    # A signed-in account founding another organization stops once it is
    # Program Manager of this many (founded or granted).
    MAX_ORGANIZATIONS_PER_PROGRAM_MANAGER: int = 5
    # Who may found organizations in this deployment (tenancy_service):
    # "open" (any account), "single" (one organization, founded once) or
    # "managed" (only an instance administrator, from Platform). Unset =
    # the instance administrator chooses from the web (until then:
    # tenancy_service.DEFAULT_POLICY, managed with one organization); set = pinned here,
    # with TENANCY_MAX_ORGANIZATIONS as the deployment-wide cap.
    TENANCY_MODE: Literal["open", "single", "managed"] | None = None
    TENANCY_MAX_ORGANIZATIONS: int | None = Field(default=None, ge=1)
    # Whether instance administrators grant and revoke the role from the
    # web (Platform -> Accounts / Administrators). False leaves it to the
    # server's console (scripts.instance_admin), the way back in any case.
    INSTANCE_ADMIN_WEB_GRANTS: bool = True
    # Platform's activity log forwarded to a SIEM (platform_audit_service):
    # how often pending events are sent, and whether a plain-http collector
    # URL is accepted (internal networks only -- the events name accounts).
    AUDIT_WEBHOOK_POLL_SECONDS: float = Field(default=10, gt=0)
    AUDIT_WEBHOOK_ALLOW_HTTP: bool = False

    # Outgoing email (services/email_service.py, docs/architecture/email.md).
    # EMAIL_TRANSPORT set pins the whole configuration here (Platform -> Email
    # shows it read-only); unset, an instance administrator sets it from the
    # web; neither, the deployment sends no email. "console" writes each
    # message to app.log instead of sending it (development only).
    EMAIL_TRANSPORT: Literal["smtp", "console"] | None = None
    EMAIL_FROM_ADDRESS: str | None = None
    EMAIL_FROM_NAME: str | None = None
    EMAIL_REPLY_TO: str | None = None
    SMTP_HOST: str | None = None
    SMTP_PORT: int = Field(default=587, ge=1, le=65535)
    # "starttls" (587: upgrade, never falls back to plain text), "tls"
    # (465: TLS from the first byte) or "none" (needs EMAIL_ALLOW_INSECURE).
    SMTP_SECURITY: Literal["starttls", "tls", "none"] = "starttls"
    SMTP_USERNAME: str | None = None
    # Or SMTP_PASSWORD_FILE: read from that file (a Docker/Kubernetes secret).
    SMTP_PASSWORD: SecretStr | None = None
    SMTP_PASSWORD_FILE: str | None = None
    SMTP_TIMEOUT_SECONDS: float = Field(default=15, gt=0)
    # Accepts plain-text SMTP, unverified certificates and non-standard
    # ports -- an internal relay or a local mail catcher only.
    EMAIL_ALLOW_INSECURE: bool = False
    # The queue (email_outbox): how often it's drained, how many attempts a
    # message gets, at most how many messages one address is sent per hour
    # (beyond, new ones are dropped) and how many leave per minute in all.
    EMAIL_POLL_SECONDS: float = Field(default=5, gt=0)
    EMAIL_MAX_ATTEMPTS: int = Field(default=8, ge=1)
    EMAIL_RATE_PER_RECIPIENT_PER_HOUR: int = Field(default=10, ge=1)
    EMAIL_RATE_GLOBAL_PER_MINUTE: int = Field(default=60, ge=1)
    # Every account confirms its address again after this many days
    # (account_email_service, Periodic reconfirmation). Set = pinned, and
    # Platform -> Email shows it read-only; 0 pins it off. Unset: Platform
    # decides (off by default).
    EMAIL_RECONFIRMATION_DAYS: int | None = Field(default=None, ge=0, le=730)

    # Encrypts the secrets the application keeps in its own database (TOTP
    # secrets, the SIEM webhook's, the SMTP password and SSO client secret
    # set from Platform, queued messages): a Fernet key, kept out of the
    # database and apart from SECRET_KEY (core/crypto.py). Required, here or
    # as DATA_ENCRYPTION_KEY_FILE. DATA_ENCRYPTION_KEY_PREVIOUS still decrypts
    # while a key is being rotated (scripts.reencrypt_secrets).
    DATA_ENCRYPTION_KEY: SecretStr | None = None
    DATA_ENCRYPTION_KEY_FILE: str | None = None
    DATA_ENCRYPTION_KEY_PREVIOUS: SecretStr | None = None

    # Where people reach the application, as their browser sees it (scheme,
    # host and port, no path): the single sign-on provider sends them back
    # to <PUBLIC_BASE_URL>/api/v1/auth/oidc/callback, the exact address
    # registered with it. Required for single sign-on.
    PUBLIC_BASE_URL: str | None = None

    # Single sign-on through an OpenID Connect provider (services/oidc_service.py,
    # docs/architecture/sso.md). OIDC_PROVIDER set pins the whole configuration
    # here (Platform -> Single sign-on shows it read-only); unset, an instance
    # administrator sets it from the web; neither, there is no single sign-on.
    # "entra" needs OIDC_ENTRA_TENANT_ID (one tenant); "generic" OIDC_ISSUER_URL.
    OIDC_PROVIDER: Literal["entra", "generic"] | None = None
    OIDC_ENTRA_TENANT_ID: str | None = None
    OIDC_ISSUER_URL: str | None = None
    OIDC_CLIENT_ID: str | None = None
    # Or OIDC_CLIENT_SECRET_FILE: read from that file (a Docker/Kubernetes secret).
    OIDC_CLIENT_SECRET: SecretStr | None = None
    OIDC_CLIENT_SECRET_FILE: str | None = None
    # The button reads "Sign in with <OIDC_DISPLAY_NAME>".
    OIDC_DISPLAY_NAME: str | None = None
    # Creates an account (no role, no password) the first time someone the
    # provider vouches for signs in.
    OIDC_ALLOW_JIT: bool = False
    # A sign-in whose token says the provider asked for a second factor
    # (amr contains "mfa") counts as this application's own.
    OIDC_TRUST_PROVIDER_MFA: bool = True
    # Accepts a provider on plain http (a local test provider only).
    OIDC_ALLOW_INSECURE: bool = False

    # The Playground's server push (services/run_stream.py): how often a
    # watcher checks an exercise, how often presence is kept up and the
    # sign-in re-checked, the keep-alive comment, and a stream's lifetime
    # (the browser reconnects).
    RUN_STREAM_TICK_SECONDS: float = 1.0
    RUN_STREAM_KEEPALIVE_SECONDS: float = 10.0
    RUN_STREAM_PING_SECONDS: float = 15.0
    RUN_STREAM_MAX_SECONDS: float = 1800.0
    # How long a process reuses who is present, and the part of the view
    # every Player of a room shares (docs/deployment.md, section 10).
    RUN_PRESENCE_CACHE_SECONDS: float = 1.0
    RUN_VIEW_CACHE_SECONDS: float = 2.0
    # How long a process reuses deployment-wide rules every request checks
    # (the password and second-factor policy, which legal documents must be
    # accepted). A change made in Platform applies at once in the process
    # that saved it, within this in the others.
    INSTANCE_CACHE_SECONDS: float = Field(default=5.0, ge=0)

    # The AI assistant (docs/features/ai-assistant.md). Set, pins the
    # instance switch (Platform -> AI assistant shows it read-only); unset,
    # an instance administrator turns it on from the web (off by default).
    ASSISTANT_ENABLED: bool | None = None
    # Tool calls per personal access token per minute on the MCP endpoint.
    ASSISTANT_RATE_LIMIT_PER_MINUTE: int = Field(default=60, ge=1)

    @field_validator(
        "EMAIL_TRANSPORT",
        "EMAIL_FROM_ADDRESS",
        "EMAIL_FROM_NAME",
        "EMAIL_REPLY_TO",
        "SMTP_HOST",
        "SMTP_USERNAME",
        "SMTP_PASSWORD",
        "SMTP_PASSWORD_FILE",
        "DATA_ENCRYPTION_KEY",
        "DATA_ENCRYPTION_KEY_FILE",
        "DATA_ENCRYPTION_KEY_PREVIOUS",
        "PUBLIC_BASE_URL",
        "OIDC_PROVIDER",
        "OIDC_ENTRA_TENANT_ID",
        "OIDC_ISSUER_URL",
        "OIDC_CLIENT_ID",
        "OIDC_CLIENT_SECRET",
        "OIDC_CLIENT_SECRET_FILE",
        "OIDC_DISPLAY_NAME",
        "ASSISTANT_ENABLED",
        mode="before",
    )
    @classmethod
    def _blank_is_unset(cls, value: object) -> object:
        # `SMTP_HOST=` in .env means "not set", not an empty host.
        return None if isinstance(value, str) and not value.strip() else value

    @model_validator(mode="before")
    @classmethod
    def _required_secrets_from_files(cls, data: object) -> object:
        # Runs before the required-field check, so SECRET_KEY_FILE alone
        # satisfies SECRET_KEY. A value set directly wins over the file.
        if isinstance(data, dict):
            for name in ("SECRET_KEY", "POSTGRES_PASSWORD"):
                path = data.get(f"{name}_FILE")
                if not data.get(name) and isinstance(path, str) and path.strip():
                    data[name] = _read_secret_file(path.strip())
        return data

    @model_validator(mode="after")
    def _no_example_secrets_on_a_server(self) -> Self:
        """Outside development, refuse to start with .env.example's
        placeholders or a short signing key: a server that kept them would
        sign sessions with a key anyone can read in this repository."""
        if self.ENVIRONMENT == "development":
            return self
        problems = []
        if len(self.SECRET_KEY) < 32 or self.SECRET_KEY.startswith("change-me"):
            problems.append("SECRET_KEY must be 32 random characters or more: openssl rand -hex 32")
        if self.POSTGRES_PASSWORD == "change-me":  # nosec B105 -- example placeholder, refused
            problems.append("POSTGRES_PASSWORD is still the example's")
        if problems:
            raise ValueError("; ".join(problems) + ".")
        return self

    @model_validator(mode="after")
    def _email_and_encryption(self) -> Self:
        """Secrets from files, and a pinned email configuration checked at
        startup: a mistake stops the backend instead of failing every send."""
        if self.SMTP_PASSWORD is None and self.SMTP_PASSWORD_FILE:
            self.SMTP_PASSWORD = SecretStr(_read_secret_file(self.SMTP_PASSWORD_FILE))
        if self.DATA_ENCRYPTION_KEY is None and self.DATA_ENCRYPTION_KEY_FILE:
            self.DATA_ENCRYPTION_KEY = SecretStr(_read_secret_file(self.DATA_ENCRYPTION_KEY_FILE))
        if self.DATA_ENCRYPTION_KEY is None:
            raise ValueError(
                f"DATA_ENCRYPTION_KEY (or DATA_ENCRYPTION_KEY_FILE) is required: {_GENERATE_KEY}"
            )
        for name in ("DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEY_PREVIOUS"):
            key = getattr(self, name)
            if key is not None:
                try:
                    Fernet(key.get_secret_value())
                except ValueError as exc:
                    raise ValueError(
                        f"{name} is not a Fernet key (32 url-safe base64-encoded bytes): "
                        f"{_GENERATE_KEY}"
                    ) from exc
        if self.EMAIL_TRANSPORT is None:
            return self
        problems = []
        if not self.EMAIL_FROM_ADDRESS:
            problems.append("EMAIL_FROM_ADDRESS is required")
        if self.EMAIL_TRANSPORT == "console" and self.ENVIRONMENT == "production":
            problems.append('EMAIL_TRANSPORT="console" is for development only')
        if self.EMAIL_TRANSPORT == "smtp":
            if not self.SMTP_HOST:
                problems.append("SMTP_HOST is required")
            if not self.EMAIL_ALLOW_INSECURE:
                if self.SMTP_SECURITY == "none":
                    problems.append('SMTP_SECURITY="none" needs EMAIL_ALLOW_INSECURE=true')
                if self.SMTP_PORT not in SMTP_STANDARD_PORTS:
                    problems.append(
                        "SMTP_PORT must be 25, 465, 587 or 2525 unless EMAIL_ALLOW_INSECURE=true"
                    )
        if problems:
            raise ValueError("Outgoing email: " + "; ".join(problems) + ".")
        return self

    @model_validator(mode="after")
    def _single_sign_on(self) -> Self:
        """A pinned single sign-on configuration checked at startup, like email."""
        if self.PUBLIC_BASE_URL is not None:
            self.PUBLIC_BASE_URL = self.PUBLIC_BASE_URL.strip().rstrip("/")
        if self.OIDC_CLIENT_SECRET is None and self.OIDC_CLIENT_SECRET_FILE:
            self.OIDC_CLIENT_SECRET = SecretStr(_read_secret_file(self.OIDC_CLIENT_SECRET_FILE))
        if self.OIDC_PROVIDER is None:
            return self
        problems = []
        if not self.PUBLIC_BASE_URL:
            problems.append("PUBLIC_BASE_URL is required")
        if not self.OIDC_CLIENT_ID:
            problems.append("OIDC_CLIENT_ID is required")
        if self.OIDC_CLIENT_SECRET is None:
            problems.append("OIDC_CLIENT_SECRET is required")
        if self.OIDC_PROVIDER == "entra" and not self.OIDC_ENTRA_TENANT_ID:
            problems.append('OIDC_ENTRA_TENANT_ID is required with OIDC_PROVIDER="entra"')
        if self.OIDC_PROVIDER == "generic" and not self.OIDC_ISSUER_URL:
            problems.append('OIDC_ISSUER_URL is required with OIDC_PROVIDER="generic"')
        if problems:
            raise ValueError("Single sign-on: " + "; ".join(problems) + ".")
        return self

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        return (
            # Quoted: a generated password may hold @, /, : or %.
            f"postgresql+psycopg://{quote(self.POSTGRES_USER, safe='')}"
            f":{quote(self.POSTGRES_PASSWORD, safe='')}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


def _read_secret_file(path: str) -> str:
    return Path(path).read_text(encoding="utf-8").strip()


settings = Settings()
