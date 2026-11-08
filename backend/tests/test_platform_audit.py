"""Platform -> Activity log beyond the list: downloading it (JSON Lines,
CSV) and forwarding it to a SIEM through a signed webhook -- queued with
each event, delivered in order, retried on failure. Plus the Accounts
list's sort and filters."""

import json
from datetime import UTC, datetime, timedelta

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core import crypto
from app.core.config import settings
from app.main import app
from app.models import (
    Organization,
    OrganizationMembership,
    OrgRoleEnum,
    PlatformAuditDelivery,
    PlatformAuditEvent,
    PlatformAuditWebhook,
    User,
)
from app.services import platform_audit_service
from tests.test_instance_tenancy import _csrf, _make_admin, _register, _stale_sign_in


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> TestClient:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    return client


def _user(db_session: Session, email: str) -> User:
    db_session.expire_all()
    return db_session.exec(select(User).where(User.email == email)).one()


def _suspend(client: TestClient, user: User):
    response = client.post(
        f"/api/v1/instance/accounts/{user.id}/suspend",
        json={"confirmation": user.email},
        headers=_csrf(client),
    )
    assert response.status_code == 200, response.text


def _another(db_session: Session, email: str) -> User:
    with TestClient(app) as other:
        _register(other, email)
    return _user(db_session, email)


class Collector:
    """Stands in for the SIEM: records each POST, answers `statuses` in turn."""

    def __init__(self, *statuses: int) -> None:
        self.statuses = list(statuses) or [200]
        self.batches: list[list[dict]] = []

    def __call__(self, webhook: PlatformAuditWebhook, events: list[dict]) -> int:
        self.batches.append(events)
        return self.statuses.pop(0) if len(self.statuses) > 1 else self.statuses[0]


def _set_webhook(client: TestClient, url: str = "https://siem.acme.com/hook", **extra):
    return client.put(
        "/api/v1/instance/audit/webhook",
        json={"url": url, **extra},
        headers=_csrf(client),
    )


def test_the_log_downloads_as_json_lines_or_csv_and_the_download_is_recorded(
    admin: TestClient, db_session: Session
) -> None:
    _suspend(admin, _another(db_session, "=cmd@acme.com"))

    jsonl = admin.get("/api/v1/instance/audit/export?action=account.suspend")
    csv = admin.get("/api/v1/instance/audit/export?format=csv")
    _stale_sign_in(db_session, "ops@acme.com")
    stale = admin.get("/api/v1/instance/audit/export")

    assert jsonl.status_code == 200, jsonl.text
    assert jsonl.headers["content-type"].startswith("application/x-ndjson")
    [event] = [json.loads(line) for line in jsonl.text.splitlines()]
    assert (event["action"], event["actor"], event["target"]) == (
        "account.suspend",
        "ops@acme.com",
        "=cmd@acme.com",
    )
    assert "attachment" in csv.headers["content-disposition"]
    # A cell a spreadsheet would run as a formula is kept as text.
    assert "'=cmd@acme.com" in csv.text
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    log = admin.get("/api/v1/instance/audit?action=audit.export").json()
    assert [e["details"]["format"] for e in log["items"]] == ["csv", "jsonl"]


def test_the_list_searches_who_and_what_and_sorts_by_date(
    admin: TestClient, db_session: Session
) -> None:
    _suspend(admin, _another(db_session, "pat@acme.com"))
    _suspend(admin, _another(db_session, "sam@acme.com"))

    found = admin.get("/api/v1/instance/audit?q=sam").json()
    oldest_first = admin.get("/api/v1/instance/audit?sort_dir=asc&action=account.suspend").json()

    # Who signed up, and what was done to them.
    assert [(e["action"], e["target_label"]) for e in found["items"]] == [
        ("account.suspend", "sam@acme.com"),
        ("auth.register", "sam@acme.com"),
    ]
    assert [e["target_label"] for e in oldest_first["items"]] == ["pat@acme.com", "sam@acme.com"]


def test_setting_the_webhook_needs_https_a_recent_sign_in_and_is_recorded(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    plain = _set_webhook(admin, "http://siem.acme.com/hook")
    with_credentials = _set_webhook(admin, "https://user:pw@siem.acme.com/hook")
    other_scheme = _set_webhook(admin, "file:///etc/passwd")
    created = _set_webhook(admin, authorization="Splunk abc")

    for refused in (plain, with_credentials, other_scheme):
        assert refused.json()["error"]["code"] == "AUDIT_WEBHOOK_URL_INVALID"
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["configured"] and body["enabled"] and body["has_authorization"]
    assert len(body["secret"]) >= 32
    assert "Splunk abc" not in created.text
    # Both kept encrypted at rest, never as written.
    stored = db_session.exec(select(PlatformAuditWebhook)).one()
    assert body["secret"] not in stored.secret_encrypted
    assert crypto.decrypt_secret(stored.secret_encrypted) == body["secret"]
    assert "Splunk" not in (stored.authorization_encrypted or "")
    assert crypto.decrypt_secret(stored.authorization_encrypted or "") == "Splunk abc"
    # An internal collector over plain http, where the deployment allows it.
    monkeypatch.setattr(settings, "AUDIT_WEBHOOK_ALLOW_HTTP", True)
    assert _set_webhook(admin, "http://10.0.0.5:8088/hook").status_code == 200

    _stale_sign_in(db_session, "ops@acme.com")
    assert _set_webhook(admin).json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    log = admin.get("/api/v1/instance/audit?action=audit_webhook.update").json()
    assert log["total"] == 2


def test_events_reach_the_collector_signed_and_in_order(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    collector = Collector()
    monkeypatch.setattr(platform_audit_service, "post_events", collector)
    assert _set_webhook(admin).status_code == 200
    _suspend(admin, _another(db_session, "pat@acme.com"))
    _suspend(admin, _another(db_session, "sam@acme.com"))

    delivered = platform_audit_service.deliver_pending(db_session)

    assert delivered == 5
    [batch] = collector.batches
    # The webhook's own setup goes first, then everything in order --
    # sign-ups included.
    assert [(e["action"], e["target"]) for e in batch] == [
        ("audit_webhook.update", None),
        ("auth.register", "pat@acme.com"),
        ("account.suspend", "pat@acme.com"),
        ("auth.register", "sam@acme.com"),
        ("account.suspend", "sam@acme.com"),
    ]
    assert db_session.exec(select(PlatformAuditDelivery)).all() == []
    webhook = admin.get("/api/v1/instance/audit/webhook").json()
    assert (webhook["pending"], webhook["last_status"], webhook["last_error"]) == (0, 200, None)


def test_a_failing_collector_keeps_the_queue_and_retries_the_head_later(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    collector = Collector(503, 200)
    monkeypatch.setattr(platform_audit_service, "post_events", collector)
    assert _set_webhook(admin).status_code == 200
    _suspend(admin, _another(db_session, "pat@acme.com"))

    assert platform_audit_service.deliver_pending(db_session) == 0
    webhook = admin.get("/api/v1/instance/audit/webhook").json()
    assert (webhook["pending"], webhook["last_status"], webhook["last_error"]) == (
        3,
        503,
        "HTTP 503",
    )
    # Not due yet: nothing is sent.
    assert platform_audit_service.deliver_pending(db_session) == 0
    assert len(collector.batches) == 1

    db_session.expire_all()
    for row in db_session.exec(select(PlatformAuditDelivery)):
        row.next_attempt_at = datetime.now(UTC) - timedelta(seconds=1)
        db_session.add(row)
    db_session.commit()
    assert platform_audit_service.deliver_pending(db_session) == 3
    assert [e["action"] for e in collector.batches[1]] == [
        "audit_webhook.update",
        "auth.register",
        "account.suspend",
    ]


def test_turned_off_nothing_is_queued_and_deleting_drops_the_queue(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    collector = Collector(500)
    monkeypatch.setattr(platform_audit_service, "post_events", collector)
    assert _set_webhook(admin).status_code == 200
    assert _set_webhook(admin, enabled=False).status_code == 200
    _suspend(admin, _another(db_session, "pat@acme.com"))

    assert admin.get("/api/v1/instance/audit/webhook").json()["pending"] == 1
    assert platform_audit_service.deliver_pending(db_session) == 0
    assert collector.batches == []

    deleted = admin.delete("/api/v1/instance/audit/webhook", headers=_csrf(admin))
    assert deleted.status_code == 204, deleted.text
    assert admin.get("/api/v1/instance/audit/webhook").json() == {
        "configured": False,
        "url": None,
        "enabled": False,
        "secret": None,
        "has_authorization": False,
        "pending": 0,
        "last_success_at": None,
        "last_failure_at": None,
        "last_status": None,
        "last_error": None,
        "allow_http": False,
    }
    assert admin.get("/api/v1/instance/audit?action=audit_webhook.delete").json()["total"] == 1


def test_a_test_delivery_and_a_new_secret(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    collector = Collector(200)
    monkeypatch.setattr(platform_audit_service, "post_events", collector)
    first = _set_webhook(admin).json()["secret"]

    tested = admin.post("/api/v1/instance/audit/webhook/test", headers=_csrf(admin))
    rotated = admin.post("/api/v1/instance/audit/webhook/rotate-secret", headers=_csrf(admin))

    assert tested.json() == {"ok": True, "status": 200, "error": None}
    assert collector.batches[0][0]["action"] == "audit_webhook.test"
    assert rotated.json()["secret"] != first


def test_the_signature_is_hmac_of_timestamp_and_body() -> None:
    import hashlib
    import hmac

    expected = hmac.new(b"s3cret", b"1700000000.{}", hashlib.sha256).hexdigest()
    assert platform_audit_service.sign("s3cret", "1700000000", b"{}") == expected


def test_accounts_sort_and_filter(admin: TestClient, db_session: Session) -> None:
    pat = _another(db_session, "pat@acme.com")
    _another(db_session, "abe@acme.com")
    _suspend(admin, pat)

    def emails(query: str) -> list[str]:
        response = admin.get(f"/api/v1/instance/accounts?{query}")
        assert response.status_code == 200, response.text
        return [a["email"] for a in response.json()["items"]]

    assert emails("status=suspended") == ["pat@acme.com"]
    assert set(emails("status=active")) == {"ops@acme.com", "abe@acme.com"}
    assert emails("instance_admin=true") == ["ops@acme.com"]
    assert set(emails("instance_admin=false")) == {"pat@acme.com", "abe@acme.com"}
    assert set(emails("organization=none")) == {"ops@acme.com", "pat@acme.com", "abe@acme.com"}
    # Same full name ("Pat") for all: name sort falls back to a stable order.
    assert emails("sort_by=created_at&sort_dir=asc") == [
        "ops@acme.com",
        "pat@acme.com",
        "abe@acme.com",
    ]
    assert admin.get("/api/v1/instance/accounts?sort_by=email").status_code == 422
    assert admin.get("/api/v1/instance/accounts?status=gone").status_code == 422


def test_accounts_filter_by_organization_and_role(admin: TestClient, db_session: Session) -> None:
    pat = _another(db_session, "pat@acme.com")
    abe = _another(db_session, "abe@acme.com")
    acme = Organization(name="Acme", domain="acme.com")
    other = Organization(name="Other", domain="other.com")
    db_session.add_all([acme, other])
    db_session.flush()
    db_session.add_all(
        [
            OrganizationMembership(
                user_id=pat.id, organization_id=acme.id, role=OrgRoleEnum.PLANNER
            ),
            OrganizationMembership(
                user_id=abe.id, organization_id=other.id, role=OrgRoleEnum.PLANNER
            ),
            OrganizationMembership(
                user_id=abe.id,
                organization_id=acme.id,
                role=OrgRoleEnum.OBSERVER,
                disabled_at=datetime.now(UTC),
            ),
        ]
    )
    db_session.commit()

    def emails(query: str) -> set[str]:
        response = admin.get(f"/api/v1/instance/accounts?{query}")
        assert response.status_code == 200, response.text
        return {a["email"] for a in response.json()["items"]}

    assert emails(f"organization={acme.id}") == {"pat@acme.com", "abe@acme.com"}
    assert emails("role=planner") == {"pat@acme.com", "abe@acme.com"}
    assert emails(f"organization={acme.id}&role=planner") == {"pat@acme.com"}
    # A disabled grant doesn't count as the role.
    assert emails("role=observer") == set()
    assert emails("organization=none") == {"ops@acme.com"}


def test_a_real_post_carries_the_signature_and_never_follows_a_redirect() -> None:
    import hashlib
    import hmac
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    received: list[tuple[str, dict, bytes]] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 -- http.server's name
            body = self.rfile.read(int(self.headers["Content-Length"]))
            received.append((self.path, {k.lower(): v for k, v in self.headers.items()}, body))
            if self.path == "/redirect":
                self.send_response(307)
                self.send_header("Location", "/elsewhere")
            else:
                self.send_response(204)
            self.end_headers()

        def log_message(self, *args: object) -> None:
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        webhook = PlatformAuditWebhook(
            url=f"{base}/hook",
            secret_encrypted=crypto.encrypt_secret("s3cret"),
            authorization_encrypted=crypto.encrypt_secret("Bearer t"),
        )
        status = platform_audit_service.post_events(webhook, [{"action": "x"}])
        redirected = platform_audit_service.post_events(
            PlatformAuditWebhook(
                url=f"{base}/redirect", secret_encrypted=crypto.encrypt_secret("s3cret")
            ),
            [],
        )
    finally:
        server.shutdown()

    assert (status, redirected) == (204, 307)
    # Only the two requests: the redirect wasn't followed.
    assert [path for path, _, _ in received] == ["/hook", "/redirect"]
    _, headers, body = received[0]
    assert json.loads(body) == {"source": "ttx-zone", "events": [{"action": "x"}]}
    assert headers["authorization"] == "Bearer t"
    expected = hmac.new(
        b"s3cret", headers["x-ttx-zone-timestamp"].encode() + b"." + body, hashlib.sha256
    ).hexdigest()
    assert headers["x-ttx-zone-signature"] == f"sha256={expected}"


def test_a_secret_no_key_decrypts_stops_delivery_with_a_reason(
    admin: TestClient, db_session: Session
) -> None:
    _set_webhook(admin)
    stored = db_session.exec(select(PlatformAuditWebhook)).one()
    # Encrypted with a key the server doesn't have (rotated without the old one).
    stored.secret_encrypted = Fernet(Fernet.generate_key()).encrypt(b"lost").decode()
    db_session.add(stored)
    db_session.commit()

    shown = admin.get("/api/v1/instance/audit/webhook").json()
    tested = admin.post("/api/v1/instance/audit/webhook/test", headers=_csrf(admin)).json()

    assert shown["secret"] is None
    assert "can't be decrypted" in tested["error"]
    rotated = admin.post("/api/v1/instance/audit/webhook/rotate-secret", headers=_csrf(admin))
    assert rotated.json()["secret"]


def test_the_retention_period_is_fixed(admin: TestClient) -> None:
    url = "/api/v1/instance/audit/retention"
    assert admin.get(url).json() == {
        "days": 90,
        "log_file_max_mb": 10,
        "log_file_backups": 5,
    }
    assert admin.put(url, json={"days": 30}, headers=_csrf(admin)).status_code == 405


def test_events_past_the_retention_period_go_unless_still_queued_for_the_siem(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(platform_audit_service, "post_events", Collector(503))
    assert _set_webhook(admin).status_code == 200
    _suspend(admin, _another(db_session, "pat@acme.com"))
    assert _set_webhook(admin, enabled=False).status_code == 200
    _suspend(admin, _another(db_session, "sam@acme.com"))
    db_session.expire_all()
    for event in db_session.exec(select(PlatformAuditEvent)):
        event.created_at -= timedelta(days=91)
        db_session.add(event)
    db_session.commit()
    _suspend(admin, _another(db_session, "kim@acme.com"))

    pruned = platform_audit_service.prune_expired(db_session)

    db_session.expire_all()
    kept = set(
        db_session.exec(select(PlatformAuditEvent.action, PlatformAuditEvent.target_label)).all()
    )
    # Old and already out (or never queued): gone.
    assert ("auth.register", "ops@acme.com") not in kept
    assert ("account.suspend", "sam@acme.com") not in kept
    # Old but the SIEM still waits for them: kept until delivered.
    assert ("auth.register", "pat@acme.com") in kept
    assert ("account.suspend", "pat@acme.com") in kept
    # Within the period: kept.
    assert ("auth.register", "kim@acme.com") in kept
    assert ("account.suspend", "kim@acme.com") in kept
    assert pruned >= 3
    assert platform_audit_service.prune_expired(db_session) == 0
