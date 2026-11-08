"""Brute-force limits on the password step, and that neither their answers
nor the time a sign-in takes say who has an account."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.main import app
from app.models import LoginThrottle, PlatformAuditEvent, User
from app.services import login_throttle_service
from app.services.login_throttle_service import (
    LOGIN_FAILURES_PER_ACCOUNT,
    LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS,
    LOGIN_LOCK,
    SIGNUP_TAKEN_EMAILS_PER_ADDRESS,
)

PASSWORD = "Correcthorse123!"
EMAIL = "pat@example.com"


def _register(client: TestClient, email: str = EMAIL) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Pat"},
    )
    assert response.status_code == 201
    client.cookies.clear()


def _sign_in(client: TestClient, email: str = EMAIL, password: str = PASSWORD, address=None):
    if address is not None:
        client = TestClient(app, client=(address, 50000))
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _fail(client: TestClient, times: int, email: str = EMAIL, address=None) -> None:
    for _ in range(times):
        assert _sign_in(client, email, "wrong-password", address).status_code == 401


def _assert_throttled(response) -> None:
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "LOGIN_THROTTLED"


def test_repeated_failures_lock_even_the_right_password(client: TestClient) -> None:
    _register(client)
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS)
    _assert_throttled(_sign_in(client))


def test_a_locked_attempt_never_hashes_the_password(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS)

    monkeypatch.setattr(security, "_password_hasher", None)
    _assert_throttled(_sign_in(client))


def test_the_lock_ends(client: TestClient, db_session: Session) -> None:
    _register(client)
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS)
    for row in db_session.exec(select(LoginThrottle)).all():
        if row.locked_until is not None:
            row.locked_until = datetime.now(UTC) - timedelta(seconds=1)
            db_session.add(row)
    db_session.commit()
    assert _sign_in(client).status_code == 200


def test_failures_past_the_window_start_over(client: TestClient, db_session: Session) -> None:
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS - 1)
    for row in db_session.exec(select(LoginThrottle)).all():
        row.window_started_at = datetime.now(UTC) - timedelta(minutes=16)
        db_session.add(row)
    db_session.commit()
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS - 1)
    assert _sign_in(client, password="wrong-password").status_code == 401


def test_the_right_password_forgives_the_failures_before_it(client: TestClient) -> None:
    _register(client)
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS - 1)
    assert _sign_in(client).status_code == 200
    client.cookies.clear()
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS - 1)
    assert _sign_in(client, password="wrong-password").status_code == 401


def test_one_machine_cannot_lock_the_owner_out(client: TestClient) -> None:
    _register(client)
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS, address="198.51.100.7")
    _assert_throttled(_sign_in(client, address="198.51.100.7"))
    assert _sign_in(client, address="203.0.113.9").status_code == 200


def test_guessing_spread_over_many_machines_locks_the_account(client: TestClient) -> None:
    _register(client)
    for attempt in range(LOGIN_FAILURES_PER_ACCOUNT):
        _fail(client, 1, address=f"198.51.100.{attempt + 1}")
    _assert_throttled(_sign_in(client, address="203.0.113.9"))


def test_one_address_trying_many_accounts_is_locked(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_FAILURES_PER_ADDRESS", 3)
    _register(client)
    for number in range(3):
        _fail(client, 1, f"nobody{number}@example.com", "198.51.100.7")
    _assert_throttled(_sign_in(client, address="198.51.100.7"))
    assert _sign_in(client, address="203.0.113.9").status_code == 200


def test_signing_in_to_ones_own_account_does_not_reset_the_address(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_FAILURES_PER_ADDRESS", 3)
    _register(client)
    _fail(client, 2, "nobody@example.com", "198.51.100.7")
    assert _sign_in(client, address="198.51.100.7").status_code == 200
    _fail(client, 1, "nobody2@example.com", "198.51.100.7")
    _assert_throttled(_sign_in(client, address="198.51.100.7"))


def test_a_whole_ipv6_prefix_counts_as_one_address(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_FAILURES_PER_ADDRESS", 2)
    _fail(client, 1, "a@example.com", "2001:db8:1:2::1")
    _fail(client, 1, "b@example.com", "2001:db8:1:2:ffff::9")
    _assert_throttled(_sign_in(client, address="2001:db8:1:2::abcd"))


def test_an_unknown_email_locks_like_an_account(client: TestClient) -> None:
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS, "nobody@example.com")
    _assert_throttled(_sign_in(client, "nobody@example.com"))


def test_the_email_counts_whatever_its_case(client: TestClient) -> None:
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS - 1, "Pat@Example.com")
    _fail(client, 1, "pat@example.com")
    _assert_throttled(_sign_in(client, "PAT@example.com"))


def test_the_lock_reaches_the_activity_log_once(client: TestClient, db_session: Session) -> None:
    _fail(client, LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS)
    _sign_in(client)
    events = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "auth.login_locked")
    ).all()
    assert len(events) == 1
    assert events[0].target_label == EMAIL


def test_rows_past_their_window_and_lock_are_pruned(db_session: Session) -> None:
    now = datetime.now(UTC)
    over = now - timedelta(minutes=16)
    db_session.add(LoginThrottle(key="over", failures=1, window_started_at=over))
    db_session.add(LoginThrottle(key="counting", failures=1, window_started_at=now))
    db_session.add(
        LoginThrottle(key="locked", window_started_at=over, locked_until=now + LOGIN_LOCK)
    )
    db_session.commit()
    login_throttle_service.prune_expired(db_session, now)
    assert set(db_session.exec(select(LoginThrottle.key)).all()) == {"counting", "locked"}


@pytest.mark.parametrize("email", ["nobody@example.com", "sso-only@example.com"])
def test_no_account_costs_the_same_hashing_as_a_wrong_password(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    email: str,
) -> None:
    """The answer was already the same; the time it took wasn't."""
    if email.startswith("sso"):
        _register(client, email)
        user = db_session.exec(select(User).where(User.email == email)).one()
        user.hashed_password = None
        db_session.add(user)
        db_session.commit()
    verified: list[str] = []
    real_hasher = security._password_hasher

    class CountingHasher:
        def verify(self, hashed: str, plain: str) -> bool:
            verified.append(hashed)
            return real_hasher.verify(hashed, plain)

    monkeypatch.setattr(security, "_password_hasher", CountingHasher())
    assert _sign_in(client, email, "wrong-password").status_code == 401
    assert verified == [security._NO_PASSWORD_HASH]


def test_the_stand_in_hash_never_matches() -> None:
    assert security.verify_password("anything", None) is False


def _register_from(address: str, email: str):
    return TestClient(app, client=(address, 50000)).post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Pat"},
    )


def _taken(address: str, times: int) -> None:
    for _ in range(times):
        assert _register_from(address, EMAIL).status_code == 409


def test_checking_taken_emails_in_bulk_locks_the_addresss_signups(client: TestClient) -> None:
    _register(client)
    _taken("198.51.100.7", SIGNUP_TAKEN_EMAILS_PER_ADDRESS)

    # Both refused alike, or the answer would still tell which is taken.
    for email in (EMAIL, "free@example.com"):
        refused = _register_from("198.51.100.7", email)
        assert refused.status_code == 429
        assert refused.json()["error"]["code"] == "SIGNUP_THROTTLED"
    assert _register_from("203.0.113.9", "free@example.com").status_code == 201


def test_a_signup_lock_leaves_signing_in_alone(client: TestClient) -> None:
    _register(client)
    _taken("198.51.100.7", SIGNUP_TAKEN_EMAILS_PER_ADDRESS)
    assert _sign_in(client, address="198.51.100.7").status_code == 200


def test_new_accounts_never_count_towards_the_signup_lock(client: TestClient) -> None:
    for number in range(SIGNUP_TAKEN_EMAILS_PER_ADDRESS + 1):
        assert _register_from("198.51.100.7", f"new{number}@example.com").status_code == 201


def test_founding_an_organization_shares_the_signup_lock(client: TestClient) -> None:
    _register(client)
    _taken("198.51.100.7", SIGNUP_TAKEN_EMAILS_PER_ADDRESS)
    response = TestClient(app, client=("198.51.100.7", 50000)).post(
        "/api/v1/organizations",
        json={
            "organization": {"name": "Acme", "tax_id": None},
            "admin": {"email": EMAIL, "password": PASSWORD, "full_name": "Pat"},
        },
    )
    assert response.status_code == 429


def test_the_signup_lock_reaches_the_activity_log_once(
    client: TestClient, db_session: Session
) -> None:
    _register(client)
    _taken("198.51.100.7", SIGNUP_TAKEN_EMAILS_PER_ADDRESS)
    _register_from("198.51.100.7", EMAIL)
    events = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "auth.signup_locked")
    ).all()
    assert len(events) == 1
