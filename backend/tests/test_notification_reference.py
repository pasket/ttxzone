"""The expected-notifications reference: derived from the notification
requirements the objectives cite, never stored -- in the catalog served
to the needs form, as observation points of the definitive EEGs, in the
EEG for Control and Execution and in the observers' PDFs."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.data.regulatory_catalog import NOTIFICATION_MILESTONES, REGULATORY_REQUIREMENT_IDS
from app.services.notification_reference import expected_notifications
from tests.test_conduct_prep_pdf import _export
from tests.test_conduct_prep_pdf import planned as planned  # noqa: F401 -- fixture
from tests.test_ttx_conduct_prep import _csrf, _get, _url
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 -- fixture
from tests.test_ttx_needs_form import (
    _approve,
    _complete_payload,
    _saved_with,
)
from tests.test_ttx_needs_form import _get as _get_form
from tests.test_ttx_needs_form import _save as _save_form
from tests.test_ttx_needs_form import _transition as _move_form


def test_every_notification_requirement_is_in_the_catalog() -> None:
    assert set(NOTIFICATION_MILESTONES) <= REGULATORY_REQUIREMENT_IDS
    assert all(NOTIFICATION_MILESTONES.values())


def test_each_regime_is_listed_once_in_catalog_order_with_who_cites_it() -> None:
    notifications = expected_notifications(
        [
            ("OBJ-01", ["GDPR-33-34", "NIS2-21-2-C"]),
            ("OBJ-02", ["NIS2-23", "GDPR-33-34"]),
        ]
    )

    assert [(n.requirement.id, n.objective_codes) for n in notifications] == [
        ("NIS2-23", ("OBJ-02",)),
        ("GDPR-33-34", ("OBJ-01", "OBJ-02")),
    ]
    assert [m.deadline_en for m in notifications[0].milestones][:2] == ["24 h", "72 h"]


def test_the_catalog_serves_the_reports_of_a_notification_requirement(
    client: TestClient, exercise: dict
) -> None:
    items = {r["id"]: r for r in client.get("/api/v1/regulatory-requirements").json()["items"]}

    assert items["NIS2-23"]["notifications"][0]["stage_en"] == "Early warning"
    assert items["NIS2-21-2-C"]["notifications"] == []


def test_a_cited_notification_requirement_becomes_an_observation_point(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    points = _get(client, ttx_id).json()["eeg"][0]["points"]

    notification = [p for p in points if p["kind"] == "notification"]
    assert [p["source_requirement_id"] for p in notification] == ["NIS2-23"]
    assert notification[0]["text"].startswith("Identifies the NIS2 Art. 23 notification")
    assert notification[0]["source_status"] == "current"


def _cite(client: TestClient, ttx_id: str, requirement_ids: list[str]) -> None:
    """Reopen the needs analysis, make the first objective cite these and
    approve it again."""
    assert _move_form(client, ttx_id, "draft").status_code == 200
    form = _get_form(client, ttx_id)
    needs = _complete_payload(form)
    for objective, stored in zip(needs["objectives"], form["objectives"], strict=True):
        objective["id"] = stored["id"]
    needs["objectives"][0]["regulatory_requirement_ids"] = requirement_ids
    assert _save_form(client, ttx_id, needs).status_code == 200
    assert _move_form(client, ttx_id, "ready_for_approval").status_code == 200
    assert _approve(client, ttx_id, "sponsor").status_code == 201
    assert _approve(client, ttx_id, "design_lead").status_code == 201
    assert _move_form(client, ttx_id, "approved").status_code == 200


def test_the_reseed_follows_the_requirements_the_objective_cites(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _get(client, ttx_id)
    _cite(client, ttx_id, ["GDPR-33-34"])

    stale = _get(client, ttx_id).json()["eeg"][0]["points"]
    assert [p["source_status"] for p in stale if p["kind"] == "notification"] == ["orphaned"]

    reseeded = client.post(
        _url(ttx_id, "/eeg/reseed"), headers={**_csrf(client), "Accept-Language": "es"}
    )
    assert reseeded.status_code == 200, reseeded.text
    points = [p for p in reseeded.json()["eeg"][0]["points"] if p["kind"] == "notification"]
    assert [p["source_requirement_id"] for p in points] == ["GDPR-33-34"]
    assert points[0]["text"].startswith("Identifica la notificación RGPD")


def test_the_eeg_carries_the_observers_notification_reference(
    client: TestClient, exercise: dict
) -> None:
    ttx_id = exercise["ttx"]["id"]
    eeg = client.get(f"/api/v1/ttx/{ttx_id}/eeg").json()

    [nis2] = eeg["notifications"]
    assert nis2["requirement_id"] == "NIS2-23"
    assert nis2["objective_codes"] == ["OBJ-01"]
    assert nis2["milestones"][0]["deadline_en"] == "24 h"


def test_the_eeg_and_the_guide_print_the_notification_sheet(
    client: TestClient,
    planned: str,  # noqa: F811
) -> None:
    for kind in ("eeg", "facilitator-guide"):
        text = _export(client, planned, kind)
        assert "Expected notifications" in text
        assert "Early warning" in text
    assert "Notificaciones esperadas" in _export(client, planned, "eeg", "es")
    assert "Expected notifications" not in _export(client, planned, "sitman")


def test_a_cited_framework_not_named_in_triggers_is_a_warning(
    client: TestClient, db_session: Session
) -> None:
    def cite_gdpr(payload: dict) -> None:
        payload["objectives"][0]["regulatory_requirement_ids"] = ["NIS2-23", "GDPR-33-34"]

    _, response = _saved_with(client, db_session, objectives=cite_gdpr)
    assert response.status_code == 200, response.text
    warnings = response.json()["validation"]["warnings"]

    assert {
        (w["section"], w["field"], w["item_id"])
        for w in warnings
        if w["code"] == "OBJECTIVE_FRAMEWORK_NOT_NAMED"
    } == {(2, "regulatory_frameworks", "GDPR")}
