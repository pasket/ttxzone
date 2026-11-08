"""How an objective is measured: one condition per line, the achievement
rule, the time box and the rating guidance -- saved by the needs analysis,
checked by its report, carried to the EEG and printed for evaluators."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.services.objective_text import clamp_at_least, is_rating_level, split_levels
from tests.test_conduct_prep_pdf import _export
from tests.test_conduct_prep_pdf import planned as planned  # noqa: F401 -- fixture
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 -- fixture
from tests.test_ttx_needs_form import _saved_with

CONDITIONS = "Escalation decision taken\nTrigger role named\nCriteria stated"


def _measured(payload: dict) -> None:
    objective = payload["objectives"][0]
    objective["success_criterion"] = CONDITIONS
    objective["achieve_at_least"] = 2
    objective["time_box_minutes"] = 15
    objective["achieved_note"] = "For each key decision."
    objective["partially_achieved"] = "A decision without a named trigger."
    objective["not_achieved"] = ""
    objective["evidence"] = "Decision timestamp\nRole named as trigger"


def test_rating_levels_are_told_from_conditions() -> None:
    assert is_rating_level("Partially achieved: 2 of 3 decisions")
    assert is_rating_level("No se consigue: ninguna decisión")
    assert is_rating_level("Achieved only if all of the following:")
    assert not is_rating_level("Achieved if, within 15 minutes: (1) a decision is taken")
    assert not is_rating_level("Owner: a single named individual by role")


def test_at_least_k_of_n_only_between_one_and_n_minus_one() -> None:
    assert clamp_at_least(2, 3) == 2
    assert clamp_at_least(3, 3) is None
    assert clamp_at_least(1, 1) is None
    assert clamp_at_least(None, 3) is None


def test_the_measurement_is_saved_with_the_rule_clamped(
    client: TestClient, db_session: Session
) -> None:
    _, response = _saved_with(client, db_session, objectives=_measured)
    assert response.status_code == 200, response.text
    saved = response.json()["objectives"][0]
    assert (saved["achieve_at_least"], saved["time_box_minutes"]) == (2, 15)
    assert (saved["achieved_note"], saved["partially_achieved"], saved["not_achieved"]) == (
        "For each key decision.",
        "A decision without a named trigger.",
        "",
    )


def test_at_least_all_of_them_is_stored_as_all(client: TestClient, db_session: Session) -> None:
    def all_of_them(payload: dict) -> None:
        _measured(payload)
        payload["objectives"][0]["achieve_at_least"] = 3

    _, response = _saved_with(client, db_session, objectives=all_of_them)
    assert response.json()["objectives"][0]["achieve_at_least"] is None


def test_a_rating_level_written_as_a_condition_is_a_warning(
    client: TestClient, db_session: Session
) -> None:
    def level_in_criterion(payload: dict) -> None:
        payload["objectives"][0]["success_criterion"] = (
            "Escalation decision taken\nPartially achieved: no trigger role named"
        )

    _, response = _saved_with(client, db_session, objectives=level_in_criterion)
    warnings = response.json()["validation"]["warnings"]
    assert [w["field"] for w in warnings if w["code"] == "CONDITION_IS_A_RATING_LEVEL"] == [
        "success_criterion"
    ]


def test_the_eeg_says_how_each_objective_is_judged(client: TestClient, exercise: dict) -> None:
    eeg = client.get(f"/api/v1/ttx/{exercise['ttx']['id']}/eeg").json()
    first = eeg["objectives"][0]

    assert first["observation_points"] == ["Documented decision with its rationale in 60 minutes"]
    assert first["evidence_items"] == ["Minutes and timeline"]
    assert first["achieve_at_least"] is None and first["time_box_minutes"] is None


def test_the_eeg_pdf_prints_the_rule_and_an_evidence_checklist(
    client: TestClient,
    planned: str,  # noqa: F811
) -> None:
    text = _export(client, planned, "eeg")

    assert "Achieved when its condition is met" in text
    assert "[ ] Minutes and timeline" in text


def test_an_objective_needs_a_title(client: TestClient, db_session: Session) -> None:
    def untitled(payload: dict) -> None:
        payload["objectives"][0]["title"] = "  "

    _, response = _saved_with(client, db_session, objectives=untitled)
    body = response.json()
    missing = {
        (i["section"], i["field"], i["item_id"])
        for i in body["validation"]["ready"]
        if i["code"] == "NEEDS_FORM_INCOMPLETE"
    }
    assert (5, "title", body["objectives"][0]["id"]) in missing
    assert body["objectives"][0]["title"] == ""


def test_references_name_an_objective_by_its_title(
    client: TestClient,
    planned: str,  # noqa: F811
) -> None:
    eeg = client.get(f"/api/v1/ttx/{planned}/eeg").json()
    assert eeg["objectives"][0]["title"] == "NIS2 early-warning decision"

    text = _export(client, planned, "eeg")
    # The heading names it; the statement it's rated against follows whole.
    assert "OBJ-01 | NIS2 early-warning decision" in text
    assert "The committee decides whether an NIS2 early warning is due" in text


def test_free_guidance_splits_into_the_three_levels() -> None:
    assert split_levels(
        "Achieved only if all three decisions meet all of the following:\n"
        "Partially achieved: 2 of 3 decisions. Not achieved: 1 or none."
    ) == {
        "achieved": "Achieved only if all three decisions meet all of the following:",
        "partial": "2 of 3 decisions.",
        "not": "1 or none.",
    }
    assert split_levels("No se consigue: ninguna decisión")["not"] == "Ninguna decisión"


def test_the_eeg_pdf_rates_on_the_scale_with_each_outcome_spelled_out(
    client: TestClient,
    planned: str,  # noqa: F811
) -> None:
    text = _export(client, planned, "eeg")

    assert "[ ] M" in text and "Partially achieved" in text
    # Blank levels read the common definition.
    assert "Only partly done, late, with help or harming other activities." in text
