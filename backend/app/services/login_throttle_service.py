"""Brute-force limits on the password step of signing in. Three counts, each
locking for LOGIN_LOCK: one account from one address (a mistyped password,
or someone guessing from one machine), one account from anywhere (guessing
spread over many machines) and one address over any accounts (one machine
trying many). The first limit being the lowest is what keeps someone who
guesses wrong on purpose, from one machine, from locking the real owner out.
Only failures count, so a room behind one address signing in at once is
fine. Locks are checked before the password is, so a locked attempt costs no
hashing, and the same whether or not the account exists.

Signing up says when an email is taken: it opens a session at once, which
can't be answered alike for an account that exists. So those answers are
limited too, per address, to keep a list of emails from being checked in
bulk (guarded_signup)."""

import hashlib
import ipaddress
import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

from sqlalchemy import case, delete, or_, update
from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import LoginThrottle
from app.services.auth_event_service import auth_event

LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS = 10
LOGIN_FAILURES_PER_ACCOUNT = 50
SIGNUP_TAKEN_EMAILS_PER_ADDRESS = 20
LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_LOCK = timedelta(minutes=15)


def _network(address: str | None) -> str:
    """Whoever holds an IPv6 address usually holds its whole /64."""
    if address is None:
        return "unknown"
    try:
        parsed = ipaddress.ip_address(address)
    except ValueError:
        return address
    if parsed.version == 4:
        return str(parsed)
    if parsed.ipv4_mapped is not None:
        return str(parsed.ipv4_mapped)
    return str(ipaddress.ip_network((parsed, 64), strict=False))


def _key(*parts: str) -> str:
    return hashlib.sha256("\0".join(parts).encode()).hexdigest()


def _account_keys(email: str, address: str | None) -> dict[str, int]:
    """What a right password clears: never the address's own count, or
    signing in to an account of one's own would reset it between guesses."""
    account = email.lower()
    return {
        _key("account+address", account, _network(address)): (
            LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS
        ),
        _key("account", account): LOGIN_FAILURES_PER_ACCOUNT,
    }


def _limits(email: str, address: str | None) -> dict[str, int]:
    return {
        **_account_keys(email, address),
        _key("address", _network(address)): settings.LOGIN_FAILURES_PER_ADDRESS,
    }


def ensure_allowed(session: Session, email: str, address: str | None) -> None:
    locked = session.exec(
        select(LoginThrottle.key).where(
            col(LoginThrottle.key).in_(_limits(email, address)),
            col(LoginThrottle.locked_until) > datetime.now(UTC),
        )
    ).first()
    if locked is not None:
        raise AppException(
            "LOGIN_THROTTLED",
            "Too many failed sign-ins. Try again later.",
            429,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )


def _count_failure(session: Session, key: str, now: datetime) -> int:
    """One atomic statement: API processes count the same key at once."""
    table = LoginThrottle.__table__  # type: ignore[attr-defined]
    window_over = table.c.window_started_at <= now - LOGIN_WINDOW
    statement = (
        insert(table)
        .values(key=key, failures=1, window_started_at=now)
        .on_conflict_do_update(
            index_elements=[table.c.key],
            set_={
                "failures": case((window_over, 1), else_=table.c.failures + 1),
                "window_started_at": case((window_over, now), else_=table.c.window_started_at),
            },
        )
        .returning(table.c.failures)
    )
    return session.execute(statement).scalar_one()


def _count_towards_lock(session: Session, key: str, limit: int, now: datetime) -> bool:
    """True when this one reaches `limit` and locks `key`."""
    if _count_failure(session, key, now) < limit:
        return False
    session.execute(
        update(LoginThrottle)
        .where(col(LoginThrottle.key) == key)
        .values(failures=0, window_started_at=now, locked_until=now + LOGIN_LOCK)
    )
    return True


def _lock_details(address: str | None) -> dict[str, str | int]:
    return {"address": _network(address), "minutes": int(LOGIN_LOCK.total_seconds() // 60)}


def record_failure(session: Session, email: str, address: str | None) -> None:
    now = datetime.now(UTC)
    locks = [
        _count_towards_lock(session, key, limit, now)
        for key, limit in _limits(email, address).items()
    ]
    session.commit()
    if any(locks):
        auth_event(
            session,
            "auth.login_locked",
            email=email,
            details=_lock_details(address),
            level=logging.WARNING,
        )


def clear(session: Session, email: str, address: str | None) -> None:
    """The right password, or a reset link spent: the person is back."""
    session.execute(
        delete(LoginThrottle).where(col(LoginThrottle.key).in_(_account_keys(email, address)))
    )
    session.commit()


@contextmanager
def guarded_signup(session: Session, email: str, address: str | None) -> Iterator[None]:
    """Around creating an account from an email anyone can type. While the
    address is locked every signup is refused, or the answer would still
    tell which emails are taken."""
    key = _key("signup", _network(address))
    locked = session.exec(
        select(LoginThrottle.key).where(
            col(LoginThrottle.key) == key,
            col(LoginThrottle.locked_until) > datetime.now(UTC),
        )
    ).first()
    if locked is not None:
        raise AppException(
            "SIGNUP_THROTTLED",
            "Too many attempts. Try again later.",
            429,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )
    try:
        yield
    except AppException as exc:
        if exc.code == "EMAIL_ALREADY_REGISTERED":
            session.rollback()
            reached = _count_towards_lock(
                session, key, SIGNUP_TAKEN_EMAILS_PER_ADDRESS, datetime.now(UTC)
            )
            session.commit()
            if reached:
                auth_event(
                    session,
                    "auth.signup_locked",
                    email=email,
                    details=_lock_details(address),
                    level=logging.WARNING,
                )
        raise


def prune_expired(session: Session, now: datetime | None = None) -> None:
    """Rows of a window and a lock both over count for nothing: without this
    a run of made-up emails would grow the table for good."""
    moment = now or datetime.now(UTC)
    session.execute(
        delete(LoginThrottle).where(
            col(LoginThrottle.window_started_at) <= moment - LOGIN_WINDOW,
            or_(
                col(LoginThrottle.locked_until).is_(None),
                col(LoginThrottle.locked_until) <= moment,
            ),
        )
    )
    session.commit()
