import io
import uuid

from fastapi.testclient import TestClient
from PIL import Image
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


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), color=(10, 20, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_get_current_organization_returns_profile(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.get(f"{org_base(client)}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == owner["organization"]["id"]
    assert body["name"] == "Acme"
    assert body["domain"] == "acme.com"
    assert body["alias"] is None
    assert body["description"] is None
    assert body["logo_url"] is None


def test_update_organization_description(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2@acme.com", "Acme2")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.patch(
        f"{org_base(client)}",
        json={"description": "We run cyber crisis drills."},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.json()["description"] == "We run cyber crisis drills."

    get_response = client.get(f"{org_base(client)}")
    assert get_response.json()["description"] == "We run cyber crisis drills."


def test_update_organization_tax_id(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2b@acme.com", "Acme2b")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.patch(
        f"{org_base(client)}",
        json={"description": None, "tax_id": "B12345678"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.json()["tax_id"] == "B12345678"

    get_response = client.get(f"{org_base(client)}")
    assert get_response.json()["tax_id"] == "B12345678"


def test_update_organization_alias(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2c@acme.com", "Acme2c")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.patch(
        f"{org_base(client)}",
        json={"description": None, "alias": "The Acme Team"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.json()["alias"] == "The Acme Team"

    get_response = client.get(f"{org_base(client)}")
    assert get_response.json()["alias"] == "The Acme Team"


def test_upload_and_clear_organization_logo(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    _enable_totp(db_session, owner["user"]["id"])

    upload_response = client.post(
        f"{org_base(client)}/logo",
        files={"file": ("logo.png", _png_bytes(), "image/png")},
        headers=_csrf_headers(client),
    )
    assert upload_response.status_code == 200
    logo_url = upload_response.json()["logo_url"]
    assert logo_url is not None
    assert logo_url.startswith("/media/org-logos/")

    clear_response = client.delete(f"{org_base(client)}/logo", headers=_csrf_headers(client))
    assert clear_response.status_code == 200
    assert clear_response.json()["logo_url"] is None


def test_upload_organization_logo_rejects_bad_file_type(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner4@acme.com", "Acme4")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.post(
        f"{org_base(client)}/logo",
        files={"file": ("logo.txt", b"not an image", "text/plain")},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_LOGO_FILE_TYPE"


def test_organization_current_without_totp_is_denied(client: TestClient) -> None:
    _signup(client, "owner5@acme.com", "Acme5")

    response = client.get(f"{org_base(client)}")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "MFA_REQUIRED"


def test_organization_current_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.get(f"/api/v1/organizations/{uuid.uuid4()}")

    assert response.status_code == 401


def test_update_organization_name(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2d@acme.com", "Acme2d")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.patch(
        f"{org_base(client)}",
        json={"name": "  Acme Renamed  ", "description": None},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Acme Renamed"

    # Omitting name leaves it unchanged.
    response = client.patch(
        f"{org_base(client)}",
        json={"description": "x"},
        headers=_csrf_headers(client),
    )
    assert response.json()["name"] == "Acme Renamed"


def test_update_organization_rejects_blank_name(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2e@acme.com", "Acme2e")
    _enable_totp(db_session, owner["user"]["id"])

    response = client.patch(
        f"{org_base(client)}",
        json={"name": "   "},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422
