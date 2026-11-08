"""The MSEL and the session documents built from it (exported from the
conduct prep): one document per audience, and what each must never
contain -- checked on the PDF's own text, not on the layout code."""

import io
import uuid

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlmodel import Session

from app.models import RoleEnum, TTXAccess
from tests.msel_helpers import example_payload
from tests.test_ttx_evaluation import _account, _login
from tests.test_ttx_msel import _move, _open, _put
from tests.test_ttx_needs_form import _create_ttx, _manager, _to_approved

FACILITATOR_NOTE = "Watch whether the SOC lead escalates without being asked"
TRIGGER = "The SOC hasn't escalated by T+30"
EXPECTED_ACTION = "Committee records the early-warning decision with its rationale"


def _export(client: TestClient, ttx_id: str, kind: str, lang: str = "en"):
    if kind == "msel":
        return client.get(f"/api/v1/ttx/{ttx_id}/msel/export/{kind}.pdf?lang={lang}")
    # The session documents: the conduct prep is opened first, as the page does.
    client.get(f"/api/v1/ttx/{ttx_id}/conduct-prep")
    return client.get(f"/api/v1/ttx/{ttx_id}/conduct-prep/export/{kind}.pdf?lang={lang}")


def _text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    # Extraction may break lines anywhere: compare on collapsed whitespace.
    return " ".join(" ".join(page.extract_text() for page in reader.pages).split())


@pytest.fixture
def ready_exercise(client: TestClient, db_session: Session) -> dict:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    payload = example_payload(_open(client, ttx["id"]))
    payload["injects"][0]["facilitator_notes"] = FACILITATOR_NOTE
    assert _put(client, ttx["id"], payload).status_code == 200
    assert _move(client, ttx["id"], "in_review").status_code == 200
    assert _move(client, ttx["id"], "ready").status_code == 200
    return ttx


@pytest.mark.parametrize("kind", ["msel", "facilitator-guide", "sitman", "inject-cards", "eeg"])
def test_every_document_is_a_labelled_exercise_pdf(
    client: TestClient, ready_exercise: dict, kind: str
) -> None:
    response = _export(client, ready_exercise["id"], kind)

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "private, no-store"
    code = ready_exercise["code"]
    assert response.headers["content-disposition"] == (
        f'attachment; filename="{code}_{kind}_v1_AMBER.pdf"'
    )
    reader = PdfReader(io.BytesIO(response.content))
    for page in reader.pages:
        page_text = page.extract_text()
        assert "TLP:AMBER" in page_text
        assert "EXERCISE – EXERCISE – EXERCISE" in page_text


@pytest.mark.parametrize("kind", ["sitman", "inject-cards"])
def test_players_and_controllers_documents_hold_no_answers(
    client: TestClient, ready_exercise: dict, kind: str
) -> None:
    text = _text(_export(client, ready_exercise["id"], kind).content)

    assert EXPECTED_ACTION not in text
    assert FACILITATOR_NOTE not in text
    assert TRIGGER not in text
    # Every participant must know how to halt; the Controllers' cards don't need it.
    assert ("BLUE SKY" in text) == (kind == "sitman")
    # Who is behind it, and which injects are noise, stay with the planners.
    assert "Ransomware affiliate" not in text
    assert "Noise" not in text and "ATT&CK" not in text


def test_the_sitman_shows_no_injects(client: TestClient, ready_exercise: dict) -> None:
    text = _text(_export(client, ready_exercise["id"], "sitman").content)

    assert "Operation Dark Grid" in text
    # Time compression in the Scenario tab's words.
    assert "1 minute of session = 20 min of scenario time" in text
    assert "Ransom note found" not in text
    assert "INJ-01" not in text


def test_the_inject_cards_carry_the_literal_inject(
    client: TestClient, ready_exercise: dict
) -> None:
    text = _text(_export(client, ready_exercise["id"], "inject-cards").content)

    assert "INJ-01" in text and "INJ-18" in text
    assert "SOC alert: mass file renames on the file server. (Literal text of the inject.)" in text


def test_the_planning_documents_have_everything(client: TestClient, ready_exercise: dict) -> None:
    full = _text(_export(client, ready_exercise["id"], "msel").content)
    guide = _text(_export(client, ready_exercise["id"], "facilitator-guide").content)

    for text in (full, guide):
        assert EXPECTED_ACTION in text
        assert FACILITATOR_NOTE in text
        assert TRIGGER in text
    assert "BLUE SKY" in guide
    for text in (full, guide):
        assert "THR-01" in text and "Ransomware affiliate (fictitious)" in text
        # Each inject says whose activity its techniques are: code first,
        # then title; the techniques one per line.
        assert "THR-01 | Ransomware affiliate (fictitious)" in text
        assert "T1486 | Data Encrypted for Impact" in text
        # Coded rows are never listed with commas.
        assert "OBJ-01, OBJ-02" not in text
    assert "Scenario start 6:45 am" in full
    assert "Session start 9:30 am" in full
    # OT impact opens with a time jump.
    assert "12 h later in the scenario" in full
    assert "12 h later in the scenario" in guide
    # ATT&CK: the pinned release and the techniques grouped by tactic, one
    # per line under it, code first.
    assert "MITRE ATT&CK v19.2 (Enterprise, ICS)" in full
    assert "Initial Access T1566 | Phishing" in full
    assert "Impact T1486 | Data Encrypted for Impact T1490 | Inhibit System Recovery" in full
    assert "The MITRE Corporation" in full


def test_the_eeg_lists_the_expected_actions_as_observation_points(
    client: TestClient, ready_exercise: dict
) -> None:
    text = _text(_export(client, ready_exercise["id"], "eeg").content)

    assert "OBJ-01" in text
    assert EXPECTED_ACTION in text
    assert "P — Performed without challenges" in text


def test_a_poll_prints_its_question_and_options(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    payload = example_payload(_open(client, ttx["id"]))
    payload["injects"][-1].update(
        format="poll", poll_question="Pay the ransom?", poll_options=["Pay <now>", "Refuse"]
    )
    assert _put(client, ttx["id"], payload).status_code == 200
    assert _move(client, ttx["id"], "in_review").status_code == 200
    assert _move(client, ttx["id"], "ready").status_code == 200

    for kind in ("msel", "facilitator-guide", "inject-cards"):
        response = _export(client, ttx["id"], kind)
        assert response.status_code == 200, (kind, response.text)
        text = _text(response.content)
        assert "Pay the ransom?" in text and "A. Pay <now>" in text and "B. Refuse" in text, kind


def test_documents_come_in_the_requested_language(client: TestClient, ready_exercise: dict) -> None:
    text = _text(_export(client, ready_exercise["id"], "sitman", lang="es").content)

    assert "Manual de situación (SitMan)" in text
    assert "1 minuto de sesión = 20 min de tiempo del escenario" in text
    assert "Duración de la sesión 3 h" in text
    assert "EJERCICIO – EJERCICIO – EJERCICIO" in text


def test_user_text_is_printed_not_interpreted(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    payload = example_payload(_open(client, ttx["id"]))
    payload["title"] = "<img src='/etc/passwd'/> Dark <b>Grid</b>"
    assert _put(client, ttx["id"], payload).status_code == 200

    response = _export(client, ttx["id"], "sitman")

    assert response.status_code == 200
    assert "<img src='/etc/passwd'/> Dark <b>Grid</b>" in _text(response.content)


def test_the_summary_keeps_its_formatting(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    payload = example_payload(_open(client, ttx["id"]))
    payload["summary"] = (
        "A **quiet** Sunday, _08:00_.\n\n- Login from a contractor\n- <b>Raw</b> markup\n\n"
        "1. Call the committee\n2. Decide"
    )
    assert _put(client, ttx["id"], payload).status_code == 200

    for kind in ("sitman", "msel"):
        text = _text(_export(client, ttx["id"], kind).content)
        # Bold, italic and lists rendered, not their marks...
        assert "A quiet Sunday, 08:00." in text
        assert "• Login from a contractor" in text
        assert "1. Call the committee 2. Decide" in text
        assert "**" not in text
        # ...and anything typed as markup still printed as typed.
        assert "• <b>Raw</b> markup" in text


def test_a_draft_with_errors_cannot_be_exported(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    _open(client, ttx["id"])

    response = _export(client, ttx["id"], "msel")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "MSEL_INCOMPLETE"


def test_a_valid_draft_is_exported_as_not_final(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    assert _put(client, ttx["id"], example_payload(_open(client, ttx["id"]))).status_code == 200

    text = _text(_export(client, ttx["id"], "msel").content)

    assert "Not final: this is version 1 in status “Draft”" in text


def test_unknown_documents_and_players_are_refused(
    client: TestClient, db_session: Session, ready_exercise: dict
) -> None:
    assert _export(client, ready_exercise["id"], "answers").status_code == 422
    # The session documents are the conduct prep's.
    moved = client.get(f"/api/v1/ttx/{ready_exercise['id']}/msel/export/sitman.pdf")
    assert moved.status_code == 422

    player = _account(db_session, "player@acme.com", "Player")
    db_session.add(
        TTXAccess(user_id=player.id, ttx_id=uuid.UUID(ready_exercise["id"]), role=RoleEnum.PLAYER)
    )
    db_session.commit()
    _login(client, player.email)
    assert _export(client, ready_exercise["id"], "sitman").status_code == 403


def test_injects_arrive_by_ticket_or_a_security_tool(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    payload = example_payload(_open(client, ttx["id"]))
    payload["injects"][0]["delivery_method"] = "ticket"
    payload["injects"][1]["delivery_method"] = "security_tool"
    saved = _put(client, ttx["id"], payload)
    assert saved.status_code == 200
    methods = [i["delivery_method"] for i in saved.json()["injects"][:2]]
    assert methods == ["ticket", "security_tool"]

    text = _text(_export(client, ttx["id"], "inject-cards", lang="es").content)
    assert "Ticket" in text and "Herramienta de ciberseguridad" in text


def test_the_msel_pdf_draws_the_storyline_on_a_landscape_page(
    client: TestClient, ready_exercise: dict
) -> None:
    reader = PdfReader(io.BytesIO(_export(client, ready_exercise["id"], "msel").content))

    wide = [p for p in reader.pages if p.mediabox.width > p.mediabox.height]
    assert len(wide) == 1
    text = " ".join(wide[0].extract_text().split())
    assert "Storyline" in text
    assert "INJ-01" in text and "PH-01" in text and "T+00:00" in text
    # The page is decorated like the others: TLP and the exercise banner.
    assert "TLP:" in text and "EXERCISE" in text


@pytest.mark.parametrize("kind", ["sitman", "inject-cards", "facilitator-guide"])
def test_the_session_documents_stay_portrait_without_the_storyline(
    client: TestClient, ready_exercise: dict, kind: str
) -> None:
    reader = PdfReader(io.BytesIO(_export(client, ready_exercise["id"], kind).content))

    assert all(p.mediabox.width < p.mediabox.height for p in reader.pages)
