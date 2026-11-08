import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import AllowedDomainTagAssignment, PlatformAuditEvent, User
from tests.org_paths import org_base


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _enable_totp(db_session: Session, user_id: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_add_list_and_remove_allowed_domain(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner1@acme.com", "Acme1")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    add_response = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    )
    assert add_response.status_code == 201
    domain_id = add_response.json()["id"]

    list_response = client.get(f"{org_base(client)}/allowed-domains")
    assert list_response.status_code == 200
    # Newest first; acme.com is the org's own domain, seeded at signup.
    assert [item["domain"] for item in list_response.json()["items"]] == [
        "partner.com",
        "acme.com",
    ]

    delete_response = client.delete(
        f"{org_base(client)}/allowed-domains/{domain_id}", headers=headers
    )
    assert delete_response.status_code == 204

    after_delete = client.get(f"{org_base(client)}/allowed-domains")
    assert [item["domain"] for item in after_delete.json()["items"]] == ["acme.com"]

    # No step-up: the activity log records each change.
    events = db_session.exec(
        select(PlatformAuditEvent)
        .where(PlatformAuditEvent.action == "organization.allowed_domain")
        .order_by(PlatformAuditEvent.created_at)
    ).all()
    assert [(e.details or {}).get("op") for e in events] == ["add", "remove"]
    assert {(e.details or {}).get("domain") for e in events} == {"partner.com"}
    assert all(e.target_label == "Acme1" for e in events)


def test_signup_seeds_allowlist_with_org_domain(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-seed@acme.com", "SeedCo")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.get(f"{org_base(client)}/allowed-domains")

    assert response.status_code == 200
    assert [item["domain"] for item in response.json()["items"]] == ["acme.com"]


def test_add_duplicate_domain_is_rejected(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2@acme.com", "Acme2")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    )
    second = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    )

    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DOMAIN_ALREADY_ALLOWED"


def test_remove_unknown_domain_returns_404(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    response = client.delete(f"{org_base(client)}/allowed-domains/999999", headers=headers)

    assert response.status_code == 404


def test_list_allowed_domains_pagination_and_sort_dir(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner6@acme.com", "Acme6")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    for domain in ["first.com", "second.com", "third.com"]:
        client.post(
            f"{org_base(client)}/allowed-domains",
            json={"domain": domain},
            headers=headers,
        )

    page = client.get(f"{org_base(client)}/allowed-domains", params={"limit": 2, "offset": 0})
    body = page.json()
    assert body["total"] == 4  # three added + the seeded acme.com
    assert len(body["items"]) == 2
    assert body["items"][0]["domain"] == "third.com"  # newest first by default

    asc = client.get(f"{org_base(client)}/allowed-domains", params={"sort_dir": "asc"})
    asc_domains = [item["domain"] for item in asc.json()["items"]]
    assert asc_domains == ["acme.com", "first.com", "second.com", "third.com"]


def test_allowed_domain_endpoints_require_program_manager(client: TestClient) -> None:
    response = client.get(f"/api/v1/organizations/{uuid.uuid4()}/allowed-domains")

    assert response.status_code == 401


def test_cannot_remove_another_organizations_domain(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner4@acme.com", "Acme4")
    _enable_totp(db_session, owner["user"]["id"])
    add_response = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=_csrf_headers(client),
    )
    domain_id = add_response.json()["id"]

    client.cookies.clear()
    other_owner = _signup(client, "owner5@other.com", "Other5")
    _enable_totp(db_session, other_owner["user"]["id"])

    response = client.delete(
        f"{org_base(client)}/allowed-domains/{domain_id}",
        headers=_csrf_headers(client),
    )

    assert response.status_code == 404


def test_list_allowed_domains_search_and_alphabetical_sort(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-domains@acme.com", "DomainCo")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    for domain in ["zeta.com", "alpha.com", "beta.io"]:
        response = client.post(
            f"{org_base(client)}/allowed-domains",
            json={"domain": domain},
            headers=headers,
        )
        assert response.status_code == 201

    response = client.get(f"{org_base(client)}/allowed-domains?sort_by=name&sort_dir=asc")
    assert response.status_code == 200
    domains = [item["domain"] for item in response.json()["items"]]
    assert domains == ["acme.com", "alpha.com", "beta.io", "zeta.com"]

    response = client.get(f"{org_base(client)}/allowed-domains?q=.io")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["domain"] == "beta.io"


def test_list_allowed_domains_alphabetical_sort_desc(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-domains-desc@acme.com", "DomainDescCo")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    for domain in ["zeta.com", "alpha.com", "beta.io"]:
        response = client.post(
            f"{org_base(client)}/allowed-domains",
            json={"domain": domain},
            headers=headers,
        )
        assert response.status_code == 201

    # Z to A, the exact reverse of the asc test.
    response = client.get(f"{org_base(client)}/allowed-domains?sort_by=name&sort_dir=desc")
    assert response.status_code == 200
    domains = [item["domain"] for item in response.json()["items"]]
    assert domains == ["zeta.com", "beta.io", "alpha.com", "acme.com"]


def test_new_allowed_domain_starts_untagged(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-tag1@acme.com", "TagDomainCo1")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    response = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["tags"] == []


def test_set_and_clear_tags_on_an_allowed_domain(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-tag2@acme.com", "TagDomainCo2")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    domain_id = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    ).json()["id"]
    tag_id = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Trusted", "color": "moss"},
        headers=headers,
    ).json()["id"]

    set_response = client.put(
        f"{org_base(client)}/allowed-domains/{domain_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )
    assert set_response.status_code == 200
    assert [t["name"] for t in set_response.json()["tags"]] == ["Trusted"]

    list_response = client.get(f"{org_base(client)}/allowed-domains")
    assert [t["name"] for t in list_response.json()["items"][0]["tags"]] == ["Trusted"]

    clear_response = client.put(
        f"{org_base(client)}/allowed-domains/{domain_id}/tags",
        json={"tag_ids": []},
        headers=headers,
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["tags"] == []


def test_allowed_domain_tags_rejects_a_tag_id_from_another_organization(
    client: TestClient, db_session: Session
) -> None:
    # Foreign org/tag first, so the caller's own session (signed up second)
    # is the one left active on `client` -- see test_tag_custom_color.py's
    # equivalent tests for the same ordering trick and why it's needed
    # (this file's _enable_totp sets no real secret, so a full re-login
    # round trip to switch back isn't an option).
    other_owner = _signup(client, "owner-tag3@other.com", "OtherTagDomainCo")
    _enable_totp(db_session, other_owner["user"]["id"])
    foreign_tag_id = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Foreign", "color": "slate"},
        headers=_csrf_headers(client),
    ).json()["id"]

    client.cookies.clear()
    owner = _signup(client, "owner-tag4@acme.com", "TagDomainCo4")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)
    domain_id = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    ).json()["id"]

    response = client.put(
        f"{org_base(client)}/allowed-domains/{domain_id}/tags",
        json={"tag_ids": [foreign_tag_id]},
        headers=headers,
    )
    assert response.status_code == 404


def test_set_tags_on_unknown_domain_returns_404(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-tag5@acme.com", "TagDomainCo5")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    response = client.put(
        f"{org_base(client)}/allowed-domains/999999/tags",
        json={"tag_ids": []},
        headers=headers,
    )
    assert response.status_code == 404


def test_set_allowed_domain_tags_requires_csrf(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-tag6@acme.com", "TagDomainCo6")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    domain_id = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    ).json()["id"]

    response = client.put(
        f"{org_base(client)}/allowed-domains/{domain_id}/tags",
        json={"tag_ids": []},
    )
    assert response.status_code == 403


def test_removing_allowed_domain_cleans_up_tag_assignments(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-tag7@acme.com", "TagDomainCo7")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    domain_id = client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "partner.com"},
        headers=headers,
    ).json()["id"]
    tag_id = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Trusted", "color": "moss"},
        headers=headers,
    ).json()["id"]
    client.put(
        f"{org_base(client)}/allowed-domains/{domain_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )

    assert (
        len(
            db_session.exec(
                select(AllowedDomainTagAssignment).where(
                    AllowedDomainTagAssignment.organization_allowed_domain_id == domain_id
                )
            ).all()
        )
        == 1
    )

    delete_response = client.delete(
        f"{org_base(client)}/allowed-domains/{domain_id}", headers=headers
    )
    assert delete_response.status_code == 204

    remaining = db_session.exec(
        select(AllowedDomainTagAssignment).where(
            AllowedDomainTagAssignment.organization_allowed_domain_id == domain_id
        )
    ).all()
    assert remaining == []
