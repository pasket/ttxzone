"""Re-encrypt the secrets stored in the database with the current
DATA_ENCRYPTION_KEY -- the last step of rotating it
(docs/architecture/email.md -> Rotating the encryption key):

  1. Set the new key as DATA_ENCRYPTION_KEY and the old one as
     DATA_ENCRYPTION_KEY_PREVIOUS; restart the backend (both decrypt).
  2. docker compose exec backend python -m scripts.reencrypt_secrets
  3. Remove DATA_ENCRYPTION_KEY_PREVIOUS; restart.

Covers the accounts' TOTP secrets, the SIEM webhook's signing secret and
Authorization header, the SMTP password and single sign-on client secret
set from Platform, and the messages still queued. A value no configured
key decrypts is reported and left as it is (it then has to be entered or
generated again: a new webhook secret, a two-factor reset, ...)."""

import sys
from typing import Any

from sqlmodel import Session, select

from app.core import crypto
from app.core.db import engine
from app.models import (
    EMAIL_SETTINGS_ID,
    OIDC_SETTINGS_ID,
    PLATFORM_AUDIT_WEBHOOK_ID,
    EmailOutbox,
    EmailSettings,
    OidcSettings,
    PlatformAuditWebhook,
    User,
)


class _Counter:
    def __init__(self) -> None:
        self.done = 0
        self.unreadable = 0

    def reencrypt(self, session: Session, row: Any, field: str, unreadable_hint: str) -> None:
        token = getattr(row, field)
        if token is None:
            return
        try:
            setattr(row, field, crypto.reencrypt(token))
            session.add(row)
            self.done += 1
        except crypto.SecretUnreadableError:
            if unreadable_hint:
                print(unreadable_hint)
            self.unreadable += 1


def main() -> None:
    count = _Counter()
    with Session(engine) as session:
        email = session.get(EmailSettings, EMAIL_SETTINGS_ID)
        if email is not None:
            count.reencrypt(
                session,
                email,
                "smtp_password_encrypted",
                "The SMTP password can't be decrypted: enter it again in Platform -> Email.",
            )
        oidc = session.get(OidcSettings, OIDC_SETTINGS_ID)
        if oidc is not None:
            count.reencrypt(
                session,
                oidc,
                "client_secret_encrypted",
                "The single sign-on client secret can't be decrypted: "
                "enter it again in Platform -> Single sign-on.",
            )
        webhook = session.get(PlatformAuditWebhook, PLATFORM_AUDIT_WEBHOOK_ID)
        if webhook is not None:
            count.reencrypt(
                session,
                webhook,
                "secret_encrypted",
                "The SIEM webhook's signing secret can't be decrypted: "
                "generate a new one in Platform -> Activity log.",
            )
            count.reencrypt(
                session,
                webhook,
                "authorization_encrypted",
                "The SIEM webhook's Authorization header can't be decrypted: "
                "enter it again in Platform -> Activity log.",
            )
        for user in session.exec(
            select(User).where(User.totp_secret_encrypted.is_not(None))  # type: ignore[union-attr]
        ):
            count.reencrypt(
                session,
                user,
                "totp_secret_encrypted",
                f"{user.email}'s TOTP secret can't be decrypted: "
                "reset their two-factor authentication in Platform -> Accounts.",
            )
        for message in session.exec(
            select(EmailOutbox).where(EmailOutbox.payload_encrypted.is_not(None))  # type: ignore[union-attr]
        ):
            count.reencrypt(session, message, "payload_encrypted", "")
        session.commit()
    print(f"Re-encrypted {count.done} value(s); {count.unreadable} unreadable.")
    if count.unreadable:
        sys.exit(1)


if __name__ == "__main__":
    main()
