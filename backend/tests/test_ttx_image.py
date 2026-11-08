import io
import uuid

import pyotp
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session

from app.core.config import settings
from app.models import User
from app.services import totp_service


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _enable_totp_with_secret(db_session: Session, user_id: str, secret: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    totp_service.store_secret(user, secret)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), color=(10, 20, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def _planner_client_with_ttx(client: TestClient, db_session: Session, email: str, org: str) -> str:
    body = _signup(client, email, org)
    _enable_totp_with_secret(db_session, body["user"]["id"], pyotp.random_base32())
    created = client.post(
        "/api/v1/ttx",
        json={"name": "Ransomware Drill", "organization_id": body["organization"]["id"]},
        headers=_csrf_headers(client),
    )
    assert created.status_code == 201
    return created.json()["id"]


def test_upload_and_clear_ttx_image(client: TestClient, db_session: Session) -> None:
    ttx_id = _planner_client_with_ttx(client, db_session, "owner@acme.com", "Acme")

    upload_response = client.post(
        f"/api/v1/ttx/{ttx_id}/image",
        files={"file": ("image.png", _png_bytes(), "image/png")},
        headers=_csrf_headers(client),
    )
    assert upload_response.status_code == 201
    image_url = upload_response.json()["image_url"]
    assert image_url is not None
    assert image_url.startswith("/media/ttx-images/")

    clear_response = client.delete(f"/api/v1/ttx/{ttx_id}/image", headers=_csrf_headers(client))
    assert clear_response.status_code == 200
    assert clear_response.json()["image_url"] is None


def test_upload_ttx_image_rejects_bad_file_type(client: TestClient, db_session: Session) -> None:
    ttx_id = _planner_client_with_ttx(client, db_session, "owner2@acme.com", "Acme2")

    response = client.post(
        f"/api/v1/ttx/{ttx_id}/image",
        files={"file": ("image.txt", b"not an image", "text/plain")},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_TTX_IMAGE_FILE_TYPE"


def test_upload_ttx_image_without_access_is_denied(client: TestClient, db_session: Session) -> None:
    ttx_id = _planner_client_with_ttx(client, db_session, "owner3@acme.com", "Acme3")

    # A different, unrelated Planner with no TTXAccess/membership tie to
    # this specific TTX.
    other = _signup(client, "owner4@acme.com", "Acme4")
    _enable_totp_with_secret(db_session, other["user"]["id"], pyotp.random_base32())

    response = client.post(
        f"/api/v1/ttx/{ttx_id}/image",
        files={"file": ("image.png", _png_bytes(), "image/png")},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403
