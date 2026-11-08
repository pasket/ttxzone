"""An inject's content rendered as a simulated artifact (a fake email,
press release, social post or chat message): saved with the MSEL, frozen in
its READY snapshot, shown to the table once delivered, and carried by
scenario files (format version 5)."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from app.models import MselSnapshot, TTXMsel
from app.services.scenario_document import parse
from tests.msel_helpers import example_payload
from tests.test_exercise_run import _as_player, _post, _ready_plan, _url
from tests.test_msel_files import exercise  # noqa: F401 (fixture)
from tests.test_msel_pdf import _export as _export_pdf
from tests.test_msel_pdf import _text as _pdf_text
from tests.test_scenario_library import _export as _export_scenario
from tests.test_scenario_library import _import as _import_scenario
from tests.test_ttx_conduct_prep import exercise as ready_exercise  # noqa: F401 (fixture)
from tests.test_ttx_msel import _open, _put
from tests.test_ttx_needs_form import _create_ttx

EMAIL = {
    "kind": "email",
    "sender": "IT Service Desk",
    "sender_address": "helpdesk@example-corp.example",
    "recipient": "All staff",
    "subject": "Mandatory password reset",
    "timestamp": "Day 1, 08:12",
    "location": "",
}


def test_an_artifact_is_saved_validated_and_carried_by_a_scenario(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["artifact"] = EMAIL
    assert _put(client, ttx_id, payload).status_code == 200
    saved = _open(client, ttx_id)["injects"][0]
    assert saved["artifact"] == EMAIL
    assert all(i["artifact"] is None for i in _open(client, ttx_id)["injects"][1:])

    # Only the known kinds and fields.
    for bad in ({**EMAIL, "kind": "html"}, {**EMAIL, "script": "x"}):
        payload["injects"][0]["artifact"] = bad
        payload["revision"] = _open(client, ttx_id)["revision"]
        assert _put(client, ttx_id, payload).status_code == 422

    text = _export_scenario(client, ttx_id)
    doc = parse(text)
    assert doc.format_version == 8
    assert doc.msel.injects[0].artifact.subject == "Mandatory password reset"
    target = _create_ttx(client, exercise["org_id"], "Copy")
    applied = _import_scenario(client, target["id"], text, dry_run=False)
    assert applied.status_code == 200 and applied.json()["ok"] is True, applied.text
    copy = _open(client, target["id"])
    assert copy["injects"][0]["artifact"] == EMAIL


def test_the_pdfs_say_how_the_inject_is_shown(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = example_payload(exercise["msel"])
    payload["injects"][0]["artifact"] = {**EMAIL, "subject": "<b>Reset</b> now"}
    assert _put(client, ttx_id, payload).status_code == 200

    for kind, lang, label in (
        ("msel", "en", "Shown as: Email"),
        ("inject-cards", "es", "Se muestra como Correo electrónico"),
    ):
        pdf = _export_pdf(client, ttx_id, kind, lang)
        assert pdf.status_code == 200, pdf.text
        text = _pdf_text(pdf.content)
        assert label in text, kind
        # Narrow cells wrap anywhere: compare without spaces.
        compact = text.replace(" ", "")
        assert "helpdesk@example-corp.example" in compact
        # User text is escaped, never parsed as markup.
        assert "<b>Reset</b>now" in compact


def test_the_table_sees_the_artifact_once_delivered(
    client: TestClient,
    db_session: Session,
    ready_exercise: dict,  # noqa: F811
) -> None:
    ttx_id = ready_exercise["ttx"]["id"]
    _ready_plan(client, ttx_id)
    msel = db_session.exec(select(TTXMsel).where(TTXMsel.ttx_id == uuid.UUID(ttx_id))).one()
    snapshot = db_session.exec(select(MselSnapshot).where(MselSnapshot.msel_id == msel.id)).one()
    first = next(i for i in snapshot.payload["injects"] if i["kind"] == "mandatory")
    first["artifact"] = {**EMAIL, "kind": "press_release", "location": "Springfield"}
    flag_modified(snapshot, "payload")
    db_session.add(snapshot)
    db_session.commit()
    _post(client, ttx_id, "/start")
    _post(client, ttx_id, f"/injects/{first['code']}/release")

    _as_player(client, db_session, ttx_id)
    view = client.get(_url(ttx_id)).json()
    assert view["injects"][0]["artifact"]["kind"] == "press_release"
    assert view["injects"][0]["artifact"]["location"] == "Springfield"
