"""Injects aimed at rooms: an exercise played in several rooms says, per
inject, which ones it's played in (none: all of them)."""

import io
import uuid

from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlmodel import Session

from app.models import TTX, TTXRoom
from app.services.ttx_msel_service import latest_snapshot
from tests.msel_helpers import example_payload
from tests.test_ttx_msel import _codes, _move, _open, _put, _url
from tests.test_ttx_msel import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_needs_form import _csrf


def _rooms(db_session: Session, ttx_id: str, *names: str) -> list[TTXRoom]:
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    ttx.uses_rooms = True
    db_session.add(ttx)
    rooms = [
        TTXRoom(ttx_id=ttx.id, code=f"RM-{n:02d}", name=name, position=n)
        for n, name in enumerate(names, start=1)
    ]
    db_session.add_all(rooms)
    db_session.commit()
    return rooms


def test_injects_are_aimed_at_rooms_and_the_msel_lists_them(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    blue, red = _rooms(db_session, ttx_id, "Blue", "Red")
    payload = example_payload(_open(client, ttx_id))
    payload["injects"][0]["room_ids"] = [str(blue.id), str(blue.id)]
    payload["injects"][1]["room_ids"] = [str(red.id)]
    saved = _put(client, ttx_id, payload)
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["uses_rooms"] is True
    assert [(r["code"], r["name"]) for r in body["rooms"]] == [("RM-01", "Blue"), ("RM-02", "Red")]
    assert body["injects"][0]["room_ids"] == [str(blue.id)]
    assert body["injects"][1]["room_ids"] == [str(red.id)]
    assert body["injects"][2]["room_ids"] == []

    payload["revision"] = body["revision"]
    payload["injects"][0]["room_ids"] = [str(uuid.uuid4())]
    refused = _put(client, ttx_id, payload)
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "UNKNOWN_ROOM"


def test_an_exercise_in_rooms_needs_rooms_and_each_gets_an_inject(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    ttx.uses_rooms = True
    db_session.add(ttx)
    db_session.commit()
    payload = example_payload(_open(client, ttx_id))
    body = _put(client, ttx_id, payload).json()
    assert "ROOMS_MISSING" in _codes(body["validation"]["ready"])

    blue, red = _rooms(db_session, ttx_id, "Blue", "Red")
    # One inject for all rooms reaches every room.
    body = client.post(_url(ttx_id, "/validate"), json=payload, headers=_csrf(client)).json()
    assert not {"ROOMS_MISSING", "ROOM_WITHOUT_INJECTS"} & _codes(body["ready"] + body["warnings"])
    for inject in payload["injects"]:
        inject["room_ids"] = [str(blue.id)]
    body = client.post(_url(ttx_id, "/validate"), json=payload, headers=_csrf(client)).json()
    flagged = [i for i in body["warnings"] if i["code"] == "ROOM_WITHOUT_INJECTS"]
    assert [i["item_id"] for i in flagged] == [str(red.id)]


def test_rooms_without_the_switch_are_ignored(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    (blue,) = _rooms(db_session, ttx_id, "Blue")
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    ttx.uses_rooms = False
    db_session.add(ttx)
    db_session.commit()
    payload = example_payload(_open(client, ttx_id))
    for inject in payload["injects"]:
        inject["room_ids"] = [str(blue.id)]
    body = _put(client, ttx_id, payload).json()
    assert body["uses_rooms"] is False
    assert not {"ROOMS_MISSING", "ROOM_WITHOUT_INJECTS"} & _codes(
        body["validation"]["ready"] + body["validation"]["warnings"]
    )


def test_a_room_with_injects_aimed_at_it_cant_be_removed(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    (blue,) = _rooms(db_session, ttx_id, "Blue")
    payload = example_payload(_open(client, ttx_id))
    payload["injects"][0]["room_ids"] = [str(blue.id)]
    code = _put(client, ttx_id, payload).json()["injects"][0]["code"]

    refused = client.delete(f"/api/v1/ttx/{ttx_id}/rooms/{blue.id}", headers=_csrf(client))
    assert refused.status_code == 409
    body = refused.json()["error"]
    assert body["code"] == "ROOM_IN_USE" and code in body["message"]


def test_the_ready_snapshot_and_the_pdf_carry_the_rooms(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    (blue,) = _rooms(db_session, ttx_id, "Blue team")
    payload = example_payload(_open(client, ttx_id))
    payload["injects"][0]["room_ids"] = [str(blue.id)]
    assert _put(client, ttx_id, payload).status_code == 200
    assert _move(client, ttx_id, "in_review").status_code == 200
    assert _move(client, ttx_id, "ready").status_code == 200
    snapshot = latest_snapshot(db_session, uuid.UUID(ttx_id))
    assert snapshot.payload["uses_rooms"] is True
    assert snapshot.payload["injects"][0]["room_ids"] == [str(blue.id)]

    pdf = client.get(_url(ttx_id, "/export/msel.pdf"))
    assert pdf.status_code == 200, pdf.text
    text = " ".join(page.extract_text() for page in PdfReader(io.BytesIO(pdf.content)).pages)
    text = " ".join(text.split())
    assert "Blue team" in text, text[:3000]
    assert "All rooms" in text
