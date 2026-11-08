"""How a built message leaves the deployment (docs/architecture/email.md).
A transport sends one message or raises: TransientEmailError when trying
again later may work (the server is down, busy or misconfigured -- the
operator can fix it), PermanentEmailError when it never will (the server
refused that recipient). email_service decides what to do with each.

SMTP is the transport every operator can use (an internal relay, Microsoft
365, Google Workspace, SES, SendGrid...). A provider's REST API (Microsoft
Graph) can be added as another class with the same `send`."""

import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Literal, Protocol

logger = logging.getLogger(__name__)

SmtpSecurity = Literal["starttls", "tls", "none"]


class EmailDeliveryError(Exception):
    """Why a message wasn't sent, in words fit for Platform (the server's
    answer -- never a credential)."""


class TransientEmailError(EmailDeliveryError):
    pass


class PermanentEmailError(EmailDeliveryError):
    pass


class EmailTransport(Protocol):
    def send(self, message: EmailMessage) -> None: ...


@dataclass(frozen=True)
class SmtpConfig:
    host: str
    port: int
    security: SmtpSecurity
    username: str | None
    password: str | None
    timeout: float
    # Plain text and unverified certificates accepted (EMAIL_ALLOW_INSECURE).
    allow_insecure: bool

    def __repr__(self) -> str:
        # Never print the password (a traceback, a debug log).
        return (
            f"SmtpConfig(host={self.host!r}, port={self.port}, security={self.security!r}, "
            f"username={self.username!r}, password={'***' if self.password else None})"
        )


def _tls_context(allow_insecure: bool) -> ssl.SSLContext:
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    if allow_insecure:
        # An internal relay with a self-signed certificate: still encrypted,
        # but its identity isn't checked. Opt-in only.
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    return context


def _smtp_error(exc: smtplib.SMTPResponseException) -> str:
    answer = exc.smtp_error
    text = answer.decode(errors="replace") if isinstance(answer, bytes) else str(answer)
    return f"SMTP {exc.smtp_code}: {text}"[:500]


class SmtpTransport:
    """One connection per message: TLS first (implicit, or STARTTLS that
    must be offered -- never a silent fall back to plain text), then the
    login, then the message."""

    def __init__(self, config: SmtpConfig) -> None:
        self.config = config

    def _connect(self) -> smtplib.SMTP:
        config = self.config
        if config.security == "tls":
            return smtplib.SMTP_SSL(
                config.host,
                config.port,
                timeout=config.timeout,
                context=_tls_context(config.allow_insecure),
            )
        return smtplib.SMTP(config.host, config.port, timeout=config.timeout)

    def send(self, message: EmailMessage) -> None:
        config = self.config
        try:
            with self._connect() as smtp:
                smtp.ehlo()
                if config.security == "starttls":
                    if not smtp.has_extn("starttls"):
                        raise TransientEmailError(
                            "The server doesn't offer STARTTLS; nothing was sent in plain text."
                        )
                    smtp.starttls(context=_tls_context(config.allow_insecure))
                    smtp.ehlo()
                if config.username:
                    smtp.login(config.username, config.password or "")
                smtp.send_message(message)
        except EmailDeliveryError:
            raise
        except smtplib.SMTPRecipientsRefused as exc:
            codes = [code for code, _ in exc.recipients.values()]
            detail = "; ".join(
                f"SMTP {code}: {answer.decode(errors='replace')}"
                for code, answer in exc.recipients.values()
            )[:500]
            if codes and all(code >= 500 for code in codes):
                raise PermanentEmailError(detail) from exc
            raise TransientEmailError(detail) from exc
        except smtplib.SMTPDataError as exc:
            # The message itself refused (5xx) won't pass on a retry.
            error_class = PermanentEmailError if exc.smtp_code >= 500 else TransientEmailError
            raise error_class(_smtp_error(exc)) from exc
        except smtplib.SMTPAuthenticationError as exc:
            # The operator fixes the credentials; queued messages wait.
            raise TransientEmailError(
                f"The server refused the username or password ({_smtp_error(exc)})."
            ) from exc
        except smtplib.SMTPResponseException as exc:
            raise TransientEmailError(_smtp_error(exc)) from exc
        except ssl.SSLError as exc:
            raise TransientEmailError(f"TLS failed: {exc.reason or exc}"[:500]) from exc
        except (OSError, smtplib.SMTPException) as exc:
            raise TransientEmailError(f"{type(exc).__name__}: {exc}"[:500]) from exc


class ConsoleTransport:
    """Development: the message goes to app.log instead of a server
    (refused in production -- it may carry one-time links)."""

    def send(self, message: EmailMessage) -> None:
        logger.info(
            "Email (console transport, not sent)\n%s",
            message.as_string(),
        )
