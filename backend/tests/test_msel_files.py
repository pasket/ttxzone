"""Files handed out with MSEL injects (logs, packet captures, dumps...):
any type, stored byte for byte, only ever served as an opaque download,
linked by the save, dropped when nothing hands them out any more, gated
in the session like images, listed on the inject cards and carried by
scenario files."""

import hashlib
import io
import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from app.models import MselFile, MselSnapshot, TTXMsel
from app.services.scenario_document import parse
from tests.msel_helpers import example_payload
from tests.test_exercise_run import _as_player, _post, _ready_plan, _url
from tests.test_msel_pdf import _export as _export_pdf
from tests.test_scenario_library import _export as _export_scenario
from tests.test_scenario_library import _import as _import_scenario
from tests.test_ttx_conduct_prep import exercise as ready_exercise  # noqa: F401 (fixture)
from tests.test_ttx_msel import _move, _open, _put
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager, _to_approved

PCAP = b"\xd4\xc3\xb2\xa1\x02\x00\x04\x00" + bytes(range(256)) * 4


@pytest.fixture
def file_dir(tmp_path, monkeypatch):
    from app.services import msel_file_service

    monkeypatch.setattr(msel_file_service, "MSEL_FILE_DIR", tmp_path / "files")
    return tmp_path / "files"


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    return {"ttx": ttx, "org_id": owner["organization"]["id"], "msel": _open(client, ttx["id"])}


def _upload(client: TestClient, ttx_id: str, name: str, content: bytes):
    return client.post(
        f"/api/v1/ttx/{ttx_id}/msel/files",
        files={"file": (name, content, "text/html")},
        headers=_csrf(client),
    )


def test_any_file_is_stored_as_uploaded_and_served_only_as_a_download(
    client: TestClient, exercise: dict, file_dir
) -> None:
    ttx_id = exercise["ttx"]["id"]
    html = b"<html><script>alert(1)</script></html>"

    capture = _upload(client, ttx_id, "edge-fw.pcap", PCAP)
    page = _upload(client, ttx_id, "../../phish.html", html)

    assert capture.status_code == 201, capture.text
    body = capture.json()
    assert body["name"] == "edge-fw.pcap"
    assert body["size_bytes"] == len(PCAP)
    assert body["sha256"] == hashlib.sha256(PCAP).hexdigest()
    # No directories survive in the name it's offered under.
    assert page.json()["name"] == "phish.html"
    served = client.get(f"/api/v1/ttx/{ttx_id}/msel/files/{page.json()['id']}")
    assert served.status_code == 200
    assert served.content == html
    assert served.headers["content-type"] == "application/octet-stream"
    assert served.headers["content-disposition"] == "attachment; filename*=UTF-8''phish.html"
    assert served.headers["cache-control"] == "private, no-store"
    assert served.headers["x-content-type-options"] == "nosniff"
    assert "default-src 'none'" in served.headers["content-security-policy"]
    # Stored under random names, never the uploaded one.
    assert len(list(file_dir.iterdir())) == 2
    assert all("." not in path.name for path in file_dir.iterdir())


def test_text_files_preview_as_plain_text_and_binaries_dont(
    client: TestClient, exercise: dict, file_dir, monkeypatch
) -> None:
    from app.services import msel_file_service

    ttx_id = exercise["ttx"]["id"]
    log = "2026-01-01T00:00:00Z sshd: Failed password\r\nwhoami\x1b[0m <b>é</b>\n".encode()
    utf16 = "\ufeffEventID,Message\r\n4625,Logon failure\r\n".encode("utf-16-le")
    url = lambda body: f"/api/v1/ttx/{ttx_id}/msel/files/{body['id']}/preview"  # noqa: E731

    preview = client.get(url(_upload(client, ttx_id, "auth.log", log).json()))
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["name"] == "auth.log"
    assert body["encoding"] == "utf-8"
    assert body["truncated"] is False
    # CRLF folded, escape characters replaced; markup left as plain text.
    assert body["text"] == "2026-01-01T00:00:00Z sshd: Failed password\nwhoami\ufffd[0m <b>é</b>\n"
    assert preview.headers["content-type"] == "application/json"

    windows = client.get(url(_upload(client, ttx_id, "events.csv", utf16).json())).json()
    assert windows["encoding"] == "utf-16"
    assert windows["text"].startswith("EventID,Message\n4625")

    binary = client.get(url(_upload(client, ttx_id, "edge-fw.pcap", PCAP).json()))
    assert binary.status_code == 409
    assert binary.json()["error"]["code"] == "MSEL_FILE_NOT_TEXT"

    # Past the limit only the beginning comes back, never a split character.
    monkeypatch.setattr(msel_file_service, "PREVIEW_MAX_BYTES", 5)
    long = client.get(url(_upload(client, ttx_id, "big.txt", "abcdé fin".encode()).json())).json()
    assert long["truncated"] is True
    assert long["text"] == "abcd"


def test_empty_and_oversized_files_are_refused(
    client: TestClient, exercise: dict, file_dir, monkeypatch
) -> None:
    from app.core.config import settings

    ttx_id = exercise["ttx"]["id"]
    monkeypatch.setattr(settings, "MSEL_FILE_MAX_BYTES", 1024)

    empty = _upload(client, ttx_id, "empty.log", b"")
    large = _upload(client, ttx_id, "dump.raw", b"x" * 1025)

    assert empty.status_code == 422
    assert empty.json()["error"]["code"] == "MSEL_FILE_EMPTY"
    assert large.status_code == 413
    assert large.json()["error"]["code"] == "MSEL_FILE_TOO_LARGE"
    assert list(file_dir.iterdir()) == []


def test_injects_hand_out_their_files_in_order_and_unknown_ones_are_refused(
    client: TestClient, exercise: dict, file_dir
) -> None:
    ttx_id = exercise["ttx"]["id"]
    first = _upload(client, ttx_id, "auth.log", b"Oct 31 05:00 sshd: Accepted\n").json()
    second = _upload(client, ttx_id, "edge-fw.pcap", PCAP).json()
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["files"] = [
        {"file_id": second["id"], "description": "Firewall capture"},
        {"file_id": first["id"]},
    ]

    saved = _put(client, ttx_id, payload)

    assert saved.status_code == 200, saved.text
    files = saved.json()["injects"][0]["files"]
    assert [(f["id"], f["name"], f["description"]) for f in files] == [
        (second["id"], "edge-fw.pcap", "Firewall capture"),
        (first["id"], "auth.log", ""),
    ]
    payload = example_payload(saved.json())
    payload["injects"][0]["files"] = [{"file_id": str(uuid.uuid4())}]
    refused = _put(client, ttx_id, payload)
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "UNKNOWN_FILE"


def test_unused_files_are_dropped_unless_a_ready_version_hands_them_out(
    client: TestClient, db_session: Session, exercise: dict, file_dir
) -> None:
    ttx_id = exercise["ttx"]["id"]
    kept = _upload(client, ttx_id, "kept.log", b"kept").json()
    orphan = _upload(client, ttx_id, "orphan.log", b"orphan").json()
    fresh = _upload(client, ttx_id, "fresh.log", b"fresh").json()
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["files"] = [{"file_id": kept["id"]}]
    assert _put(client, ttx_id, payload).status_code == 200
    assert _move(client, ttx_id, "in_review").status_code == 200
    assert _move(client, ttx_id, "ready").status_code == 200
    for row in db_session.exec(select(MselFile)):
        if str(row.id) != fresh["id"]:
            row.created_at = datetime.now(UTC) - timedelta(days=2)
            db_session.add(row)
    db_session.commit()

    msel = client.get(f"/api/v1/ttx/{ttx_id}/msel").json()
    assert _put(client, ttx_id, example_payload(msel)).status_code == 200

    db_session.expire_all()
    left = {str(row.id) for row in db_session.exec(select(MselFile))}
    assert left == {kept["id"], fresh["id"]}
    assert len(list(file_dir.iterdir())) == 2
    assert client.get(f"/api/v1/ttx/{ttx_id}/msel/files/{orphan['id']}").status_code == 404


def test_the_inject_cards_list_the_files(client: TestClient, exercise: dict, file_dir) -> None:
    ttx_id = exercise["ttx"]["id"]
    capture = _upload(client, ttx_id, "edge-fw.pcap", PCAP).json()
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["files"] = [{"file_id": capture["id"], "description": "From the SOC"}]
    assert _put(client, ttx_id, payload).status_code == 200
    assert _move(client, ttx_id, "in_review").status_code == 200
    assert _move(client, ttx_id, "ready").status_code == 200

    pdf = _export_pdf(client, ttx_id, "inject-cards")

    assert pdf.status_code == 200, pdf.text
    text = " ".join(page.extract_text() for page in PdfReader(io.BytesIO(pdf.content)).pages)
    assert "edge-fw.pcap" in text and "From the SOC" in text
    assert capture["sha256"][:16] in text


# -- the session ---------------------------------------------------------------------


def _stored_file(db_session: Session, file_dir, msel: TTXMsel, name: str) -> MselFile:
    file_dir.mkdir(parents=True, exist_ok=True)
    row = MselFile(
        msel_id=msel.id,
        stored_name=uuid.uuid4().hex,
        original_name=name,
        size_bytes=len(PCAP),
        sha256=hashlib.sha256(PCAP).hexdigest(),
        uploaded_by_id=msel.updated_by_id,
    )
    (file_dir / row.stored_name).write_bytes(PCAP)
    db_session.add(row)
    return row


def test_the_table_downloads_a_file_only_once_its_inject_is_delivered(
    client: TestClient,
    db_session: Session,
    ready_exercise: dict,  # noqa: F811
    file_dir,
) -> None:
    ttx_id = ready_exercise["ttx"]["id"]
    _ready_plan(client, ttx_id)
    msel = db_session.exec(select(TTXMsel).where(TTXMsel.ttx_id == uuid.UUID(ttx_id))).one()
    delivered = _stored_file(db_session, file_dir, msel, "edge-fw.pcap")
    pending = _stored_file(db_session, file_dir, msel, "later.pcap")
    snapshot = db_session.exec(select(MselSnapshot).where(MselSnapshot.msel_id == msel.id)).one()
    first, second = [i for i in snapshot.payload["injects"] if i["kind"] == "mandatory"][:2]
    for inject, row in ((first, delivered), (second, pending)):
        inject["files"] = [
            {
                "id": str(row.id),
                "name": row.original_name,
                "size_bytes": row.size_bytes,
                "sha256": row.sha256,
                "description": "",
            }
        ]
    flag_modified(snapshot, "payload")
    db_session.add(snapshot)
    db_session.commit()
    _post(client, ttx_id, "/start")
    # Its Controller gets any of them, delivered or not.
    assert client.get(_url(ttx_id, f"/files/{pending.id}")).status_code == 200
    _post(client, ttx_id, f"/injects/{first['code']}/release")

    _as_player(client, db_session, ttx_id)

    view = client.get(_url(ttx_id)).json()
    assert [f["name"] for f in view["injects"][0]["files"]] == ["edge-fw.pcap"]
    served = client.get(_url(ttx_id, f"/files/{delivered.id}"))
    assert served.status_code == 200
    assert served.content == PCAP
    assert served.headers["content-type"] == "application/octet-stream"
    assert served.headers["content-disposition"].startswith("attachment")
    assert client.get(_url(ttx_id, f"/files/{pending.id}")).status_code == 404
    assert client.get(_url(ttx_id, f"/files/{uuid.uuid4()}")).status_code == 404
    # The preview follows the same rule as the download.
    assert client.get(_url(ttx_id, f"/files/{pending.id}/preview")).status_code == 404
    assert client.get(_url(ttx_id, f"/files/{delivered.id}/preview")).status_code == 409


# -- scenarios -------------------------------------------------------------------------


def test_a_scenario_carries_its_files_and_checks_their_digest(
    client: TestClient, db_session: Session, exercise: dict, file_dir
) -> None:
    ttx_id = exercise["ttx"]["id"]
    capture = _upload(client, ttx_id, "edge-fw.pcap", PCAP).json()
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["files"] = [{"file_id": capture["id"], "description": "SOC capture"}]
    assert _put(client, ttx_id, payload).status_code == 200

    text = _export_scenario(client, ttx_id)
    doc = parse(text)
    assert doc.format_version == 8
    assert [(f.key, f.name, f.sha256) for f in doc.files] == [
        ("FILE-01", "edge-fw.pcap", capture["sha256"])
    ]
    assert doc.msel.injects[0].files[0].description == "SOC capture"

    target = _create_ttx(client, exercise["org_id"], "Copy")
    applied = _import_scenario(client, target["id"], text, dry_run=False)
    assert applied.status_code == 200, applied.text
    assert applied.json()["ok"] is True
    db_session.expire_all()
    copies = db_session.exec(select(MselFile)).all()
    assert len(copies) == 2 and len(list(file_dir.iterdir())) == 2
    copied = next(f for f in copies if str(f.id) != capture["id"])
    assert (file_dir / copied.stored_name).read_bytes() == PCAP

    # A file altered on the way is refused.
    data = json.loads(text.split("```json ttx-zone-scenario\n", 1)[1].split("\n```", 1)[0])
    data["files"][0]["sha256"] = "0" * 64
    tampered = text.replace(
        text.split("```json ttx-zone-scenario\n", 1)[1].split("\n```", 1)[0], json.dumps(data)
    )
    report = _import_scenario(client, target["id"], tampered).json()
    assert report["ok"] is False
    assert [e["code"] for e in report["errors"]] == ["SCENARIO_BAD_FILE"]
