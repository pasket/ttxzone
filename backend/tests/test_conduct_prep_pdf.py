"""The session documents exported from the conduct prep: what the plan
adds to each, and what the Players' ones must never contain."""

import pytest
from fastapi.testclient import TestClient

from tests.test_msel_pdf import EXPECTED_ACTION, _text
from tests.test_ttx_conduct_prep import _complete, _get, _save
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 -- fixture

STOP_TEXT = "Raise the red card and wait for the Controller"


def _export(client: TestClient, ttx_id: str, kind: str, lang: str = "en") -> str:
    response = client.get(f"/api/v1/ttx/{ttx_id}/conduct-prep/export/{kind}.pdf?lang={lang}")
    assert response.status_code == 200, response.text
    return _text(response.content)


@pytest.fixture
def planned(client: TestClient, exercise: dict) -> str:  # noqa: F811
    ttx_id = exercise["ttx"]["id"]
    payload = _complete(_get(client, ttx_id).json())
    payload["stop_procedure"] = STOP_TEXT
    payload["eeg"][0]["points"][0]["criteria_m"] = "Decision only after a reminder"
    assert _save(client, ttx_id, payload).status_code == 200
    return ttx_id


def test_the_sitman_tells_players_when_and_where_and_how_to_stop_but_no_answers(
    client: TestClient, planned: str
) -> None:
    text = _export(client, planned, "sitman")

    assert "Head office, crisis room" in text
    assert "Europe/Madrid" in text
    assert "10 Nov 2026" in text
    assert "not attributed to anyone" in text
    assert EXPECTED_ACTION not in text
    # Every participant must know how to halt (the Playground shows it too).
    assert STOP_TEXT in text and "BLUE SKY" in text


def test_the_guide_carries_the_stop_procedure_and_who_evaluates_what(
    client: TestClient, planned: str
) -> None:
    text = _export(client, planned, "facilitator-guide")

    assert STOP_TEXT in text and "BLUE SKY" in text
    assert "Eva Luator" in text
    # Days after the session, with the date once the session has one.
    assert "After Action Meeting 21 days after (1 Dec 2026)" in text
    assert EXPECTED_ACTION in text


def test_the_eeg_prints_the_common_scale_once_and_each_points_adjustments(
    client: TestClient, planned: str
) -> None:
    text = _export(client, planned, "eeg")

    assert "Decision only after a reminder" in text
    # Adjusted levels print under their point; the common scale only once.
    assert text.count("Done and achieved, with room to be more effective") == 1
    assert "Evaluated by: Eva Luator" in text
    assert EXPECTED_ACTION in text
    assert "Not final" in text  # the plan is still a draft


def test_the_evaluation_plan_is_the_evaluator_briefing(client: TestClient, planned: str) -> None:
    text = _export(client, planned, "evaluation-plan")

    assert "Decision timeline" in text and "Communications log" in text
    assert "Non-intervention rules" in text
    assert "don't play, facilitate or answer" in text
    assert "Hot wash On the session day (10 Nov 2026)" in text


def test_the_feedback_form_holds_nothing_of_the_scenario(client: TestClient, planned: str) -> None:
    text = _export(client, planned, "feedback-form", lang="es")

    assert "Formulario de feedback de los participantes" in text
    assert "Cumplimos este objetivo: OBJ-01" in text
    assert "Áreas de mejora" in text
    assert EXPECTED_ACTION not in text
    assert "Operation Dark Grid" not in text
    assert "BLUE SKY" not in text
