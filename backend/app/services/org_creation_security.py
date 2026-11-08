import logging
from dataclasses import dataclass

import dns.exception
import dns.resolver
from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import FreeEmailDomain
from app.services.tenancy_service import effective_policy

logger = logging.getLogger(__name__)

# Small curated list of well-known consumer webmail providers -- not an
# attempt at general disposable/temp-mail detection (that list rots within
# weeks and is an unmaintainable arms race). In an "open" deployment,
# "Set up my organization" requires a work email; a personal-email user
# has the "Create my account" path instead. The instance administrator
# adds to it, or switches a built-in domain off, from Platform
# (FreeEmailDomain).
BUILTIN_FREE_EMAIL_DOMAINS: frozenset[str] = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "msn.com",
        "yahoo.com",
        "yahoo.es",
        "ymail.com",
        "icloud.com",
        "aol.com",
        "protonmail.com",
        "protonmail.ch",
        "proton.me",
        "pm.me",
        "gmx.com",
    }
)

_DNS_TIMEOUT_SECONDS = 2.0


def _domain_has_mail_infrastructure(domain: str) -> bool:
    """True unless the domain is confirmed to have no MX and no A record.
    A resolver timeout or other transient error is NOT a confirmed
    failure -- fail open, since a flaky resolver must never brick
    onboarding."""
    resolver = dns.resolver.Resolver()
    resolver.timeout = _DNS_TIMEOUT_SECONDS
    resolver.lifetime = _DNS_TIMEOUT_SECONDS

    try:
        resolver.resolve(domain, "MX")
        return True
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        pass
    except dns.exception.Timeout:
        logger.info("MX lookup for %s timed out; allowing signup to proceed.", domain)
        return True
    except dns.exception.DNSException:
        logger.info("MX lookup for %s failed unexpectedly; allowing signup to proceed.", domain)
        return True

    try:
        resolver.resolve(domain, "A")
        return True
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        return False
    except dns.exception.Timeout:
        logger.info("A lookup for %s timed out; allowing signup to proceed.", domain)
        return True
    except dns.exception.DNSException:
        logger.info("A lookup for %s failed unexpectedly; allowing signup to proceed.", domain)
        return True


@dataclass(frozen=True)
class FreeEmailDomainEntry:
    domain: str
    builtin: bool
    active: bool


def _normalize(domain: str) -> str:
    return domain.strip().lower()


def free_email_domains(session: Session) -> frozenset[str]:
    """The built-in domains still switched on, plus the ones added."""
    rows = session.exec(select(FreeEmailDomain)).all()
    disabled = {row.domain for row in rows if row.disabled}
    added = {row.domain for row in rows if not row.disabled}
    return (BUILTIN_FREE_EMAIL_DOMAINS - disabled) | added


def list_free_email_domains(session: Session) -> list[FreeEmailDomainEntry]:
    rows = {row.domain: row for row in session.exec(select(FreeEmailDomain)).all()}
    entries = [
        FreeEmailDomainEntry(domain, True, not (domain in rows and rows[domain].disabled))
        for domain in BUILTIN_FREE_EMAIL_DOMAINS
    ]
    entries += [
        FreeEmailDomainEntry(domain, False, True)
        for domain in rows
        if domain not in BUILTIN_FREE_EMAIL_DOMAINS
    ]
    return sorted(entries, key=lambda entry: entry.domain)


def add_free_email_domain(session: Session, domain: str) -> FreeEmailDomainEntry:
    """Adding a built-in domain that was switched off switches it back on."""
    domain = _normalize(domain)
    row = session.get(FreeEmailDomain, domain)
    if domain in BUILTIN_FREE_EMAIL_DOMAINS:
        if row is None:
            raise AppException(
                "FREE_EMAIL_DOMAIN_EXISTS",
                "This domain is already on the list.",
                409,
                log_level=logging.WARNING,
            )
        session.delete(row)
    elif row is not None:
        raise AppException(
            "FREE_EMAIL_DOMAIN_EXISTS",
            "This domain is already on the list.",
            409,
            log_level=logging.WARNING,
        )
    else:
        session.add(FreeEmailDomain(domain=domain))
    session.commit()
    logger.info("Free email domain %s added.", domain)
    return FreeEmailDomainEntry(domain, domain in BUILTIN_FREE_EMAIL_DOMAINS, True)


def remove_free_email_domain(session: Session, domain: str) -> None:
    domain = _normalize(domain)
    if domain in BUILTIN_FREE_EMAIL_DOMAINS:
        raise AppException(
            "FREE_EMAIL_DOMAIN_BUILTIN",
            "A built-in domain can be switched off, not removed.",
            409,
            log_level=logging.WARNING,
        )
    row = session.get(FreeEmailDomain, domain)
    if row is None:
        raise AppException(
            "FREE_EMAIL_DOMAIN_NOT_FOUND",
            "This domain isn't on the list.",
            404,
            log_level=logging.WARNING,
        )
    session.delete(row)
    session.commit()
    logger.info("Free email domain %s removed.", domain)


def set_builtin_free_email_domain_active(
    session: Session, domain: str, active: bool
) -> FreeEmailDomainEntry:
    domain = _normalize(domain)
    if domain not in BUILTIN_FREE_EMAIL_DOMAINS:
        raise AppException(
            "FREE_EMAIL_DOMAIN_NOT_FOUND",
            "This domain isn't on the list.",
            404,
            log_level=logging.WARNING,
        )
    row = session.get(FreeEmailDomain, domain)
    if active and row is not None:
        session.delete(row)
    elif not active and row is None:
        session.add(FreeEmailDomain(domain=domain, disabled=True))
    session.commit()
    logger.info("Built-in free email domain %s switched %s.", domain, "on" if active else "off")
    return FreeEmailDomainEntry(domain, True, active)


def validate_organization_signup(session: Session, email: str) -> None:
    """Fraud/abuse checks on an account founding its own organization --
    raises AppException on the first failing check. Only in an "open"
    deployment: under "single" and "managed" the operator decides who
    founds, so nothing here applies. No-ops entirely when
    settings.ORG_CREATION_DOMAIN_POLICY_ENABLED is False."""
    if not settings.ORG_CREATION_DOMAIN_POLICY_ENABLED:
        return
    if effective_policy(session).mode != "open":
        return

    domain = email.rsplit("@", 1)[-1].lower()

    if domain in free_email_domains(session):
        raise AppException(
            "FREE_EMAIL_DOMAIN_BLOCKED",
            "Organizations require a work email address. Use 'Create my account' "
            "instead if this is a personal account.",
            422,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )

    if not _domain_has_mail_infrastructure(domain):
        raise AppException(
            "DOMAIN_NOT_ROUTABLE",
            "This email domain doesn't appear to accept mail.",
            422,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )
