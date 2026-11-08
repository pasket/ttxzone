import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class TotpBackupCode(SQLModel, table=True):
    """One single-use TOTP recovery code. Generated in a batch of
    BACKUP_CODE_COUNT (see totp_service) whenever a user completes TOTP
    enrollment or explicitly regenerates their set -- a fresh batch always
    replaces (deletes) any prior one, there is never more than one active
    batch per user. code_hash uses the same Argon2 hasher as the account
    password (core/security.hash_password/verify_password) -- these are
    just short shared secrets, not passwords, but the hashing needs are
    identical (never store the plaintext).
    """

    __tablename__ = "totp_backup_code"

    id: int | None = Field(default=None, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    code_hash: str
    used_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
