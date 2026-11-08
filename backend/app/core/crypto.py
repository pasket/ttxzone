"""Secrets the application keeps in its own database, encrypted at rest:
the accounts' TOTP secrets, the SIEM webhook's signing secret and
Authorization header, the SMTP password and single sign-on client secret
set from Platform, and the queued email messages (they will carry
one-time links). The key (Settings.DATA_ENCRYPTION_KEY) lives
in the server's environment, never in the database, so a copy of the
database alone -- a dump, a backup -- doesn't reveal them. It is apart
from SECRET_KEY on purpose: rotating that one (it signs the sessions)
must not make stored secrets unreadable.

Fernet: AES-128-CBC with an HMAC-SHA256 over it -- a tampered value fails
to decrypt instead of decrypting to garbage. While a key is rotated,
DATA_ENCRYPTION_KEY_PREVIOUS still decrypts what the old one encrypted;
`reencrypt` (scripts.reencrypt_secrets) moves a value to the current key.
"""

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.core.config import settings


class SecretUnreadableError(RuntimeError):
    """A stored value none of the configured keys decrypts (the key changed
    without DATA_ENCRYPTION_KEY_PREVIOUS, or the value was tampered with)."""


def _fernet() -> MultiFernet:
    # Settings refuses to start without DATA_ENCRYPTION_KEY.
    key = settings.DATA_ENCRYPTION_KEY
    if key is None:
        raise RuntimeError("DATA_ENCRYPTION_KEY is not set.")
    keys = [Fernet(key.get_secret_value())]
    if settings.DATA_ENCRYPTION_KEY_PREVIOUS is not None:
        keys.append(Fernet(settings.DATA_ENCRYPTION_KEY_PREVIOUS.get_secret_value()))
    # The first key encrypts; every one of them is tried to decrypt.
    return MultiFernet(keys)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise SecretUnreadableError("No configured key decrypts this value.") from exc


def reencrypt(token: str) -> str:
    """The same secret, encrypted with the current key."""
    try:
        return _fernet().rotate(token.encode()).decode()
    except InvalidToken as exc:
        raise SecretUnreadableError("No configured key decrypts this value.") from exc
