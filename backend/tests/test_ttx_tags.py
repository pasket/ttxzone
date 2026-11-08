"""The tag library, three levels: TTX-Zone's catalog, the organization's
tags and each exercise's."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.data.attack_catalog import LATEST_ATTACK_VERSION
from app.data.tag_catalog import TAG_CATALOG
from app.main import app
from app.models import TagColor, User
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


def _register_bare(client: TestClient, email: str) -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Correcthorse123!", "full_name": "Eve"},
    )
    assert response.status_code == 201
    return response.json()["user"]["id"]


def _grant_planner(
    client: TestClient, db_session: Session, admin_email: str, org_name: str, planner_email: str
) -> tuple[str, str, TestClient]:
    """Grants Planner org-membership to a brand-new account.

    Registers the planner account on its OWN TestClient (a separate
    cookie jar) rather than the shared `client` fixture: `client` must stay
    logged in as the owner to perform the grant call below, and neither
    session can be recreated afterward via a plain /login once TOTP is
    forced on via a direct DB flip (there's no real secret to complete a
    fresh login with) -- the same constraint test_ttx_access_requests.py's
    `_redeem_as_new_account` documents and works around. Returns the
    planner's own already-authenticated TestClient for the caller to act
    with, instead of trying to log back into a TOTP-mandatory account.
    """
    owner = _signup(client, admin_email, org_name)
    _enable_totp(db_session, owner["user"]["id"])
    organization_id = owner["organization"]["id"]

    planner_client = TestClient(app)
    user_id = _register_bare(planner_client, planner_email)
    _enable_totp(db_session, user_id)

    grant_response = client.post(
        f"{org_base(client)}/planners",
        json={"email": planner_email},
        headers=_csrf_headers(client),
    )
    assert grant_response.status_code == 201
    return organization_id, user_id, planner_client


def _create_ttx(client: TestClient, organization_id: str, name: str = "Drill") -> str:
    response = client.post(
        "/api/v1/ttx",
        json={"name": name, "description": None, "organization_id": organization_id},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_the_catalog_is_well_formed() -> None:
    ids = [tag.id for tag in TAG_CATALOG]
    assert len(ids) == len(set(ids))
    for tag in TAG_CATALOG:
        assert 0 < len(tag.name_en) <= 24 and 0 < len(tag.name_es) <= 24, tag.id
        assert tag.description_en and tag.description_es, tag.id
        assert tag.color != TagColor.CUSTOM


def test_any_signed_in_user_reads_the_catalog(client: TestClient) -> None:
    _register_bare(client, "reader@acme.com")
    response = client.get("/api/v1/tag-catalog")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == len(TAG_CATALOG)
    ransomware = next(item for item in items if item["id"] == "ransomware")
    assert ransomware["group"] == "threat" and ransomware["color"] == "rose"


def test_planner_creates_lists_updates_and_deletes_exercise_tags(
    client: TestClient, db_session: Session
) -> None:
    organization_id, _, eval_client = _grant_planner(
        client, db_session, "owner1@acme.com", "Acme1", "eval1@acme.com"
    )
    headers = _csrf_headers(eval_client)
    ttx_id = _create_ttx(eval_client, organization_id)

    create_response = eval_client.post(
        f"/api/v1/ttx/{ttx_id}/tags",
        json={"name": "Ransomware", "color": "rose"},
        headers=headers,
    )
    assert create_response.status_code == 201
    assert create_response.json()["origin"] is None
    tag_id = create_response.json()["id"]

    list_response = eval_client.get(f"/api/v1/ttx/{ttx_id}/tags")
    assert [item["name"] for item in list_response.json()["items"]] == ["Ransomware"]
    # Another exercise of the same organization has its own, empty, set.
    other_ttx_id = _create_ttx(eval_client, organization_id, "Other")
    assert eval_client.get(f"/api/v1/ttx/{other_ttx_id}/tags").json()["items"] == []

    update_response = eval_client.patch(
        f"/api/v1/ttx/{ttx_id}/tags/{tag_id}",
        json={"name": "Ransomware Q1", "color": "sand"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["color"] == "sand"

    delete_response = eval_client.delete(f"/api/v1/ttx/{ttx_id}/tags/{tag_id}", headers=headers)
    assert delete_response.status_code == 204


def test_a_copy_remembers_its_origin(client: TestClient, db_session: Session) -> None:
    organization_id, _, eval_client = _grant_planner(
        client, db_session, "owner2@acme.com", "Acme2", "eval2@acme.com"
    )
    headers = _csrf_headers(eval_client)
    ttx_id = _create_ttx(eval_client, organization_id)

    # The Program Manager duplicates it into the organization's library...
    to_org = client.post(
        f"/api/v1/organizations/{organization_id}/tags",
        json={
            "name": "NIS2_copy",
            "color": "slate",
            "origin": "system",
            "origin_id": "nis2",
            "origin_name": "NIS2",
        },
        headers=_csrf_headers(client),
    )
    assert to_org.status_code == 201
    assert (to_org.json()["origin"], to_org.json()["origin_id"]) == ("system", "nis2")

    # ...the Planner copies it into the exercise.
    to_exercise = eval_client.post(
        f"/api/v1/ttx/{ttx_id}/tags",
        json={
            "name": "NIS2_copy",
            "color": "slate",
            "origin": "organization",
            "origin_id": to_org.json()["id"],
            "origin_name": "NIS2_copy",
        },
        headers=headers,
    )
    assert to_exercise.status_code == 201
    assert to_exercise.json()["origin_name"] == "NIS2_copy"

    # Editing never changes where it came from.
    edited = eval_client.patch(
        f"/api/v1/ttx/{ttx_id}/tags/{to_exercise.json()['id']}",
        json={"name": "NIS2", "color": "slate", "origin": None},
        headers=headers,
    )
    assert edited.json()["origin"] == "organization"

    unknown = eval_client.post(
        f"/api/v1/ttx/{ttx_id}/tags",
        json={"name": "Ghost", "color": "slate", "origin": "system", "origin_id": "nope"},
        headers=headers,
    )
    assert unknown.status_code == 422
    assert unknown.json()["error"]["code"] == "UNKNOWN_SYSTEM_TAG"


def test_only_program_managers_change_the_organization_library(
    client: TestClient, db_session: Session
) -> None:
    organization_id, _, planner_client = _grant_planner(
        client, db_session, "owner3@acme.com", "Acme3", "eval3@acme.com"
    )
    created = client.post(
        f"/api/v1/organizations/{organization_id}/tags",
        json={"name": "Subsidiary", "color": "sand"},
        headers=_csrf_headers(client),
    )
    assert created.status_code == 201
    tag_url = f"/api/v1/organizations/{organization_id}/tags/{created.json()['id']}"
    # The Planner lists it (to copy it into an exercise)...
    listed = planner_client.get(f"/api/v1/organizations/{organization_id}/tags")
    assert [item["name"] for item in listed.json()["items"]] == ["Subsidiary"]
    # ...but never changes the organization's library.
    headers = _csrf_headers(planner_client)
    assert (
        planner_client.post(
            f"/api/v1/organizations/{organization_id}/tags",
            json={"name": "Other", "color": "sand"},
            headers=headers,
        ).status_code
        == 403
    )
    assert (
        planner_client.patch(
            tag_url, json={"name": "X", "color": "sand"}, headers=headers
        ).status_code
        == 403
    )
    assert planner_client.delete(tag_url, headers=headers).status_code == 403
    assert planner_client.post(f"{tag_url}/enable", headers=headers).status_code == 403
    applied = planner_client.put(
        f"/api/v1/organizations/{organization_id}/tags/apply",
        json={"tag_ids": [created.json()["id"]]},
        headers=headers,
    )
    assert applied.status_code == 403


def test_only_program_managers_change_the_other_organization_libraries(
    client: TestClient, db_session: Session
) -> None:
    organization_id, _, planner_client = _grant_planner(
        client, db_session, "owner7@acme.com", "Acme7", "eval7@acme.com"
    )
    headers = _csrf_headers(planner_client)
    base = f"/api/v1/organizations/{organization_id}"
    for kind, payload in (
        ("actors", {"name": "Regional CERT"}),
        ("injects", {"title": "Press call"}),
        ("threat-actors", {"name": "Unknown crew", "attack_version": LATEST_ATTACK_VERSION}),
    ):
        assert planner_client.get(f"{base}/{kind}").status_code == 200, kind
        assert planner_client.post(f"{base}/{kind}", json=payload, headers=headers).status_code == (
            403
        ), kind
        created = client.post(f"{base}/{kind}", json=payload, headers=_csrf_headers(client))
        assert created.status_code == 201, created.text
        item_url = f"{base}/{kind}/{created.json()['id']}"
        assert planner_client.patch(item_url, json=payload, headers=headers).status_code == 403
        assert planner_client.delete(item_url, headers=headers).status_code == 403
        assert planner_client.post(f"{item_url}/enable", headers=headers).status_code == 403


def test_exercise_tag_endpoints_reject_outsiders(client: TestClient, db_session: Session) -> None:
    organization_id, _, eval_client = _grant_planner(
        client, db_session, "owner4@acme.com", "Acme4", "eval4@acme.com"
    )
    ttx_id = _create_ttx(eval_client, organization_id)

    # The organization's Program Manager reaches it (the usual bypass)...
    assert client.get(f"/api/v1/ttx/{ttx_id}/tags").status_code == 200

    # ...a Planner of another organization doesn't.
    _, _, other_client = _grant_planner(
        client, db_session, "owner5@other.com", "Other5", "eval5@other.com"
    )
    assert other_client.get(f"/api/v1/ttx/{ttx_id}/tags").status_code == 403
    assert other_client.get(f"/api/v1/organizations/{organization_id}/tags").status_code == 403


def test_deleting_a_tag_assigned_to_a_ttx_and_a_token_clears_both_junctions(
    client: TestClient, db_session: Session
) -> None:
    """delete_ttx_tag clears the junction rows first: deleting a tag
    assigned to an Exercise or an Invitation token must not raise an
    unhandled FK violation (a 500)."""
    organization_id, _, eval_client = _grant_planner(
        client, db_session, "owner6@acme.com", "Acme6", "eval6@acme.com"
    )
    headers = _csrf_headers(eval_client)
    ttx_id = _create_ttx(eval_client, organization_id)

    tag_response = eval_client.post(
        f"/api/v1/ttx/{ttx_id}/tags",
        json={"name": "Ransomware", "color": "rose"},
        headers=headers,
    )
    assert tag_response.status_code == 201
    tag_id = tag_response.json()["id"]

    set_ttx_tags_response = eval_client.put(
        f"/api/v1/ttx/{ttx_id}/tags/apply", json={"tag_ids": [tag_id]}, headers=headers
    )
    assert set_ttx_tags_response.status_code == 200
    assert [t["name"] for t in set_ttx_tags_response.json()["tags"]] == ["Ransomware"]

    token_response = eval_client.post(
        f"/api/v1/ttx/{ttx_id}/invitation-tokens",
        json={
            "role": "player",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "max_uses": 1,
        },
        headers=headers,
    )
    assert token_response.status_code == 201
    token_id = token_response.json()["id"]

    set_token_tags_response = eval_client.put(
        f"/api/v1/invitation-tokens/{token_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )
    assert set_token_tags_response.status_code == 200

    delete_response = eval_client.delete(f"/api/v1/ttx/{ttx_id}/tags/{tag_id}", headers=headers)
    assert delete_response.status_code == 204

    list_response = eval_client.get("/api/v1/ttx")
    ttx_row = next(item for item in list_response.json()["items"] if item["id"] == ttx_id)
    assert ttx_row["tags"] == []

    tokens_response = eval_client.get(f"/api/v1/ttx/{ttx_id}/invitation-tokens")
    token_row = next(item for item in tokens_response.json()["items"] if item["id"] == token_id)
    assert token_row["tags"] == []


def test_deleting_an_organization_tag_applied_to_a_planner_disables_it_first(
    client: TestClient, db_session: Session
) -> None:
    _, planner_id, _ = _grant_planner(
        client, db_session, "owner7@acme.com", "Acme7", "eval7@acme.com"
    )
    headers = _csrf_headers(client)
    tag_id = client.post(
        f"{org_base(client)}/tags", json={"name": "Backup", "color": "sand"}, headers=headers
    ).json()["id"]
    tagged = client.put(
        f"{org_base(client)}/planners/{planner_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )
    assert tagged.status_code == 200

    # Still applied to the planner: disabled, not deleted.
    disabled = client.delete(f"{org_base(client)}/tags/{tag_id}", headers=headers)
    assert disabled.status_code == 200
    assert disabled.json()["result"] == "disabled"
    assert disabled.json()["usage"]["memberships"] == 1
    planners = client.get(f"{org_base(client)}/planners").json()["items"]
    assert [t["id"] for t in planners[0]["tags"]] == [tag_id]

    # Kept where it already is; once removed, deleting it is for good.
    kept = client.put(
        f"{org_base(client)}/planners/{planner_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )
    assert kept.status_code == 200
    client.put(
        f"{org_base(client)}/planners/{planner_id}/tags", json={"tag_ids": []}, headers=headers
    )
    refused = client.put(
        f"{org_base(client)}/planners/{planner_id}/tags",
        json={"tag_ids": [tag_id]},
        headers=headers,
    )
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "LIBRARY_ITEM_DISABLED"
    deleted = client.delete(f"{org_base(client)}/tags/{tag_id}", headers=headers)
    assert deleted.json()["result"] == "deleted"
