import io

from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import settings
from app.services.avatar_service import AVATAR_DIR

PRESET_KEY = "executive-1"
OTHER_PRESET_KEY = "legal-2"
NEW_STYLE_PRESET_KEY = "beard-1"


def _png_bytes(width: int = 4, height: int = 4) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), color=(200, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_set_avatar_preset_success(client: TestClient) -> None:
    _signup(client, "owner@acme.com", "Acme")

    response = client.post(
        "/api/v1/auth/avatar/preset",
        json={"preset_key": PRESET_KEY},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204

    me = client.get("/api/v1/auth/me").json()
    assert me["avatar_kind"] == "preset"
    assert me["avatar_value"] == PRESET_KEY


def test_set_avatar_preset_accepts_new_style_key(client: TestClient) -> None:
    _signup(client, "owner11@acme.com", "Acme11")

    response = client.post(
        "/api/v1/auth/avatar/preset",
        json={"preset_key": NEW_STYLE_PRESET_KEY},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204

    me = client.get("/api/v1/auth/me").json()
    assert me["avatar_value"] == NEW_STYLE_PRESET_KEY


def test_set_avatar_preset_rejects_unknown_key(client: TestClient) -> None:
    _signup(client, "owner2@acme.com", "Acme2")

    response = client.post(
        "/api/v1/auth/avatar/preset",
        json={"preset_key": "not-a-real-preset"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_AVATAR_PRESET"


def test_set_avatar_preset_requires_csrf(client: TestClient) -> None:
    _signup(client, "owner3@acme.com", "Acme3")

    response = client.post("/api/v1/auth/avatar/preset", json={"preset_key": PRESET_KEY})

    assert response.status_code == 403


def test_upload_avatar_success(client: TestClient) -> None:
    _signup(client, "owner4@acme.com", "Acme4")

    response = client.post(
        "/api/v1/auth/avatar/upload",
        files={"file": ("photo.png", _png_bytes(), "image/png")},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204

    me = client.get("/api/v1/auth/me").json()
    assert me["avatar_kind"] == "upload"
    assert me["avatar_value"].startswith(settings.AVATAR_URL_PREFIX)

    uploaded_filename = me["avatar_value"].rsplit("/", 1)[-1]
    stored_path = AVATAR_DIR / uploaded_filename
    assert stored_path.exists()
    # Always re-encoded server-side regardless of what was uploaded.
    assert uploaded_filename.endswith(".jpg")
    with Image.open(stored_path) as stored:
        assert stored.format == "JPEG"


def test_upload_avatar_rejects_wrong_content_type(client: TestClient) -> None:
    _signup(client, "owner5@acme.com", "Acme5")

    response = client.post(
        "/api/v1/auth/avatar/upload",
        files={"file": ("doc.pdf", b"not-an-image", "application/pdf")},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_AVATAR_FILE_TYPE"


def test_upload_avatar_rejects_content_that_is_not_actually_an_image(client: TestClient) -> None:
    """A correct Content-Type header alone must not be trusted -- the
    bytes are decoded for real via Pillow."""
    _signup(client, "owner9@acme.com", "Acme9")

    response = client.post(
        "/api/v1/auth/avatar/upload",
        files={"file": ("photo.png", b"not-actually-a-png-file", "image/png")},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_AVATAR_FILE_TYPE"


def test_upload_avatar_rejects_oversized_file(client: TestClient) -> None:
    _signup(client, "owner6@acme.com", "Acme6")
    oversized = b"0" * (settings.AVATAR_MAX_BYTES + 1)

    response = client.post(
        "/api/v1/auth/avatar/upload",
        files={"file": ("photo.png", oversized, "image/png")},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "AVATAR_FILE_TOO_LARGE"


def test_upload_avatar_is_downscaled_and_bounded_regardless_of_input_size(
    client: TestClient,
) -> None:
    _signup(client, "owner10@acme.com", "Acme10")
    large_buffer = io.BytesIO()
    Image.new("RGB", (2000, 1200), color=(10, 100, 200)).save(large_buffer, format="PNG")

    response = client.post(
        "/api/v1/auth/avatar/upload",
        files={"file": ("big.png", large_buffer.getvalue(), "image/png")},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204

    me = client.get("/api/v1/auth/me").json()
    uploaded_filename = me["avatar_value"].rsplit("/", 1)[-1]
    stored_path = AVATAR_DIR / uploaded_filename

    with Image.open(stored_path) as stored:
        # Center-cropped to square and capped at AVATAR_MAX_DIMENSION_PX.
        assert stored.size == (settings.AVATAR_MAX_DIMENSION_PX, settings.AVATAR_MAX_DIMENSION_PX)
    assert stored_path.stat().st_size < settings.AVATAR_MAX_BYTES


def test_switching_from_upload_to_preset_deletes_old_file(client: TestClient) -> None:
    _signup(client, "owner7@acme.com", "Acme7")

    client.post(
        "/api/v1/auth/avatar/upload",
        files={"file": ("photo.png", _png_bytes(), "image/png")},
        headers=_csrf_headers(client),
    )
    uploaded_filename = client.get("/api/v1/auth/me").json()["avatar_value"].rsplit("/", 1)[-1]
    assert (AVATAR_DIR / uploaded_filename).exists()

    response = client.post(
        "/api/v1/auth/avatar/preset",
        json={"preset_key": OTHER_PRESET_KEY},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204
    assert not (AVATAR_DIR / uploaded_filename).exists()


def test_clear_avatar(client: TestClient) -> None:
    _signup(client, "owner8@acme.com", "Acme8")
    client.post(
        "/api/v1/auth/avatar/preset",
        json={"preset_key": PRESET_KEY},
        headers=_csrf_headers(client),
    )

    response = client.delete("/api/v1/auth/avatar", headers=_csrf_headers(client))
    assert response.status_code == 204

    me = client.get("/api/v1/auth/me").json()
    assert me["avatar_kind"] is None
    assert me["avatar_value"] is None


def test_avatar_endpoints_require_authentication(client: TestClient) -> None:
    response = client.post("/api/v1/auth/avatar/preset", json={"preset_key": PRESET_KEY})
    assert response.status_code in (401, 403)
