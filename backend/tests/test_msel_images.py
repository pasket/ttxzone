"""Images attached to MSEL injects: uploaded and re-encoded, served only
through the MSEL's guarded endpoint, linked by the save, dropped when
nothing shows them any more, and printed on the inject cards."""

import io
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfReader
from sqlmodel import Session, select

from app.models import MselImage
from tests.msel_helpers import example_payload
from tests.test_msel_pdf import _export
from tests.test_ttx_msel import _move, _open, _put
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager, _to_approved


@pytest.fixture
def image_dir(tmp_path, monkeypatch):
    from app.services import msel_image_service

    monkeypatch.setattr(msel_image_service, "MSEL_IMAGE_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    return {"ttx": ttx, "msel": _open(client, ttx["id"])}


def _png(width: int = 40, height: int = 20, kind: str = "PNG") -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (200, 30, 30)).save(buffer, format=kind)
    return buffer.getvalue()


def _upload(client: TestClient, ttx_id: str, name: str, content: bytes):
    return client.post(
        f"/api/v1/ttx/{ttx_id}/msel/images",
        files={"file": (name, content, "application/octet-stream")},
        headers=_csrf(client),
    )


def test_an_image_is_re_encoded_and_served_inline_never_cached(
    client: TestClient, exercise: dict, image_dir
) -> None:
    ttx_id = exercise["ttx"]["id"]
    # Bytes appended after the image (a polyglot's payload) don't survive.
    raw = _png() + b"<script>alert(1)</script>"

    response = _upload(client, ttx_id, "ransom note.png", raw)

    assert response.status_code == 201, response.text
    image = response.json()
    assert (image["width"], image["height"]) == (40, 20)
    served = client.get(f"/api/v1/ttx/{ttx_id}/msel/images/{image['id']}")
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/png"
    assert served.headers["content-disposition"].startswith("inline")
    assert served.headers["cache-control"] == "private, no-store"
    assert served.headers["x-content-type-options"] == "nosniff"
    assert b"<script>" not in served.content
    assert len(list(image_dir.iterdir())) == 1


def test_only_real_images_are_accepted(client: TestClient, exercise: dict, image_dir) -> None:
    ttx_id = exercise["ttx"]["id"]

    disguised = _upload(client, ttx_id, "leak.png", b"<html>not an image</html>")
    unknown = _upload(client, ttx_id, "leak.gif", b"GIF89a....")
    # Right signature, but not a decodable picture.
    broken = _upload(client, ttx_id, "leak.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)

    for response in (disguised, unknown, broken):
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "MSEL_IMAGE_INVALID_TYPE"
    assert list(image_dir.iterdir()) == []


def test_injects_show_their_images_in_order_and_unknown_ones_are_refused(
    client: TestClient, exercise: dict, image_dir
) -> None:
    ttx_id = exercise["ttx"]["id"]
    first = _upload(client, ttx_id, "a.png", _png()).json()
    second = _upload(client, ttx_id, "b.jpg", _png(10, 30, "JPEG")).json()
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["images"] = [
        {"image_id": second["id"], "caption": "Telegram message"},
        {"image_id": first["id"]},
    ]

    saved = _put(client, ttx_id, payload)

    assert saved.status_code == 200, saved.text
    images = saved.json()["injects"][0]["images"]
    assert [(i["id"], i["caption"]) for i in images] == [
        (second["id"], "Telegram message"),
        (first["id"], ""),
    ]
    payload = example_payload(saved.json())
    payload["injects"][0]["images"] = [{"image_id": str(uuid.uuid4())}]
    refused = _put(client, ttx_id, payload)
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "UNKNOWN_IMAGE"


def test_unused_images_are_dropped_unless_a_ready_version_shows_them(
    client: TestClient, db_session: Session, exercise: dict, image_dir
) -> None:
    ttx_id = exercise["ttx"]["id"]
    kept = _upload(client, ttx_id, "kept.png", _png()).json()
    orphan = _upload(client, ttx_id, "orphan.png", _png()).json()
    fresh = _upload(client, ttx_id, "fresh.png", _png()).json()
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["images"] = [{"image_id": kept["id"]}]
    assert _put(client, ttx_id, payload).status_code == 200
    assert _move(client, ttx_id, "in_review").status_code == 200
    assert _move(client, ttx_id, "ready").status_code == 200
    # Past the grace for an upload waiting for its save.
    for row in db_session.exec(select(MselImage)):
        if str(row.id) != fresh["id"]:
            row.created_at = datetime.now(UTC) - timedelta(days=2)
            db_session.add(row)
    db_session.commit()

    # The live MSEL stops showing it; the READY snapshot still does.
    msel = client.get(f"/api/v1/ttx/{ttx_id}/msel").json()
    payload = example_payload(msel)
    assert _put(client, ttx_id, payload).status_code == 200

    db_session.expire_all()
    left = {str(row.id) for row in db_session.exec(select(MselImage))}
    assert left == {kept["id"], fresh["id"]}
    assert len(list(image_dir.iterdir())) == 2
    assert client.get(f"/api/v1/ttx/{ttx_id}/msel/images/{orphan['id']}").status_code == 404


def test_the_inject_cards_print_the_images_and_the_formatted_text(
    client: TestClient, exercise: dict, image_dir
) -> None:
    ttx_id = exercise["ttx"]["id"]
    image = _upload(client, ttx_id, "note.png", _png(300, 150)).json()
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["content"] = "**Pay 20M** within _48 hours_."
    payload["injects"][0]["images"] = [{"image_id": image["id"], "caption": "Ransom note"}]
    assert _put(client, ttx_id, payload).status_code == 200
    assert _move(client, ttx_id, "in_review").status_code == 200
    assert _move(client, ttx_id, "ready").status_code == 200

    pdf = _export(client, ttx_id, "inject-cards")

    assert pdf.status_code == 200, pdf.text
    reader = PdfReader(io.BytesIO(pdf.content))
    assert sum(len(page.images) for page in reader.pages) == 1
    text = " ".join(page.extract_text() for page in reader.pages)
    assert "Ransom note" in text
    assert "**" not in text and "Pay 20M" in text
