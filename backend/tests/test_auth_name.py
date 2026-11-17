"""Preferences: an account corrects its own name; the email stays the
instance administrator's to change."""

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import PlatformAuditEvent
from tests.test_auth_avatar import _csrf_headers, _signup


def _rename(client: TestClient, name: str):
    return client.put("/api/v1/auth/name", json={"full_name": name}, headers=_csrf_headers(client))


def test_an_account_corrects_its_own_name(client: TestClient, db_session: Session) -> None:
    _signup(client, "owner@acme.com", "Acme")

    assert _rename(client, "  Ada Lovelace ").status_code == 204
    assert client.get("/api/v1/auth/me").json()["full_name"] == "Ada Lovelace"
    [event] = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "account.update")
    ).all()
    assert event.actor_label == event.target_label == "owner@acme.com"
    assert event.details == {"full_name": {"before": "Ada", "after": "Ada Lovelace"}}

    # The same name again changes nothing and records nothing.
    assert _rename(client, "Ada Lovelace").status_code == 204
    assert (
        len(
            db_session.exec(
                select(PlatformAuditEvent).where(PlatformAuditEvent.action == "account.update")
            ).all()
        )
        == 1
    )


def test_a_name_cant_be_blank_or_too_long(client: TestClient) -> None:
    _signup(client, "owner@acme.com", "Acme")

    blank = _rename(client, "   ")
    assert blank.status_code == 422 and blank.json()["error"]["code"] == "NAME_REQUIRED"
    assert _rename(client, "").status_code == 422
    assert _rename(client, "x" * 256).status_code == 422
    assert client.get("/api/v1/auth/me").json()["full_name"] == "Ada"


def test_it_needs_a_session_and_the_csrf_token(client: TestClient) -> None:
    assert client.put("/api/v1/auth/name", json={"full_name": "Eve"}).status_code in (401, 403)
    _signup(client, "owner@acme.com", "Acme")
    assert client.put("/api/v1/auth/name", json={"full_name": "Eve"}).status_code == 403
