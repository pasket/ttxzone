import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import OrganizationMembership, OrgRoleEnum, User
from tests.org_paths import org_base

# Grants straight to other domains: see conftest.direct_grants.
pytestmark = pytest.mark.usefixtures("direct_grants")


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


def _founder_stops_planning(client: TestClient, owner: dict) -> None:
    """The founder is an org Planner too; drop that so a listing holds
    only the Planners a test grants."""
    response = client.delete(
        f"{org_base(client)}/planners/{owner['user']['id']}", headers=_csrf_headers(client)
    )
    assert response.status_code == 204


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_program_manager_grants_planner_to_existing_user(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    _enable_totp(db_session, owner["user"]["id"])

    target = User(email="future-eval@acme.com", hashed_password="unused", full_name="Future Eval")
    db_session.add(target)
    db_session.commit()
    db_session.refresh(target)

    response = client.post(
        f"{org_base(client)}/planners",
        json={"email": "future-eval@acme.com"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user_id"] == str(target.id)
    assert body["email"] == "future-eval@acme.com"

    membership = db_session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == target.id,
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
        )
    ).first()
    assert membership is not None
    assert membership.organization_id == uuid.UUID(owner["organization"]["id"])


def test_grant_planner_unknown_email_returns_404(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2@acme.com", "Acme2")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.post(
        f"{org_base(client)}/planners",
        json={"email": "nobody@nowhere.com"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 404


def test_grant_planner_twice_is_rejected(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    _enable_totp(db_session, owner["user"]["id"])

    target = User(email="dup-eval@acme.com", hashed_password="unused", full_name="Dup Eval")
    db_session.add(target)
    db_session.commit()

    headers = _csrf_headers(client)
    first = client.post(
        f"{org_base(client)}/planners", json={"email": "dup-eval@acme.com"}, headers=headers
    )
    second = client.post(
        f"{org_base(client)}/planners", json={"email": "dup-eval@acme.com"}, headers=headers
    )

    assert first.status_code == 201
    assert second.status_code == 409


def test_grant_planner_blocked_by_domain_allowlist(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner9@acme.com", "Acme9")
    _enable_totp(db_session, owner["user"]["id"])

    target = User(email="outsider@notallowed.com", hashed_password="unused", full_name="Outsider")
    db_session.add(target)
    db_session.commit()

    # Only the seeded org domain (acme.com) is allowed.
    response = client.post(
        f"{org_base(client)}/planners",
        json={"email": "outsider@notallowed.com"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "DOMAIN_NOT_ALLOWED"


def test_grant_planner_denied_when_allowlist_is_empty(
    client: TestClient, db_session: Session
) -> None:
    # Default-deny: removing every allowed domain -- even the org's own,
    # seeded at signup -- blocks all Planner grants.
    owner = _signup(client, "owner11@acme.com", "Acme11")
    _enable_totp(db_session, owner["user"]["id"])

    target = User(email="insider11@acme.com", hashed_password="unused", full_name="Insider")
    db_session.add(target)
    db_session.commit()

    headers = _csrf_headers(client)
    for item in client.get(f"{org_base(client)}/allowed-domains").json()["items"]:
        client.delete(f"{org_base(client)}/allowed-domains/{item['id']}", headers=headers)

    response = client.post(
        f"{org_base(client)}/planners",
        json={"email": "insider11@acme.com"},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "DOMAIN_NOT_ALLOWED"


def test_grant_planner_allowed_by_domain_allowlist(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner10@acme.com", "Acme10")
    _enable_totp(db_session, owner["user"]["id"])

    target = User(email="insider@acme.com", hashed_password="unused", full_name="Insider")
    db_session.add(target)
    db_session.commit()

    # acme.com is on the allowlist from signup -- no setup needed.
    response = client.post(
        f"{org_base(client)}/planners",
        json={"email": "insider@acme.com"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 201


def test_grant_planner_without_totp_is_denied(client: TestClient) -> None:
    _signup(client, "owner4@acme.com", "Acme4")

    response = client.post(
        f"{org_base(client)}/planners",
        json={"email": "someone@acme.com"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "MFA_REQUIRED"


def test_grant_planner_resolves_caller_own_org_not_a_client_supplied_one(
    client: TestClient, db_session: Session
) -> None:
    # BOLA check: the org is always resolved server-side from the caller's
    # own Program Manager membership (require_program_manager_org), never trusted
    # from the request -- there's no organization_id field in the payload
    # at all, so granting from Acme's owner can only ever affect Acme.
    owner = _signup(client, "owner6@acme.com", "Acme6")
    _enable_totp(db_session, owner["user"]["id"])

    client.cookies.clear()
    other_owner = _signup(client, "otherowner@other.com", "Other Org")
    _enable_totp(db_session, other_owner["user"]["id"])

    target = User(
        email="cross-tenant@other.com", hashed_password="unused", full_name="Cross Tenant"
    )
    db_session.add(target)
    db_session.commit()

    response = client.post(
        f"{org_base(client)}/planners",
        json={"email": "cross-tenant@other.com"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 201

    membership = db_session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == target.id,
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
        )
    ).first()
    assert membership is not None
    assert membership.organization_id == uuid.UUID(other_owner["organization"]["id"])
    assert membership.organization_id != uuid.UUID(owner["organization"]["id"])


def test_list_planners_returns_granted_users(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner5@acme.com", "Acme5")
    _enable_totp(db_session, owner["user"]["id"])

    target = User(email="listed-eval@acme.com", hashed_password="unused", full_name="Listed Eval")
    db_session.add(target)
    db_session.commit()

    client.post(
        f"{org_base(client)}/planners",
        json={"email": "listed-eval@acme.com"},
        headers=_csrf_headers(client),
    )

    response = client.get(f"{org_base(client)}/planners")

    assert response.status_code == 200
    emails = [item["email"] for item in response.json()["items"]]
    assert "listed-eval@acme.com" in emails


def test_list_planners_exposes_last_login_at(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-ll@acme.com", "AcmeLL")
    _enable_totp(db_session, owner["user"]["id"])

    stamp = datetime(2026, 1, 15, 9, 30, tzinfo=UTC)
    target = User(
        email="seen-eval@acme.com",
        hashed_password="unused",
        full_name="Seen Eval",
        last_login_at=stamp,
    )
    never = User(email="never-eval@acme.com", hashed_password="unused", full_name="Never Eval")
    db_session.add_all([target, never])
    db_session.commit()

    for email in ("seen-eval@acme.com", "never-eval@acme.com"):
        client.post(
            f"{org_base(client)}/planners", json={"email": email}, headers=_csrf_headers(client)
        )

    items = {i["email"]: i for i in client.get(f"{org_base(client)}/planners").json()["items"]}

    assert datetime.fromisoformat(items["seen-eval@acme.com"]["last_login_at"]) == stamp
    assert items["never-eval@acme.com"]["last_login_at"] is None


def test_list_planners_sort_by_last_login(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-sl@acme.com", "AcmeSL")
    _enable_totp(db_session, owner["user"]["id"])
    _founder_stops_planning(client, owner)

    db_session.add_all(
        [
            User(
                email="old-login@acme.com",
                hashed_password="unused",
                full_name="Old",
                last_login_at=datetime(2025, 1, 1, tzinfo=UTC),
            ),
            User(
                email="new-login@acme.com",
                hashed_password="unused",
                full_name="New",
                last_login_at=datetime(2026, 9, 1, tzinfo=UTC),
            ),
            User(email="no-login@acme.com", hashed_password="unused", full_name="Never"),
        ]
    )
    db_session.commit()
    for email in ("old-login@acme.com", "new-login@acme.com", "no-login@acme.com"):
        client.post(
            f"{org_base(client)}/planners", json={"email": email}, headers=_csrf_headers(client)
        )

    def emails(sort_dir: str) -> list[str]:
        response = client.get(f"{org_base(client)}/planners?sort_by=last_login&sort_dir={sort_dir}")
        assert response.status_code == 200
        return [item["email"] for item in response.json()["items"]]

    # Never-logged-in counts as the least recent: last when newest-first,
    # first when oldest-first.
    assert emails("desc") == ["new-login@acme.com", "old-login@acme.com", "no-login@acme.com"]
    assert emails("asc") == ["no-login@acme.com", "old-login@acme.com", "new-login@acme.com"]


def test_allowed_domains_reject_last_login_sort(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-dl@acme.com", "AcmeDL")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.get(f"{org_base(client)}/allowed-domains?sort_by=last_login")

    assert response.status_code == 422


def test_list_planners_pagination_and_sort_dir(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner11@acme.com", "Acme11")
    _enable_totp(db_session, owner["user"]["id"])
    _founder_stops_planning(client, owner)

    for i in range(3):
        target = User(email=f"eval{i}@acme.com", hashed_password="unused", full_name=f"Eval {i}")
        db_session.add(target)
        db_session.commit()
        client.post(
            f"{org_base(client)}/planners",
            json={"email": f"eval{i}@acme.com"},
            headers=_csrf_headers(client),
        )

    page = client.get(f"{org_base(client)}/planners", params={"limit": 2, "offset": 0})
    body = page.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["items"][0]["email"] == "eval2@acme.com"  # newest first by default

    asc = client.get(f"{org_base(client)}/planners", params={"sort_dir": "asc"})
    asc_emails = [item["email"] for item in asc.json()["items"]]
    assert asc_emails == ["eval0@acme.com", "eval1@acme.com", "eval2@acme.com"]


def test_list_planners_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.get(f"/api/v1/organizations/{uuid.uuid4()}/planners")

    assert response.status_code == 401


def test_revoke_planner_removes_membership_only(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner7@acme.com", "Acme7")
    _enable_totp(db_session, owner["user"]["id"])

    target = User(email="revoke-me@acme.com", hashed_password="unused", full_name="Revoke Me")
    db_session.add(target)
    db_session.commit()
    db_session.refresh(target)

    grant = client.post(
        f"{org_base(client)}/planners",
        json={"email": "revoke-me@acme.com"},
        headers=_csrf_headers(client),
    )
    assert grant.status_code == 201

    response = client.delete(
        f"{org_base(client)}/planners/{target.id}", headers=_csrf_headers(client)
    )

    assert response.status_code == 204
    membership = db_session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == target.id,
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
        )
    ).first()
    assert membership is None


def test_revoke_planner_not_granted_returns_404(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner8@acme.com", "Acme8")
    _enable_totp(db_session, owner["user"]["id"])

    stranger = User(email="never-granted@acme.com", hashed_password="unused", full_name="Stranger")
    db_session.add(stranger)
    db_session.commit()
    db_session.refresh(stranger)

    response = client.delete(
        f"{org_base(client)}/planners/{stranger.id}", headers=_csrf_headers(client)
    )

    assert response.status_code == 404


def test_revoke_planner_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.delete(f"/api/v1/organizations/{uuid.uuid4()}/planners/{uuid.uuid4()}")

    assert response.status_code in (401, 403)


def test_list_planners_search_and_alphabetical_sort(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-search@acme.com", "SearchCo")
    _enable_totp(db_session, owner["user"]["id"])
    _founder_stops_planning(client, owner)
    headers = _csrf_headers(client)
    client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "external.com"},
        headers=headers,
    )

    for email, name in [
        ("zoe@acme.com", "Zoe Adler"),
        ("amy@acme.com", "Amy Baker"),
        ("bob@external.com", "Bob Carter"),
    ]:
        target = User(email=email, hashed_password="unused", full_name=name)
        db_session.add(target)
        db_session.commit()
        db_session.refresh(target)
        response = client.post(
            f"{org_base(client)}/planners", json={"email": email}, headers=headers
        )
        assert response.status_code == 201

    # Alphabetical sort, ascending -- Amy, Bob, Zoe.
    response = client.get(f"{org_base(client)}/planners?sort_by=name&sort_dir=asc")
    assert response.status_code == 200
    names = [item["full_name"] for item in response.json()["items"]]
    assert names == ["Amy Baker", "Bob Carter", "Zoe Adler"]

    # Search matches name OR email; total reflects the filtered set.
    response = client.get(f"{org_base(client)}/planners?q=external")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["full_name"] == "Bob Carter"

    response = client.get(f"{org_base(client)}/planners?q=amy@acme")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["full_name"] == "Amy Baker"


def test_list_planners_alphabetical_sort_desc(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-search-desc@acme.com", "SearchDescCo")
    _enable_totp(db_session, owner["user"]["id"])
    _founder_stops_planning(client, owner)
    headers = _csrf_headers(client)
    client.post(
        f"{org_base(client)}/allowed-domains",
        json={"domain": "external.com"},
        headers=headers,
    )

    for email, name in [
        ("zoe-desc@acme.com", "Zoe Adler"),
        ("amy-desc@acme.com", "Amy Baker"),
        ("bob-desc@external.com", "Bob Carter"),
    ]:
        target = User(email=email, hashed_password="unused", full_name=name)
        db_session.add(target)
        db_session.commit()
        db_session.refresh(target)
        response = client.post(
            f"{org_base(client)}/planners", json={"email": email}, headers=headers
        )
        assert response.status_code == 201

    # Alphabetical sort, descending -- Z to A, the exact reverse of the asc test.
    response = client.get(f"{org_base(client)}/planners?sort_by=name&sort_dir=desc")
    assert response.status_code == 200
    names = [item["full_name"] for item in response.json()["items"]]
    assert names == ["Zoe Adler", "Bob Carter", "Amy Baker"]
