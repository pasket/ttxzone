"""How many database statements a Player's fetch of the live session
costs once the server is warm: with hundreds of Players, every change of
the session is that many fetches (docs/deployment.md, section 10). A
budget, so it doesn't creep back up."""

import dataclasses
import time
from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.main import create_app
from app.models import (
    LegalDocumentKind,
    LegalDocumentVersion,
    RoleEnum,
    TTXAccess,
    User,
)
from app.services import exercise_run_service, legal_service, security_policy_service
from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import PASSWORD

PLAYER = "pat.player@acme.com"
# Session, user, grant, memberships, exercise, run, presence (touch), and
# the slack of a cache expiring mid-test.
BUDGET = 9


@contextmanager
def counted() -> Iterator[list[str]]:
    statements: list[str] = []

    def count(conn, cursor, statement, parameters, context, executemany):
        statements.append(" ".join(statement.split())[:80])

    event.listen(engine, "before_cursor_execute", count)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", count)


@pytest.fixture
def warm(monkeypatch: pytest.MonkeyPatch) -> None:
    """The caches as a server runs them, emptied first."""
    monkeypatch.setattr(settings, "RUN_PRESENCE_CACHE_SECONDS", 60.0)
    monkeypatch.setattr(settings, "RUN_VIEW_CACHE_SECONDS", 60.0)
    monkeypatch.setattr(settings, "INSTANCE_CACHE_SECONDS", 60.0)
    exercise_run_service._present_cache.clear()
    exercise_run_service._shared_views.clear()
    security_policy_service.forget_cached_policies()
    legal_service.forget_cached_versions()


@pytest.fixture
def playing(client: TestClient, db_session: Session, ready: str, warm: None) -> str:  # noqa: F811
    _post(client, ready, "/start")
    _as_player(client, db_session, ready)
    return ready


def _fetch_cost(client: TestClient, ttx_id: str) -> list[str]:
    client.get(_url(ttx_id), params={"as": "player"})  # present, caches warm
    with counted() as statements:
        response = client.get(_url(ttx_id), params={"as": "player"})
    assert response.status_code == 200, response.text
    return statements


def test_a_players_fetch_on_the_internal_face(client: TestClient, playing: str) -> None:
    statements = _fetch_cost(client, playing)
    assert len(statements) <= BUDGET, f"{len(statements)} statements:\n" + "\n".join(statements)


def test_a_players_fetch_on_the_public_face(client: TestClient, playing: str) -> None:
    with TestClient(create_app("api-public")) as public:
        public.post("/api/v1/auth/login", json={"email": PLAYER, "password": PASSWORD})
        statements = _fetch_cost(public, playing)
    assert len(statements) <= BUDGET, f"{len(statements)} statements:\n" + "\n".join(statements)


def _user(db_session: Session, email: str) -> User:
    user = User(email=email, hashed_password=None, full_name=email)
    db_session.add(user)
    db_session.commit()
    return user


def test_platform_changes_apply_at_once_in_the_process_that_saves_them(
    db_session: Session, warm: None
) -> None:
    admin = _user(db_session, "ops@acme.com")
    reader = _user(db_session, "pat@acme.com")
    # Read once: cached.
    assert legal_service.pending_acceptances(db_session, reader) == []
    assert security_policy_service.effective_mfa_policy(db_session).player is False

    legal_service.save_draft(db_session, admin, LegalDocumentKind.TERMS, {"en": "Terms."})
    legal_service.publish(db_session, admin, LegalDocumentKind.TERMS, True)
    password = security_policy_service.effective_password_policy(db_session)
    mfa = security_policy_service.effective_mfa_policy(db_session)
    security_policy_service.update_security_policy(
        db_session, admin, password, dataclasses.replace(mfa, player=True)
    )

    assert [v.kind for v in legal_service.pending_acceptances(db_session, reader)] == [
        LegalDocumentKind.TERMS
    ]
    assert security_policy_service.effective_mfa_policy(db_session).player is True


def test_elsewhere_they_apply_once_the_cache_expires(
    db_session: Session, warm: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = _user(db_session, "ops@acme.com")
    reader = _user(db_session, "pat@acme.com")
    assert legal_service.pending_acceptances(db_session, reader) == []
    # Published by another process: this one doesn't know yet.
    db_session.add(
        LegalDocumentVersion(
            kind=LegalDocumentKind.TERMS,
            version=1,
            content={"en": "Terms."},
            requires_acceptance=True,
            published_by_user_id=admin.id,
        )
    )
    db_session.commit()
    assert legal_service.pending_acceptances(db_session, reader) == []

    later = time.monotonic() + settings.INSTANCE_CACHE_SECONDS + 1
    monkeypatch.setattr(legal_service.time, "monotonic", lambda: later)
    assert len(legal_service.pending_acceptances(db_session, reader)) == 1


def test_a_grant_is_read_again_on_the_next_request(
    client: TestClient, db_session: Session, playing: str
) -> None:
    assert client.get(_url(playing), params={"as": "player"}).status_code == 200
    access = db_session.exec(select(TTXAccess).where(TTXAccess.role == RoleEnum.PLAYER)).one()
    db_session.delete(access)
    db_session.commit()

    assert client.get(_url(playing), params={"as": "player"}).status_code == 403
