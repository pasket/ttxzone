import dns.exception
import dns.resolver
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


def _signup_payload(email: str, org_name: str) -> dict:
    return {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }


@pytest.fixture
def enable_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ORG_CREATION_DOMAIN_POLICY_ENABLED", True)


def _mock_resolve_always_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dns.resolver.Resolver, "resolve", lambda self, domain, rtype: ["ok"])


def _mock_resolve_no_mail_infra(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_resolve(self, domain, rtype):
        raise dns.resolver.NXDOMAIN()

    monkeypatch.setattr(dns.resolver.Resolver, "resolve", fake_resolve)


def _mock_resolve_times_out(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_resolve(self, domain, rtype):
        raise dns.exception.Timeout()

    monkeypatch.setattr(dns.resolver.Resolver, "resolve", fake_resolve)


def test_free_webmail_domain_is_rejected(client: TestClient, enable_policy) -> None:
    response = client.post("/api/v1/organizations", json=_signup_payload("owner@gmail.com", "Acme"))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "FREE_EMAIL_DOMAIN_BLOCKED"


def test_corporate_domain_with_mail_infra_succeeds(
    client: TestClient, enable_policy, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_resolve_always_succeeds(monkeypatch)

    response = client.post(
        "/api/v1/organizations", json=_signup_payload("owner@acme-corp.example", "Acme Corp")
    )

    assert response.status_code == 201


def test_domain_with_no_mail_infrastructure_is_rejected(
    client: TestClient, enable_policy, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_resolve_no_mail_infra(monkeypatch)

    response = client.post(
        "/api/v1/organizations", json=_signup_payload("owner@no-such-mail.example", "Acme Corp")
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "DOMAIN_NOT_ROUTABLE"


def test_dns_timeout_does_not_block_signup(
    client: TestClient, enable_policy, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_resolve_times_out(monkeypatch)

    response = client.post(
        "/api/v1/organizations", json=_signup_payload("owner@flaky-dns.example", "Acme Corp")
    )

    assert response.status_code == 201


def test_policy_disabled_bypasses_all_checks(client: TestClient) -> None:
    # No enable_policy fixture -- the autouse conftest fixture keeps the
    # policy off, and no DNS mock is installed at all, proving no lookup
    # is attempted when the flag is disabled.
    response = client.post(
        "/api/v1/organizations", json=_signup_payload("owner@gmail.com", "Admin")
    )

    assert response.status_code == 201
