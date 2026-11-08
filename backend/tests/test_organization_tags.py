# tests/test_organization_tags.py
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import User
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


def test_create_list_update_and_delete_organization_tag(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner1@acme.com", "Acme1")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    create_response = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=headers,
    )
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]
    assert create_response.json()["color"] == "violet"
    # A freshly created tag starts unapplied -- applying it to the
    # Organization is a separate, explicit step (see
    # test_apply_and_unapply_organization_tags below), not a side effect
    # of creation.
    assert create_response.json()["applied"] is False

    list_response = client.get(f"{org_base(client)}/tags")
    assert [item["name"] for item in list_response.json()["items"]] == ["Pilot"]

    update_response = client.patch(
        f"{org_base(client)}/tags/{tag_id}",
        json={"name": "Pilot renamed", "color": "moss"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Pilot renamed"
    assert update_response.json()["color"] == "moss"

    delete_response = client.delete(f"{org_base(client)}/tags/{tag_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["result"] == "deleted"
    assert client.get(f"{org_base(client)}/tags").json()["items"] == []


def test_organization_tag_name_over_24_chars_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner2@acme.com", "Acme2")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.post(
        f"{org_base(client)}/tags",
        json={"name": "x" * 25, "color": "violet"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 422


def test_organization_tag_invalid_color_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Pilot", "color": "not-a-real-color"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 422


def test_organization_tag_endpoints_require_program_manager(client: TestClient) -> None:
    assert client.get(f"/api/v1/organizations/{uuid.uuid4()}/tags").status_code == 401


def test_cannot_update_or_delete_another_organizations_tag(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner4@acme.com", "Acme4")
    _enable_totp(db_session, owner["user"]["id"])
    create_response = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Pilot", "color": "violet"},
        headers=_csrf_headers(client),
    )
    tag_id = create_response.json()["id"]

    client.cookies.clear()
    other_owner = _signup(client, "owner5@other.com", "Other5")
    _enable_totp(db_session, other_owner["user"]["id"])

    response = client.delete(f"{org_base(client)}/tags/{tag_id}", headers=_csrf_headers(client))
    assert response.status_code == 404


def test_list_organization_tags_pagination_search_and_sort(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-tags@acme.com", "TagCo")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    for name, color in [("Zeta", "slate"), ("Alpha", "rose"), ("Beta", "moss")]:
        response = client.post(
            f"{org_base(client)}/tags",
            json={"name": name, "color": color},
            headers=headers,
        )
        assert response.status_code == 201

    page = client.get(f"{org_base(client)}/tags", params={"limit": 2, "offset": 0})
    body = page.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["items"][0]["name"] == "Beta"  # newest first by default

    asc = client.get(f"{org_base(client)}/tags?sort_by=name&sort_dir=asc")
    assert [item["name"] for item in asc.json()["items"]] == ["Alpha", "Beta", "Zeta"]

    searched = client.get(f"{org_base(client)}/tags?q=eta")
    assert {item["name"] for item in searched.json()["items"]} == {"Zeta", "Beta"}


def test_apply_and_unapply_organization_tags(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-apply@acme.com", "ApplyCo")
    _enable_totp(db_session, owner["user"]["id"])
    organization_id = owner["organization"]["id"]
    headers = _csrf_headers(client)

    tag_a = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Kept", "color": "indigo"},
        headers=headers,
    ).json()["id"]
    tag_b = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Dropped", "color": "rose"},
        headers=headers,
    ).json()["id"]

    # Applying [a, b] -- both should flip to applied=True.
    apply_response = client.put(
        f"/api/v1/organizations/{organization_id}/tags/apply",
        json={"tag_ids": [tag_a, tag_b]},
        headers=headers,
    )
    assert apply_response.status_code == 200
    applied_by_id = {item["id"]: item["applied"] for item in apply_response.json()["items"]}
    assert applied_by_id == {tag_a: True, tag_b: True}

    # Re-applying with only [a] -- full-replace means b flips back to
    # applied=False (not deleted -- it still exists in the pool).
    reapply_response = client.put(
        f"/api/v1/organizations/{organization_id}/tags/apply",
        json={"tag_ids": [tag_a]},
        headers=headers,
    )
    assert reapply_response.status_code == 200
    applied_by_id = {item["id"]: item["applied"] for item in reapply_response.json()["items"]}
    assert applied_by_id == {tag_a: True, tag_b: False}

    list_response = client.get(f"{org_base(client)}/tags")
    applied_by_id = {item["id"]: item["applied"] for item in list_response.json()["items"]}
    assert applied_by_id == {tag_a: True, tag_b: False}


def test_apply_organization_tags_rejects_a_tag_id_from_another_organization(
    client: TestClient, db_session: Session
) -> None:
    # The foreign org/tag is created first, and `owner` signs up second, so
    # `owner`'s session is the one left active on `client` -- no need to
    # switch sessions back and forth (this file's `_enable_totp` sets no
    # real secret, so a full re-login/TOTP-verify round trip isn't an
    # option here, unlike test_organization_multi_admin.py's helpers).
    other_owner = _signup(client, "owner-apply3@other.com", "OtherApply3")
    _enable_totp(db_session, other_owner["user"]["id"])
    foreign_tag_id = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Foreign", "color": "slate"},
        headers=_csrf_headers(client),
    ).json()["id"]

    client.cookies.clear()
    owner = _signup(client, "owner-apply2@acme.com", "ApplyCo2")
    _enable_totp(db_session, owner["user"]["id"])
    organization_id = owner["organization"]["id"]

    response = client.put(
        f"/api/v1/organizations/{organization_id}/tags/apply",
        json={"tag_ids": [foreign_tag_id]},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 404


def test_apply_organization_tags_rejects_a_non_program_manager(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-apply4@acme.com", "ApplyCo4")
    _signup(client, "owner-apply5@other.com", "OtherApply5")
    organization_id = owner["organization"]["id"]

    client.cookies.clear()
    client.post(
        "/api/v1/auth/login",
        json={"email": "owner-apply5@other.com", "password": "Correcthorse123!"},
    )
    response = client.put(
        f"/api/v1/organizations/{organization_id}/tags/apply",
        json={"tag_ids": []},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 403


def test_apply_organization_tags_requires_csrf(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-apply6@acme.com", "ApplyCo6")
    _enable_totp(db_session, owner["user"]["id"])
    organization_id = owner["organization"]["id"]

    response = client.put(
        f"/api/v1/organizations/{organization_id}/tags/apply", json={"tag_ids": []}
    )
    assert response.status_code == 403
