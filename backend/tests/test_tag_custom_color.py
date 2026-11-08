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


def test_organization_tag_new_curated_colors_are_accepted(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-color1@acme.com", "ColorCo1")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    for color in ("teal", "lime", "graphite"):
        response = client.post(
            f"{org_base(client)}/tags",
            json={"name": color, "color": color},
            headers=headers,
        )
        assert response.status_code == 201, response.json()
        assert response.json()["color"] == color
        assert response.json()["custom_hex"] is None


def test_organization_tag_custom_color_requires_a_valid_hex(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-color2@acme.com", "ColorCo2")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    missing = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Brand", "color": "custom"},
        headers=headers,
    )
    assert missing.status_code == 422

    malformed = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Brand", "color": "custom", "custom_hex": "not-a-color"},
        headers=headers,
    )
    assert malformed.status_code == 422

    ok = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Brand", "color": "custom", "custom_hex": "#1A2B3C"},
        headers=headers,
    )
    assert ok.status_code == 201
    # Normalized to lowercase.
    assert ok.json()["custom_hex"] == "#1a2b3c"
    assert ok.json()["color"] == "custom"


def test_organization_tag_named_color_rejects_a_custom_hex(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-color3@acme.com", "ColorCo3")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    response = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Pilot", "color": "violet", "custom_hex": "#1A2B3C"},
        headers=headers,
    )
    assert response.status_code == 422


def test_updating_a_custom_tag_back_to_a_named_color_clears_custom_hex(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner-color4@acme.com", "ColorCo4")
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)

    created = client.post(
        f"{org_base(client)}/tags",
        json={"name": "Brand", "color": "custom", "custom_hex": "#1a2b3c"},
        headers=headers,
    ).json()
    tag_id = created["id"]

    updated = client.patch(
        f"{org_base(client)}/tags/{tag_id}",
        json={"name": "Brand", "color": "moss"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["color"] == "moss"
    assert updated.json()["custom_hex"] is None


def test_ttx_tag_custom_color_round_trips(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-color5@acme.com", "ColorCo5")
    organization_id = owner["organization"]["id"]
    _enable_totp(db_session, owner["user"]["id"])
    headers = _csrf_headers(client)
    ttx_id = client.post(
        "/api/v1/ttx",
        json={"name": "Drill", "description": None, "organization_id": organization_id},
        headers=headers,
    ).json()["id"]

    created = client.post(
        f"/api/v1/ttx/{ttx_id}/tags",
        json={"name": "Brand", "color": "custom", "custom_hex": "#ABCDEF"},
        headers=headers,
    )
    assert created.status_code == 201
    assert created.json()["custom_hex"] == "#abcdef"

    invalid = client.post(
        f"/api/v1/ttx/{ttx_id}/tags",
        json={"name": "Bad", "color": "custom", "custom_hex": "#zzzzzz"},
        headers=headers,
    )
    assert invalid.status_code == 422
