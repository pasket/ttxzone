"""Scenarios: an exercise exported as a `.ttx.md` file without people,
approvals or dates; a file or a library scenario checked with a dry run
(nothing written) and then copied onto an exercise, overwriting it; the
organization's scenario library, managed by its Program Managers only."""

import io
import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session, select

from app.data.scenario_catalog import scenario_catalog
from app.models import (
    TTX,
    Inject,
    InjectFormat,
    MselImage,
    OrganizationScenario,
    PlatformAuditEvent,
    TTXNeed,
    TTXNeedsForm,
    TTXNeedsFormApproval,
    User,
    UserSession,
)
from app.schemas.scenario import SCENARIO_FORMAT_VERSION
from app.services.scenario_document import FENCE_INFO, parse, render
from tests.msel_helpers import example_payload
from tests.test_ttx_msel import _move, _open, _put
from tests.test_ttx_msel import _payload_from as _msel_payload_from
from tests.test_ttx_needs_form import (
    _approve,
    _create_ttx,
    _csrf,
    _left_out_of_scenarios,
    _manager,
    _to_approved,
)
from tests.test_ttx_needs_form import _get as _get_form
from tests.test_ttx_needs_form import _save as _save_form
from tests.test_ttx_needs_form import _transition as _move_form
from tests.test_ttx_tags import _create_ttx as _create_ttx_as
from tests.test_ttx_tags import _csrf_headers, _grant_planner


@pytest.fixture
def image_dir(tmp_path, monkeypatch):
    from app.services import msel_image_service

    monkeypatch.setattr(msel_image_service, "MSEL_IMAGE_DIR", tmp_path)
    return tmp_path


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (40, 20), (200, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def designed(client: TestClient, db_session: Session, image_dir) -> dict:
    """A fully designed exercise: approved needs analysis, a saved MSEL
    with an image, a tag applied. The client is its Program Manager (and
    Planner)."""
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    org_id = owner["organization"]["id"]
    ttx = _create_ttx(client, org_id, "Ransomware drill")
    _to_approved(client, ttx["id"])
    msel = _open(client, ttx["id"])
    image = client.post(
        f"/api/v1/ttx/{ttx['id']}/msel/images",
        files={"file": ("note.png", _png(), "application/octet-stream")},
        headers=_csrf(client),
    ).json()
    payload = example_payload(msel)
    payload["injects"][0]["images"] = [{"image_id": image["id"], "caption": "Ransom note"}]
    saved = _put(client, ttx["id"], payload)
    assert saved.status_code == 200, saved.text
    tag = client.post(
        f"/api/v1/ttx/{ttx['id']}/tags", json={"name": "Ransomware", "color": "rose"},
        headers=_csrf(client),
    ).json()  # fmt: skip
    client.put(
        f"/api/v1/ttx/{ttx['id']}/tags/apply", json={"tag_ids": [tag["id"]]},
        headers=_csrf(client),
    )  # fmt: skip
    return {"org_id": org_id, "ttx": ttx, "msel": saved.json()}


def _export(client: TestClient, ttx_id: str) -> str:
    response = client.get(f"/api/v1/ttx/{ttx_id}/scenario/export")
    assert response.status_code == 200, response.text
    assert response.headers["content-disposition"].endswith('.ttx.md"')
    return response.text


def _import(client: TestClient, ttx_id: str, text: str, dry_run: bool = True):
    return client.post(
        f"/api/v1/ttx/{ttx_id}/scenario/import?dry_run={str(dry_run).lower()}",
        files={"file": ("scenario.ttx.md", text.encode(), "text/markdown")},
        headers=_csrf(client),
    )


# -- export --------------------------------------------------------------------


def test_an_export_leaves_out_people_approvals_and_dates(
    client: TestClient, designed: dict
) -> None:
    text = _export(client, designed["ttx"]["id"])
    # The export's own timestamp is today's date, which may be the sample's.
    content = "\n".join(line for line in text.splitlines() if "exported_at" not in line)

    assert text.startswith('---\nformat: "ttx-zone.scenario"\nformat_version: 8\n')
    assert "# Ransomware drill" in text
    for private in (
        "Sponsor Example",
        "Design Lead Example",
        "Head of Security",
        "2026-11-02",
        "Committee members confirmed",
        "sponsor example",  # the approver's name
    ):
        assert private not in content, private
    doc = parse(text)
    assert doc.needs.stop_exercise_keyword == "BLUE SKY"
    assert [o.code for o in doc.needs.objectives] == ["OBJ-01", "OBJ-02", "OBJ-03"]
    assert doc.needs.objectives[0].need_codes == ["NEED-01"]
    assert doc.msel is not None and len(doc.msel.injects) == len(designed["msel"]["injects"])
    assert doc.msel.injects[0].images[0].caption == "Ransom note"
    assert len(doc.images) == 1
    assert [(t.name, t.applied) for t in doc.tags] == [("Ransomware", True)]


# -- import onto an exercise ------------------------------------------------------


def test_a_dry_run_reports_and_changes_nothing(
    client: TestClient, db_session: Session, designed: dict, image_dir
) -> None:
    text = _export(client, designed["ttx"]["id"])
    target = _create_ttx(client, designed["org_id"], "Empty")
    files_before = set(image_dir.iterdir())

    response = _import(client, target["id"], text)

    assert response.status_code == 200, response.text
    report = response.json()
    assert report["ok"] is True and report["errors"] == []
    assert report["counts"]["objectives"] == 3
    assert report["counts"]["images"] == 1
    assert report["replaces"]["objectives"] == 0
    db_session.expire_all()
    assert db_session.get(TTX, target["id"]).name == "Empty"
    form = db_session.exec(select(TTXNeedsForm).where(TTXNeedsForm.ttx_id == target["id"])).one()
    assert db_session.exec(select(TTXNeed).where(TTXNeed.form_id == form.id)).all() == []
    assert db_session.exec(select(Inject).where(Inject.ttx_id == target["id"])).all() == []
    assert set(image_dir.iterdir()) == files_before


def test_an_import_overwrites_the_exercise_and_round_trips(
    client: TestClient, db_session: Session, designed: dict, image_dir
) -> None:
    source_text = _export(client, designed["ttx"]["id"])
    target = _create_ttx(client, designed["org_id"], "Empty")

    response = _import(client, target["id"], source_text, dry_run=False)

    assert response.status_code == 200, response.text
    assert response.json()["ok"] is True
    db_session.expire_all()
    ttx = db_session.get(TTX, target["id"])
    assert ttx.name == "Ransomware drill" and ttx.code == target["code"]
    form = db_session.exec(select(TTXNeedsForm).where(TTXNeedsForm.ttx_id == target["id"])).one()
    assert form.status == "draft" and form.sponsor_name == "" and form.design_lead == ""
    assert form.date_window_start is None
    assert (
        db_session.exec(
            select(TTXNeedsFormApproval).where(TTXNeedsFormApproval.form_id == form.id)
        ).all()
        == []
    )
    # The images are written with their rows.
    images = db_session.exec(select(MselImage)).all()
    assert len(images) == 2 and len(list(image_dir.iterdir())) == 2

    # What comes back out is what went in.
    def comparable(text: str) -> dict:
        data = parse(text).model_dump(mode="json")
        data.pop("exported_at")
        for image in data["images"]:
            image.pop("data")
        return data

    assert comparable(_export(client, target["id"])) == comparable(source_text)


def test_a_file_with_errors_is_refused_and_nothing_changes(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    text = _export(client, designed["ttx"]["id"])
    target = _create_ttx(client, designed["org_id"], "Empty")
    doc = parse(text)
    doc.msel.injects[0].phase_code = "PH-99"
    doc.needs.objectives[0].need_codes = ["NEED-42"]
    broken_refs = render(doc)
    newer = text.replace('"format_version": 8', '"format_version": 9').replace(
        "format_version: 8", "format_version: 9"
    )

    cases = {
        "SCENARIO_UNKNOWN_REFERENCE": broken_refs,
        "SCENARIO_NEWER_FORMAT": newer,
        "SCENARIO_NO_DATA": text.replace("```json ttx-zone-scenario", "```json"),
        "SCENARIO_NO_FRONT_MATTER": text.split("---\n", 2)[2],
        "SCENARIO_BAD_JSON": text.replace('"format": "ttx-zone.scenario",', '"format": ,'),
    }
    for code, body in cases.items():
        response = _import(client, target["id"], body, dry_run=False)
        assert response.status_code == 200, (code, response.text)
        report = response.json()
        assert report["ok"] is False, code
        assert code in {e["code"] for e in report["errors"]}, (code, report["errors"])
    errors = _import(client, target["id"], broken_refs).json()["errors"]
    assert {e["path"] for e in errors} == {
        "msel.injects[0].phase_code",
        "needs.objectives[0].need_codes",
    }
    db_session.expire_all()
    assert db_session.get(TTX, target["id"]).name == "Empty"


def test_a_check_speaks_the_clients_language(client: TestClient, designed: dict) -> None:
    doc = parse(_export(client, designed["ttx"]["id"]))
    doc.msel.injects[0].phase_code = "PH-99"
    code = doc.msel.injects[0].code

    def errors(language: str) -> list[str]:
        response = client.post(
            f"/api/v1/ttx/{designed['ttx']['id']}/scenario/import",
            files={"file": ("scenario.ttx.md", render(doc).encode(), "text/markdown")},
            headers={**_csrf(client), "Accept-Language": language},
        )
        return [e["message"] for e in response.json()["errors"]]

    assert errors("en") == [f"{code} names PH-99, which isn't a phase of the scenario."]
    assert errors("es") == [f"{code} cita PH-99, que no es una fase del escenario."]


def test_unknown_fields_are_refused_rather_than_lost(client: TestClient, designed: dict) -> None:
    text = _export(client, designed["ttx"]["id"])
    tampered = text.replace('"cast": [', '"surprise": true,\n  "cast": [', 1)

    report = _import(client, designed["ttx"]["id"], tampered).json()

    assert report["ok"] is False
    assert report["errors"][0]["code"] == "SCENARIO_INVALID"
    assert report["errors"][0]["path"] == "surprise"


def test_overwriting_needs_no_step_up_and_only_a_real_run_is_audited(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    text = _export(client, designed["ttx"]["id"])
    user = db_session.exec(select(User).where(User.email == "owner@acme.com")).one()
    for user_session in db_session.exec(select(UserSession).where(UserSession.user_id == user.id)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()

    def audited() -> list:
        return list(
            db_session.exec(
                select(PlatformAuditEvent).where(
                    PlatformAuditEvent.action == "exercise.scenario_applied"
                )
            )
        )

    assert _import(client, designed["ttx"]["id"], text).json()["ok"] is True
    assert audited() == []
    applied = _import(client, designed["ttx"]["id"], text, dry_run=False)
    assert applied.status_code == 200, applied.text
    assert applied.json()["ok"] is True
    assert len(audited()) == 1


# -- TTX-Zone's catalog -----------------------------------------------------------------


def test_the_catalog_is_valid_and_bilingual(client: TestClient, designed: dict) -> None:
    catalog = scenario_catalog()
    assert catalog, "TTX-Zone ships at least one scenario"
    for scenario in catalog.values():
        assert set(scenario.documents) == {"en", "es"}, scenario.id
    items = client.get("/api/v1/scenario-catalog", headers={"Accept-Language": "es"}).json()[
        "items"
    ]
    assert {i["language"] for i in items} == {"es"}


@pytest.mark.parametrize("language", ["en", "es"])
@pytest.mark.parametrize("scenario_id", sorted(scenario_catalog()))
def test_a_ttx_zone_scenario_is_ready_once_people_and_dates_are_added(
    client: TestClient, db_session: Session, scenario_id: str, language: str
) -> None:
    """Copied onto an exercise, a shipped scenario's own content passes
    every rule: its needs analysis approves and its MSEL reaches READY once
    the Planner adds what the format leaves out."""
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx_id = _create_ttx(client, owner["organization"]["id"], locale=language)["id"]
    applied = client.post(
        f"/api/v1/ttx/{ttx_id}/scenario/apply?dry_run=false",
        json={"source": "system", "id": scenario_id},
        headers={**_csrf(client), "Accept-Language": language},
    )
    assert applied.json()["ok"] is True, applied.text

    form = _get_form(client, ttx_id)
    assert _save_form(client, ttx_id, _left_out_of_scenarios(form)).status_code == 200
    moved = _move_form(client, ttx_id, "ready_for_approval")
    assert moved.status_code == 200, moved.text
    assert _approve(client, ttx_id, "sponsor").status_code == 201
    assert _approve(client, ttx_id, "design_lead").status_code == 201
    assert _move_form(client, ttx_id, "approved").status_code == 200

    payload = _msel_payload_from(_open(client, ttx_id, language))
    for inject in payload["injects"]:
        inject["review_status"] = "validated"
    assert _put(client, ttx_id, payload).status_code == 200
    for to in ("in_review", "ready"):
        moved = _move(client, ttx_id, to)
        assert moved.status_code == 200, moved.text


def test_a_ttx_zone_scenario_is_applied_with_its_origin(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    scenario_id = next(iter(scenario_catalog()))
    url = f"/api/v1/ttx/{designed['ttx']['id']}/scenario/apply"
    body = {"source": "system", "id": scenario_id}

    check = client.post(url, json=body, headers=_csrf(client)).json()
    assert check["ok"] is True, check["errors"]
    assert check["replaces"]["injects"] == len(designed["msel"]["injects"])
    applied = client.post(f"{url}?dry_run=false", json=body, headers=_csrf(client))

    assert applied.json()["ok"] is True
    db_session.expire_all()
    ttx = db_session.get(TTX, designed["ttx"]["id"])
    assert (ttx.scenario_origin, ttx.scenario_origin_id) == ("system", scenario_id)


# -- the organization's library ----------------------------------------------------------


def test_program_managers_build_the_library_from_every_source(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    org = designed["org_id"]
    base = f"/api/v1/organizations/{org}/scenarios"
    headers = _csrf(client)

    from_ttx = client.post(base, json={"ttx_id": designed["ttx"]["id"]}, headers=headers)
    assert from_ttx.status_code == 201, from_ttx.text
    assert from_ttx.json()["origin"] == "exercise"
    from_system = client.post(
        base, json={"system_id": next(iter(scenario_catalog()))}, headers=headers
    )
    assert from_system.json()["name"].endswith("_copy")
    # An export is dated when it's made, not when the scenario was written.
    system_export = client.get(f"{base}/{from_system.json()['id']}/export").text
    assert "2026-10-12T00:00:00" not in system_export.split("---")[1]
    duplicate = client.post(
        base, json={"organization_scenario_id": from_ttx.json()["id"]}, headers=headers
    )
    assert duplicate.json()["name"] == "Ransomware drill_copy"

    exported = client.get(f"{base}/{from_ttx.json()['id']}/export")
    assert exported.status_code == 200
    checked = client.post(
        f"{base}/import",
        files={"file": ("x.ttx.md", exported.content, "text/markdown")},
        headers=headers,
    )
    assert checked.json()["ok"] is True
    assert len(client.get(base).json()["items"]) == 3  # the dry run added nothing
    imported = client.post(
        f"{base}/import?dry_run=false",
        files={"file": ("x.ttx.md", exported.content, "text/markdown")},
        headers=headers,
    )
    assert imported.status_code == 201
    assert len(client.get(base).json()["items"]) == 4


def test_a_scenario_an_exercise_came_from_is_disabled_not_deleted(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    org = designed["org_id"]
    base = f"/api/v1/organizations/{org}/scenarios"
    created = client.post(base, json={"ttx_id": designed["ttx"]["id"]}, headers=_csrf(client))
    scenario_id = created.json()["id"]
    target = _create_ttx(client, org, "Second")
    body = {"source": "organization", "id": scenario_id}
    applied = client.post(
        f"/api/v1/ttx/{target['id']}/scenario/apply?dry_run=false",
        json=body,
        headers=_csrf(client),
    )
    assert applied.json()["ok"] is True
    assert client.get(base).json()["items"][0]["usage_count"] == 1

    deleted = client.delete(f"{base}/{scenario_id}", headers=_csrf(client))

    assert deleted.json()["result"] == "disabled"
    refused = client.post(
        f"/api/v1/ttx/{target['id']}/scenario/apply", json=body, headers=_csrf(client)
    )
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "LIBRARY_ITEM_DISABLED"
    assert db_session.exec(select(OrganizationScenario)).one().disabled_at is not None


def test_planners_list_and_apply_but_never_change_the_organization_library(
    client: TestClient, db_session: Session
) -> None:
    org, _, planner = _grant_planner(client, db_session, "owner9@acme.com", "Acme9", "p9@acme.com")
    base = f"/api/v1/organizations/{org}/scenarios"
    scenario_id = next(iter(scenario_catalog()))
    created = client.post(base, json={"system_id": scenario_id}, headers=_csrf_headers(client))
    assert created.status_code == 201
    headers = _csrf_headers(planner)

    assert planner.get(base).status_code == 200
    assert planner.post(base, json={"system_id": scenario_id}, headers=headers).status_code == 403
    item = f"{base}/{created.json()['id']}"
    assert planner.get(f"{item}/export").status_code == 403
    assert (
        planner.post(
            f"{base}/import", files={"file": ("x.ttx.md", b"---", "text/markdown")}, headers=headers
        ).status_code
        == 403
    )
    assert planner.patch(item, json={"name": "X"}, headers=headers).status_code == 403
    assert planner.delete(item, headers=headers).status_code == 403

    # ...but copies it onto an exercise of theirs.
    ttx_id = _create_ttx_as(planner, org)
    check = planner.post(
        f"/api/v1/ttx/{ttx_id}/scenario/apply",
        json={"source": "organization", "id": created.json()["id"]},
        headers=headers,
    )
    assert check.status_code == 200 and check.json()["ok"] is True


def test_the_format_schema_is_published(client: TestClient, designed: dict) -> None:
    v1 = client.get("/api/v1/scenario-format/1/schema.json").json()
    v2 = client.get("/api/v1/scenario-format/2/schema.json").json()
    assert v1["title"] == "ScenarioDocumentV1" and v2["title"] == "ScenarioDocumentV2"
    assert "headline" not in json.dumps(v1) and "headline" in json.dumps(v2)
    v3 = client.get("/api/v1/scenario-format/3/schema.json").json()
    assert "room_codes" not in json.dumps(v2) and "room_codes" in json.dumps(v3)
    v4 = client.get("/api/v1/scenario-format/4/schema.json").json()
    assert "ScenarioInjectFile" not in json.dumps(v3) and "ScenarioInjectFile" in json.dumps(v4)
    v5 = client.get("/api/v1/scenario-format/5/schema.json").json()
    v6 = client.get("/api/v1/scenario-format/6/schema.json").json()
    injects = v6["$defs"]["ScenarioInjectV6"]["properties"]
    assert "scored" in v5["$defs"]["ScenarioInjectV5"]["properties"]
    assert "scored" not in injects and "poll_options" in injects
    v7 = client.get("/api/v1/scenario-format/7/schema.json").json()
    v8 = client.get(f"/api/v1/scenario-format/{SCENARIO_FORMAT_VERSION}/schema.json").json()
    assert "poll_outcomes" not in json.dumps(v6) and "poll_outcomes" in json.dumps(v7)
    assert "poll_impacts" not in json.dumps(v7) and "poll_impacts" in json.dumps(v8)
    newer = client.get(f"/api/v1/scenario-format/{SCENARIO_FORMAT_VERSION + 1}/schema.json")
    assert newer.status_code == 404


def test_a_version_5_file_turns_scored_into_a_format(
    client: TestClient,
    designed: dict,
) -> None:
    text = _export(client, designed["ttx"]["id"])
    head, _, tail = text.partition(f"```{FENCE_INFO}\n")
    block, _, rest = tail.partition("\n```")
    data = json.loads(block)
    data["format_version"] = 5
    injects = data["msel"]["injects"]
    for inject in injects:
        for field in ("format", "poll_question", "poll_options"):
            inject.pop(field, None)
        inject["scored"] = True
    injects[0]["scored"] = False
    old = (
        head.replace("format_version: 8", "format_version: 5")
        + f"```{FENCE_INFO}\n{json.dumps(data)}\n```{rest}"
    )

    doc = parse(old)
    assert doc.format_version == 8
    assert doc.msel.injects[0].format == InjectFormat.DISCUSSION
    assert doc.msel.injects[1].format == InjectFormat.INJECT


def test_a_version_1_file_still_imports_and_a_phase_headline_round_trips(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    text = _export(client, designed["ttx"]["id"])
    doc = parse(text)
    assert doc.format_version == 8
    # The same file as a version 1 one (no headlines) upgrades on reading.
    v1 = text.replace('"format_version": 8', '"format_version": 1').replace(
        "format_version: 8", "format_version: 1"
    )
    assert parse(v1).format_version == 8

    doc.msel.phases[0].headline = "Supplier breach"
    again = parse(render(doc))
    assert again.msel.phases[0].headline == "Supplier breach"


# -- placeholders ----------------------------------------------------------------


def test_a_scenario_lists_its_placeholders_and_fills_them_on_copy(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    url = f"/api/v1/ttx/{designed['ttx']['id']}/scenario/apply"
    body = {"source": "system", "id": "executive-tabletop"}

    check = client.post(url, json=body, headers=_csrf(client)).json()
    assert check["ok"] is True, check["errors"]
    found = {v["name"]: v["count"] for v in check["variables"]}
    assert {"group_name", "company_1", "company_2", "country_1", "supplier"} <= set(found)
    assert all(count > 0 for count in found.values())

    values = {"group_name": "Acme Energy", "country_1": "Freedonia", "company_2": "  "}
    applied = client.post(
        f"{url}?dry_run=false", json={**body, "variables": values}, headers=_csrf(client)
    )
    assert applied.json()["ok"] is True, applied.json()["errors"]

    db_session.expire_all()
    text = parse(_export(client, designed["ttx"]["id"])).model_dump_json()
    assert "Acme Energy" in text and "Freedonia" in text
    assert "{group_name}" not in text and "{country_1}" not in text
    # A blank value leaves its placeholder to complete later.
    assert "{company_2}" in text


def test_a_value_too_long_for_a_field_is_refused_and_nothing_changes(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    url = f"/api/v1/ttx/{designed['ttx']['id']}/scenario/apply?dry_run=false"
    body = {"source": "system", "id": "executive-tabletop", "variables": {"supplier": "x" * 255}}

    report = client.post(url, json=body, headers=_csrf(client)).json()

    assert report["ok"] is False
    assert report["errors"][0]["code"] == "SCENARIO_INVALID"
    assert report["errors"][0]["path"]
    db_session.expire_all()
    assert db_session.get(TTX, designed["ttx"]["id"]).name == "Ransomware drill"


def test_a_file_import_takes_the_values_as_a_form_field(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    catalog_doc = scenario_catalog()["executive-tabletop"].documents["en"]
    file_text = render(catalog_doc)
    target = _create_ttx(client, designed["org_id"], "Empty")

    response = client.post(
        f"/api/v1/ttx/{target['id']}/scenario/import?dry_run=false",
        files={"file": ("x.ttx.md", file_text.encode(), "text/markdown")},
        data={"variables": json.dumps({"group_name": "Acme Energy"})},
        headers=_csrf(client),
    )

    assert response.json()["ok"] is True, response.json()["errors"]
    # The catalog itself keeps its placeholders.
    assert "{group_name}" in catalog_doc.model_dump_json()
    db_session.expire_all()
    assert "{group_name}" not in parse(_export(client, target["id"])).model_dump_json()
    bad = client.post(
        f"/api/v1/ttx/{target['id']}/scenario/import",
        files={"file": ("x.ttx.md", file_text.encode(), "text/markdown")},
        data={"variables": "not json"},
        headers=_csrf(client),
    )
    assert bad.json()["error"]["code"] == "SCENARIO_BAD_VARIABLES"


def test_rooms_round_trip_and_keep_the_seats_of_rooms_still_there(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    """Version 3: rooms and where each inject is played travel with the
    scenario; applying it keeps the Players of a room with the same code."""
    import uuid

    from app.models import TTX, RoleEnum, TTXAccess, TTXRoom
    from tests.test_ttx_evaluation import _account

    source = designed["ttx"]["id"]
    ttx = db_session.get(TTX, uuid.UUID(source))
    ttx.uses_rooms = True
    blue = TTXRoom(ttx_id=ttx.id, code="RM-01", name="Blue", description="Tech")
    red = TTXRoom(ttx_id=ttx.id, code="RM-02", name="Red", position=1)
    ttx.next_room_number = 3
    db_session.add_all([ttx, blue, red])
    db_session.flush()
    first = db_session.exec(
        select(Inject).where(Inject.ttx_id == ttx.id, Inject.code == "INJ-01")
    ).one()
    first.room_ids = [red.id]
    db_session.add(first)
    db_session.commit()

    doc = parse(_export(client, source))
    assert doc.uses_rooms is True
    assert [(r.code, r.name, r.description) for r in doc.rooms] == [
        ("RM-01", "Blue", "Tech"),
        ("RM-02", "Red", ""),
    ]
    assert next(i for i in doc.msel.injects if i.code == "INJ-01").room_codes == ["RM-02"]

    # Onto another exercise: its RM-01 keeps its Player, its RM-03 goes.
    target = _create_ttx(client, designed["org_id"], "Target")
    tid = uuid.UUID(target["id"])
    own_blue = TTXRoom(ttx_id=tid, code="RM-01", name="Old blue")
    own_extra = TTXRoom(ttx_id=tid, code="RM-03", name="Extra")
    db_session.add_all([own_blue, own_extra])
    db_session.flush()
    ana = _account(db_session, "ana@acme.com", "Ana Ruiz")
    rob = _account(db_session, "rob@acme.com", "Rob Red")
    db_session.add_all(
        [
            TTXAccess(user_id=ana.id, ttx_id=tid, role=RoleEnum.PLAYER, room_id=own_blue.id),
            TTXAccess(user_id=rob.id, ttx_id=tid, role=RoleEnum.PLAYER, room_id=own_extra.id),
        ]
    )
    target_ttx = db_session.get(TTX, tid)
    target_ttx.next_room_number = 4
    db_session.add(target_ttx)
    db_session.commit()

    response = _import(client, target["id"], render(doc), dry_run=False)
    assert response.status_code == 200, response.text
    assert response.json()["ok"] is True, response.json()
    db_session.expire_all()
    rooms = {r.code: r for r in db_session.exec(select(TTXRoom).where(TTXRoom.ttx_id == tid))}
    assert {code: r.name for code, r in rooms.items()} == {"RM-01": "Blue", "RM-02": "Red"}
    seats = {
        a.user_id: a.room_id
        for a in db_session.exec(
            select(TTXAccess).where(TTXAccess.ttx_id == tid, TTXAccess.role == RoleEnum.PLAYER)
        )
    }
    assert seats == {ana.id: rooms["RM-01"].id, rob.id: None}
    target_ttx = db_session.get(TTX, tid)
    assert target_ttx.uses_rooms is True and target_ttx.next_room_number == 4
    copied = db_session.exec(
        select(Inject).where(Inject.ttx_id == tid, Inject.code == "INJ-01")
    ).one()
    assert copied.room_ids == [rooms["RM-02"].id]

    # A room the document doesn't define is refused.
    broken = parse(_export(client, source))
    broken.msel.injects[0].room_codes = ["RM-09"]
    report = _import(client, target["id"], render(broken)).json()
    assert report["ok"] is False
    assert any(e["path"].endswith("room_codes") for e in report["errors"])


def test_a_scenario_carries_the_language_of_its_content(client: TestClient, designed: dict) -> None:
    org, source = designed["org_id"], designed["ttx"]
    base = f"/api/v1/organizations/{org}/scenarios"
    client.patch(
        f"/api/v1/ttx/{source['id']}",
        json={"name": source["name"], "content_language": "es"},
        headers=_csrf(client),
    )
    # Saved from an exercise written in Spanish, it is a Spanish scenario,
    # whatever the language of whoever saves it...
    created = client.post(base, json={"ttx_id": source["id"]}, headers=_csrf(client)).json()
    assert created["language"] == "es"
    # ...and an exercise it is copied onto is written in Spanish from then on.
    target = _create_ttx(client, org, "Second")
    assert target["content_language"] == "en"
    applied = client.post(
        f"/api/v1/ttx/{target['id']}/scenario/apply?dry_run=false",
        json={"source": "organization", "id": created["id"]},
        headers=_csrf(client),
    )
    assert applied.json()["ok"] is True
    listed = {t["id"]: t for t in client.get("/api/v1/ttx").json()["items"]}
    assert listed[target["id"]]["content_language"] == "es"


def test_a_system_scenario_states_its_languages_and_copies_in_the_one_asked(
    client: TestClient, designed: dict
) -> None:
    """Availability is the scenario's, not the reader's; the copy's language
    is chosen, or follows the exercise before the reader."""
    org_id = designed["org_id"]
    headers = {**_csrf(client), "Accept-Language": "es"}
    listed = client.get("/api/v1/scenario-catalog", headers={"Accept-Language": "es"}).json()
    assert all(item["languages"] == ["en", "es"] for item in listed["items"])

    created = client.post(
        f"/api/v1/organizations/{org_id}/scenarios",
        json={"system_id": "ransomware", "language": "en"},
        headers=headers,
    ).json()
    assert created["language"] == "en"
    assert created["languages"] == ["en"]

    # Only a TTX-Zone scenario has languages to choose from.
    refused = client.post(
        f"/api/v1/organizations/{org_id}/scenarios",
        json={"organization_scenario_id": created["id"], "language": "es"},
        headers=headers,
    )
    assert refused.status_code == 422

    # Onto an exercise: its content language first, whoever copies...
    ttx = designed["ttx"]
    client.patch(f"/api/v1/ttx/{ttx['id']}", json={"content_language": "en"}, headers=_csrf(client))
    url = f"/api/v1/ttx/{ttx['id']}/scenario/apply?dry_run=true"
    body = {"source": "system", "id": "ransomware"}
    english = client.post(url, json=body, headers=headers).json()
    assert english["language"] == "en"
    # ...unless another one is chosen.
    spanish = client.post(url, json={**body, "language": "es"}, headers=headers).json()
    assert spanish["language"] == "es"


def _exercises(session: Session) -> int:
    session.expire_all()
    return len(session.exec(select(TTX)).all())


def test_a_new_exercise_comes_from_a_scenario_leaving_the_others_alone(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    org_id, current = designed["org_id"], designed["ttx"]
    url = f"/api/v1/organizations/{org_id}/exercises/from-scenario"
    body = {"source": "system", "id": "ransomware", "language": "es"}
    before = _exercises(db_session)

    # The check compares against nothing and leaves nothing behind.
    checked = client.post(url, json=body, headers=_csrf(client))
    assert checked.status_code == 200, checked.text
    assert checked.json()["ok"] is True
    assert checked.json()["replaces"] is None
    assert checked.json()["ttx_id"] is None
    assert _exercises(db_session) == before

    created = client.post(f"{url}?dry_run=false", json=body, headers=_csrf(client))
    assert created.status_code == 201, created.text
    assert _exercises(db_session) == before + 1
    new_id = created.json()["ttx_id"]

    # Its creator works on it right away; it records where it came from.
    assert client.get(f"/api/v1/ttx/{new_id}/scenario").json()["played"] is False
    row = db_session.get(TTX, uuid.UUID(new_id))
    assert row.content_language == "es"
    assert row.name == scenario_catalog()["ransomware"].document("es").exercise.name
    assert (row.scenario_origin, row.scenario_origin_id) == ("system", "ransomware")

    # The exercise in context stays as it was.
    assert db_session.get(TTX, uuid.UUID(current["id"])).name == current["name"]


def test_a_new_exercise_comes_from_a_file_and_a_bad_one_leaves_none(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    org_id = designed["org_id"]
    text = _export(client, designed["ttx"]["id"])
    url = f"/api/v1/organizations/{org_id}/exercises/import"
    before = _exercises(db_session)

    def send(content: str, dry_run: bool):
        return client.post(
            f"{url}?dry_run={str(dry_run).lower()}",
            files={"file": ("shared.ttx.md", content.encode(), "text/markdown")},
            headers=_csrf(client),
        )

    assert send("not a scenario", False).json()["ok"] is False
    assert send(text, True).json()["ok"] is True
    assert _exercises(db_session) == before

    created = send(text, False)
    assert created.status_code == 201, created.text
    assert created.json()["ttx_id"]
    assert _exercises(db_session) == before + 1


def test_only_the_organizations_planners_make_an_exercise_from_a_scenario(
    client: TestClient, db_session: Session, designed: dict
) -> None:
    other = _manager(client, db_session, "other@globex.com", "Globex")
    assert other["organization"]["id"] != designed["org_id"]
    refused = client.post(
        f"/api/v1/organizations/{designed['org_id']}/exercises/from-scenario?dry_run=false",
        json={"source": "system", "id": "ransomware"},
        headers=_csrf(client),
    )
    assert refused.status_code == 403
