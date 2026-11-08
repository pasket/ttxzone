"""The deployment's legal documents: the operator drafts and publishes them
from Platform, every account accepts them at signup and again after a
substantial change, and nothing is asked while none is published."""

import logging
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import LegalAcceptance, User, UserSession

PASSWORD = "Correcthorse123!"


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _register(client: TestClient, email: str, accepted: list | None = None):
    body = {"email": email, "password": PASSWORD, "full_name": "Pat"}
    if accepted is not None:
        body["accepted_legal"] = accepted
    return client.post("/api/v1/auth/register", json=body)


def _admin_client(db_session: Session) -> TestClient:
    """A signed-in instance administrator (TOTP on, recently authenticated)."""
    admin = TestClient(app)
    assert _register(admin, "ops@acme.com").status_code == 201
    user = db_session.exec(select(User).where(User.email == "ops@acme.com")).one()
    user.is_instance_admin = True
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    return admin


def _publish(admin: TestClient, kind: str, content: dict, requires_acceptance: bool = True) -> dict:
    saved = admin.put(
        f"/api/v1/instance/legal/{kind}/draft", json={"content": content}, headers=_csrf(admin)
    )
    assert saved.status_code == 200, saved.text
    published = admin.post(
        f"/api/v1/instance/legal/{kind}/publish",
        json={"requires_acceptance": requires_acceptance},
        headers=_csrf(admin),
    )
    assert published.status_code == 201, published.text
    return published.json()


def _publish_both(admin: TestClient) -> None:
    _publish(admin, "terms", {"en": "# Terms\n\nBe nice.", "es": "# Términos\n\nSé amable."})
    _publish(admin, "privacy", {"en": "# Privacy\n\nWe keep little."})
    # The publisher is an account too: it accepts what it published.
    accepted = admin.post(
        "/api/v1/auth/legal/accept",
        json={"acceptances": [{"kind": "terms", "version": 1}, {"kind": "privacy", "version": 1}]},
        headers=_csrf(admin),
    )
    assert accepted.status_code == 204, accepted.text


CURRENT = [{"kind": "terms", "version": 1}, {"kind": "privacy", "version": 1}]


def test_nothing_is_asked_while_nothing_is_published(client: TestClient) -> None:
    assert client.get("/api/v1/legal").json() == {"items": []}
    assert client.get("/api/v1/legal/terms").status_code == 404
    assert _register(client, "a@acme.com").status_code == 201
    assert client.get("/api/v1/auth/me").json()["legal_acceptance_pending"] == []
    assert client.get("/api/v1/organizations/mine").status_code == 200


def test_published_documents_are_public_in_the_language_asked(
    client: TestClient, db_session: Session
) -> None:
    _publish_both(_admin_client(db_session))

    listed = client.get("/api/v1/legal").json()["items"]
    assert [(item["kind"], item["version"], item["languages"]) for item in listed] == [
        ("terms", 1, ["en", "es"]),
        ("privacy", 1, ["en"]),
    ]
    spanish = client.get("/api/v1/legal/terms?lang=es").json()
    assert (spanish["language"], spanish["requested_language_available"]) == ("es", True)
    assert spanish["content"].startswith("# Términos")
    fallback = client.get("/api/v1/legal/privacy?lang=es").json()
    assert (fallback["language"], fallback["requested_language_available"]) == ("en", False)


def test_signup_needs_the_current_version_of_every_document(
    client: TestClient, db_session: Session
) -> None:
    _publish_both(_admin_client(db_session))

    missing = _register(client, "a@acme.com")
    assert missing.status_code == 400
    assert missing.json()["error"]["code"] == "LEGAL_ACCEPTANCE_REQUIRED"
    # A refused signup leaves no account behind.
    assert db_session.exec(select(User).where(User.email == "a@acme.com")).first() is None

    outdated = _register(
        client, "a@acme.com", [{"kind": "terms", "version": 1}, {"kind": "privacy", "version": 2}]
    )
    assert outdated.status_code == 409
    assert outdated.json()["error"]["code"] == "LEGAL_VERSION_OUTDATED"

    assert _register(client, "a@acme.com", CURRENT).status_code == 201
    user = db_session.exec(select(User).where(User.email == "a@acme.com")).one()
    rows = db_session.exec(select(LegalAcceptance).where(LegalAcceptance.user_id == user.id)).all()
    assert sorted((row.kind.value, row.version) for row in rows) == [("privacy", 1), ("terms", 1)]
    assert client.get("/api/v1/auth/me").json()["legal_acceptance_pending"] == []


def test_organization_signup_and_token_signup_record_the_acceptance(
    client: TestClient, db_session: Session
) -> None:
    _publish_both(_admin_client(db_session))
    body = {
        "organization": {"name": "Acme", "tax_id": None},
        "admin": {"email": "owner@acme.com", "password": PASSWORD, "full_name": "Owner"},
    }
    assert client.post("/api/v1/organizations", json=body).status_code == 400
    signed_up = client.post("/api/v1/organizations", json={**body, "accepted_legal": CURRENT})
    assert signed_up.status_code == 201, signed_up.text

    redeem = TestClient(app).post(
        "/api/v1/invitation-tokens/redeem",
        json={
            "token": "not-a-real-token",
            "account": {"email": "p@acme.com", "password": PASSWORD, "full_name": "Player"},
        },
    )
    # Checked before the token itself: no account without the acceptance.
    assert redeem.json()["error"]["code"] == "LEGAL_ACCEPTANCE_REQUIRED"


def test_a_substantial_change_holds_every_account_until_accepted(
    client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    admin = _admin_client(db_session)
    _publish_both(admin)
    assert _register(client, "a@acme.com", CURRENT).status_code == 201

    # A minor correction is only recorded.
    _publish(admin, "terms", {"en": "# Terms\n\nBe very nice."}, requires_acceptance=False)
    assert client.get("/api/v1/auth/me").json()["legal_acceptance_pending"] == []
    assert client.get("/api/v1/organizations/mine").status_code == 200

    _publish(admin, "terms", {"en": "# Terms\n\nNew rules."}, requires_acceptance=True)
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["legal_acceptance_pending"] == [
        {"kind": "terms", "version": 3, "updated": True}
    ]
    held = client.get("/api/v1/organizations/mine")
    assert held.status_code == 403
    assert held.json()["error"]["code"] == "LEGAL_ACCEPTANCE_REQUIRED"
    # The account itself and the documents stay reachable.
    assert client.get("/api/v1/auth/sessions").status_code == 200
    assert client.get("/api/v1/legal/terms").status_code == 200

    stale = client.post(
        "/api/v1/auth/legal/accept",
        json={"acceptances": [{"kind": "terms", "version": 2}]},
        headers=_csrf(client),
    )
    assert stale.status_code == 409
    with caplog.at_level(logging.INFO, logger="app.auth"):
        accepted = client.post(
            "/api/v1/auth/legal/accept",
            json={"acceptances": [{"kind": "terms", "version": 3}]},
            headers=_csrf(client),
        )
    assert accepted.status_code == 204
    assert "accepted terms v3" in caplog.text
    assert client.get("/api/v1/organizations/mine").status_code == 200


def test_the_first_version_always_requires_acceptance(
    client: TestClient, db_session: Session
) -> None:
    admin = _admin_client(db_session)
    assert _register(client, "a@acme.com").status_code == 201
    published = _publish(admin, "terms", {"en": "Terms."}, requires_acceptance=False)
    assert published["versions"][0]["requires_acceptance"] is True
    assert client.get("/api/v1/auth/me").json()["legal_acceptance_pending"] == [
        {"kind": "terms", "version": 1, "updated": False}
    ]


def test_platform_drafts_publishes_and_keeps_every_version(db_session: Session) -> None:
    admin = _admin_client(db_session)
    listed = admin.get("/api/v1/instance/legal").json()["items"]
    assert [item["kind"] for item in listed] == ["terms", "privacy"]
    assert listed[0]["versions"] == [] and listed[0]["has_unpublished_changes"] is False

    empty = admin.post(
        "/api/v1/instance/legal/terms/publish",
        json={"requires_acceptance": True},
        headers=_csrf(admin),
    )
    assert empty.json()["error"]["code"] == "LEGAL_DRAFT_EMPTY"

    saved = admin.put(
        "/api/v1/instance/legal/terms/draft",
        json={"content": {"en": "One.", "fr": "Un."}},
        headers=_csrf(admin),
    ).json()
    # Only supported languages are kept.
    assert saved["draft"]["content"] == {"en": "One."}
    assert saved["has_unpublished_changes"] is True

    published = _publish(admin, "terms", {"en": "One.", "es": "Uno."})
    assert published["has_unpublished_changes"] is False
    assert published["versions"][0]["published_by"] == "Pat"
    first = admin.get("/api/v1/instance/legal/terms/versions/1").json()
    assert first["content"] == {"en": "One.", "es": "Uno."}
    assert admin.get("/api/v1/instance/legal/terms/versions/9").status_code == 404


def test_publishing_needs_a_recent_authentication(db_session: Session) -> None:
    admin = _admin_client(db_session)
    admin.put(
        "/api/v1/instance/legal/terms/draft", json={"content": {"en": "x"}}, headers=_csrf(admin)
    )
    for user_session in db_session.exec(select(UserSession)).all():
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()
    stale = admin.post(
        "/api/v1/instance/legal/terms/publish",
        json={"requires_acceptance": True},
        headers=_csrf(admin),
    )
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"


def test_platform_is_the_instance_administrators_alone(client: TestClient) -> None:
    assert _register(client, "a@acme.com").status_code == 201
    assert client.get("/api/v1/instance/legal").status_code == 403
    denied = client.put(
        "/api/v1/instance/legal/terms/draft", json={"content": {"en": "x"}}, headers=_csrf(client)
    )
    assert denied.status_code == 403


def test_templates_carry_the_operators_details(db_session: Session) -> None:
    admin = _admin_client(db_session)
    rendered = admin.post(
        "/api/v1/instance/legal/templates",
        json={
            "operator_name": "Acme Security S.L.",
            "contact_email": "privacy@acme.com",
            "postal_address": "Calle Mayor 1, Madrid",
            "jurisdiction": "Spain",
        },
        headers=_csrf(admin),
    ).json()["items"]
    assert [item["kind"] for item in rendered] == ["terms", "privacy"]
    for item in rendered:
        assert set(item["content"]) == {"en", "es"}
        for text in item["content"].values():
            assert "Acme Security S.L." in text and "{{" not in text
    # Nothing is saved: the operator edits them in the draft.
    assert admin.get("/api/v1/instance/legal").json()["items"][0]["draft"]["content"] == {}


def test_templates_leave_out_a_missing_postal_address(db_session: Session) -> None:
    admin = _admin_client(db_session)
    rendered = admin.post(
        "/api/v1/instance/legal/templates",
        json={
            "operator_name": "Acme Security S.L.",
            "contact_email": "privacy@acme.com",
            "postal_address": "",
            "jurisdiction": "Spain",
        },
        headers=_csrf(admin),
    ).json()["items"]
    privacy = next(item for item in rendered if item["kind"] == "privacy")
    assert "Address:" not in privacy["content"]["en"]
    assert "Dirección:" not in privacy["content"]["es"]
    for item in rendered:
        for text in item["content"].values():
            assert "{{" not in text and "privacy@acme.com" in text


def test_each_account_sees_what_it_accepted_and_the_operator_exports_the_record(
    client: TestClient, db_session: Session
) -> None:
    admin = _admin_client(db_session)
    _publish_both(admin)
    assert _register(client, "=cmd@acme.com", CURRENT).status_code == 201

    mine = client.get("/api/v1/auth/legal/acceptances").json()["items"]
    assert sorted((a["kind"], a["version"]) for a in mine) == [("privacy", 1), ("terms", 1)]
    assert all(a["accepted_at"] for a in mine)

    # Only the operator exports everyone's.
    assert client.get("/api/v1/instance/legal/acceptances.csv").status_code == 403
    record = admin.get("/api/v1/instance/legal/acceptances.csv")
    assert record.status_code == 200
    assert record.headers["content-type"].startswith("text/csv")
    assert "attachment" in record.headers["content-disposition"]
    assert record.headers["cache-control"] == "private, no-store"
    text = record.content.decode("utf-8-sig")
    lines = text.strip().splitlines()
    assert lines[0] == "accepted_at_utc,email,full_name,document,version"
    assert len(lines) == 1 + 4  # the operator and the account, two documents each
    # A cell that a spreadsheet would run as a formula is kept as text.
    assert "'=cmd@acme.com" in text

    # It names every account: a stale sign-in authenticates again first.
    db_session.expire_all()
    for row in db_session.exec(select(UserSession)):
        row.authenticated_at = datetime.now(UTC) - timedelta(days=1)
        db_session.add(row)
    db_session.commit()
    stale = admin.get("/api/v1/instance/legal/acceptances.csv")
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
