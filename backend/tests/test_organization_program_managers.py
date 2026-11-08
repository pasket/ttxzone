import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import MembershipTagAssignment, OrganizationMembership, OrgRoleEnum, User


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


def _user(db_session: Session, email: str, full_name: str = "Grace") -> User:
    user = User(email=email, hashed_password="unused", full_name=full_name)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _owner(client: TestClient, db_session: Session, suffix: str) -> tuple[dict, str]:
    owner = _signup(client, f"sa-owner{suffix}@acme.com", f"SaCo{suffix}")
    _enable_totp(db_session, owner["user"]["id"])
    return owner, owner["organization"]["id"]


def test_list_includes_the_founding_program_manager(
    client: TestClient, db_session: Session
) -> None:
    owner, org_id = _owner(client, db_session, "1")

    response = client.get(f"/api/v1/organizations/{org_id}/program-managers")

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["email"] for item in items] == ["sa-owner1@acme.com"]
    assert items[0]["user_id"] == owner["user"]["id"]
    assert items[0]["tags"] == []
    # Signup logs the founder straight in, so a login is already recorded.
    assert items[0]["last_login_at"] is not None


def test_grant_program_manager_to_an_allowlisted_user(
    client: TestClient, db_session: Session
) -> None:
    _, org_id = _owner(client, db_session, "2")
    grantee = _user(db_session, "second-sa2@acme.com")

    response = client.post(
        f"/api/v1/organizations/{org_id}/program-managers",
        json={"email": "Second-SA2@acme.com"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 201
    assert response.json()["user_id"] == str(grantee.id)
    listed = client.get(f"/api/v1/organizations/{org_id}/program-managers").json()["items"]
    assert len(listed) == 2


def test_grant_program_manager_rejections(client: TestClient, db_session: Session) -> None:
    owner, org_id = _owner(client, db_session, "3")
    _user(db_session, "outsider3@notallowed.com")
    headers = _csrf_headers(client)
    url = f"/api/v1/organizations/{org_id}/program-managers"

    unknown = client.post(url, json={"email": "nobody3@acme.com"}, headers=headers)
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "USER_NOT_FOUND"

    duplicate = client.post(url, json={"email": "sa-owner3@acme.com"}, headers=headers)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ALREADY_PROGRAM_MANAGER"

    # Same default-deny allowlist as Planner grants.
    outsider = client.post(url, json={"email": "outsider3@notallowed.com"}, headers=headers)
    assert outsider.status_code == 403
    assert outsider.json()["error"]["code"] == "DOMAIN_NOT_ALLOWED"

    no_csrf = client.post(url, json={"email": "sa-owner3@acme.com"})
    assert no_csrf.status_code == 403


def test_cannot_revoke_the_last_program_manager(client: TestClient, db_session: Session) -> None:
    owner, org_id = _owner(client, db_session, "4")

    response = client.delete(
        f"/api/v1/organizations/{org_id}/program-managers/{owner['user']['id']}",
        headers=_csrf_headers(client),
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "LAST_PROGRAM_MANAGER"
    assert len(client.get(f"/api/v1/organizations/{org_id}/program-managers").json()["items"]) == 1


def test_revoke_another_program_manager_clears_its_tags(
    client: TestClient, db_session: Session
) -> None:
    _, org_id = _owner(client, db_session, "5")
    headers = _csrf_headers(client)
    grantee = _user(db_session, "second-sa5@acme.com")
    client.post(
        f"/api/v1/organizations/{org_id}/program-managers",
        json={"email": "second-sa5@acme.com"},
        headers=headers,
    )
    tag_id = client.post(
        f"/api/v1/organizations/{org_id}/tags",
        json={"name": "Board", "color": "moss"},
        headers=headers,
    ).json()["id"]

    tagged = client.put(
        f"/api/v1/organizations/{org_id}/program-managers/{grantee.id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )
    assert tagged.status_code == 200
    assert [t["name"] for t in tagged.json()["tags"]] == ["Board"]
    listed = client.get(f"/api/v1/organizations/{org_id}/program-managers").json()["items"]
    assert [t["name"] for t in listed[1]["tags"]] == ["Board"]

    response = client.delete(
        f"/api/v1/organizations/{org_id}/program-managers/{grantee.id}", headers=headers
    )

    assert response.status_code == 204
    assert (
        db_session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.user_id == grantee.id,
                OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
            )
        ).first()
        is None
    )
    assert (
        db_session.exec(
            select(MembershipTagAssignment).where(
                MembershipTagAssignment.organization_tag_id == uuid.UUID(tag_id)
            )
        ).first()
        is None
    )


def test_program_manager_can_revoke_themselves_while_another_remains(
    client: TestClient, db_session: Session
) -> None:
    owner, org_id = _owner(client, db_session, "6")
    headers = _csrf_headers(client)
    _user(db_session, "second-sa6@acme.com")
    client.post(
        f"/api/v1/organizations/{org_id}/program-managers",
        json={"email": "second-sa6@acme.com"},
        headers=headers,
    )

    response = client.delete(
        f"/api/v1/organizations/{org_id}/program-managers/{owner['user']['id']}", headers=headers
    )

    assert response.status_code == 204
    # No longer a Program Manager of that org -> locked out of its admin routes.
    assert client.get(f"/api/v1/organizations/{org_id}/program-managers").status_code == 403


def test_revoke_unknown_program_manager_returns_404(
    client: TestClient, db_session: Session
) -> None:
    _, org_id = _owner(client, db_session, "7")

    response = client.delete(
        f"/api/v1/organizations/{org_id}/program-managers/{uuid.uuid4()}",
        headers=_csrf_headers(client),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROGRAM_MANAGER_NOT_FOUND"


def test_program_manager_of_another_org_is_denied(client: TestClient, db_session: Session) -> None:
    target = _signup(client, "sa-target@acme.com", "SaTarget")

    client.cookies.clear()
    intruder = _signup(client, "sa-intruder@other.com", "SaIntruder")
    _enable_totp(db_session, intruder["user"]["id"])
    org_id = target["organization"]["id"]

    assert client.get(f"/api/v1/organizations/{org_id}/program-managers").status_code == 403
    grant = client.post(
        f"/api/v1/organizations/{org_id}/program-managers",
        json={"email": "sa-intruder@other.com"},
        headers=_csrf_headers(client),
    )
    assert grant.status_code == 403
