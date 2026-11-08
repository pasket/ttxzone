"""Renumbering a document's codes in order (PH-02, PH-01... -> PH-01,
PH-02...) while it's a draft never frozen: codes, counters and the codes
named in free text, and undo by sending the previous codes back."""

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import MselSnapshot
from app.services.code_renumber import code_rewriter
from tests.test_ttx_msel import (
    _move,
    _payload_from,
    _put,
    _saved_example,
    _to_ready,
    _url,
    exercise,  # noqa: F401 -- fixture
)
from tests.test_ttx_needs_form import (
    _complete_payload,
    _create_ttx,
    _csrf,
    _get,
    _manager,
    _save,
    _to_approved,
    _transition,
)


def _renumber(client: TestClient, url: str, kind: str, codes: dict | None = None):
    return client.post(url, json={"kind": kind, "codes": codes}, headers=_csrf(client))


def test_the_rewriter_replaces_whole_codes_in_one_pass() -> None:
    rewrite = code_rewriter({"PH-02": "PH-01", "PH-01": "PH-02", "INJ-04": "INJ-01"})
    assert rewrite("After PH-01, PH-02 (not PH-021).") == "After PH-02, PH-01 (not PH-021)."
    assert rewrite("INJ-04-A1 follows INJ-04") == "INJ-01-A1 follows INJ-01"
    assert rewrite(["see PH-02", "none"]) == ["see PH-01", "none"]


def test_discussion_injects_keep_their_prefix_when_renumbered(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = _payload_from(_saved_example(client, exercise))
    discussion = payload["injects"][-1]
    discussion.update(format="discussion", objective_ids=[])
    # A gap in the series: the counter moves past a deleted inject.
    del payload["injects"][0]
    assert _put(client, ttx_id, payload).status_code == 200

    response = _renumber(client, _url(ttx_id, "/renumber"), "injects")
    assert response.status_code == 200, response.text
    codes = {i["id"]: i["code"] for i in response.json()["msel"]["injects"]}
    assert codes[discussion["id"]].startswith("DSC-")
    numbers = sorted(int(code[4:]) for code in codes.values())
    assert numbers == list(range(1, len(codes) + 1))


def test_phases_are_renumbered_in_session_order_and_undone(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = _payload_from(_saved_example(client, exercise))
    first, second = payload["phases"][0], payload["phases"][1]
    # PH-02 now opens the session; PH-01 follows it.
    first["start_offset"], second["start_offset"] = second["start_offset"], first["start_offset"]
    first["end_offset"], second["end_offset"] = second["end_offset"], first["end_offset"]
    second["key_questions"] = ["What changed since PH-01?"]
    payload["summary"] = "PH-02 opens, then PH-01."
    saved = _put(client, ttx_id, payload).json()
    assert "phases" in saved["renumberable"]

    response = _renumber(client, _url(ttx_id, "/renumber"), "phases")
    assert response.status_code == 200, response.text
    body = response.json()
    msel = body["msel"]
    by_id = {p["id"]: p for p in msel["phases"]}
    assert by_id[second["id"]]["code"] == "PH-01"
    assert by_id[first["id"]]["code"] == "PH-02"
    assert by_id[second["id"]]["key_questions"] == ["What changed since PH-02?"]
    assert msel["summary"] == "PH-01 opens, then PH-02."
    assert "phases" not in msel["renumberable"]
    assert body["previous"][second["id"]] == "PH-02"

    undo = _renumber(client, _url(ttx_id, "/renumber"), "phases", body["previous"])
    assert undo.status_code == 200, undo.text
    back = undo.json()["msel"]
    assert {p["id"]: p["code"] for p in back["phases"]} == {
        p["id"]: p["code"] for p in saved["phases"]
    }
    assert back["summary"] == "PH-02 opens, then PH-01."


def _storyline(injects: list[dict], created: dict[str, str]) -> list[str]:
    """The storyline's reading order, by hand: mandatory injects by T+,
    each followed by its branches (depth first), siblings in the order
    they were created; untimed and loose ones last."""
    number = {i["id"]: int(created[i["id"]].split("-")[1]) for i in injects}
    children: dict[str, list[dict]] = {}
    for inject in injects:
        if inject["kind"] == "contingent" and inject["branch_from_id"]:
            children.setdefault(inject["branch_from_id"], []).append(inject)
    ordered: list[str] = []

    def walk(inject: dict) -> None:
        if inject["id"] in ordered:
            return
        ordered.append(inject["id"])
        for child in sorted(children.get(inject["id"], []), key=lambda c: number[c["id"]]):
            walk(child)

    mandatory = [i for i in injects if i["kind"] == "mandatory"]
    timed = sorted(
        (i for i in mandatory if i["offset_minutes"] is not None),
        key=lambda i: (i["offset_minutes"], number[i["id"]]),
    )
    untimed = sorted(
        (i for i in mandatory if i["offset_minutes"] is None), key=lambda i: number[i["id"]]
    )
    for inject in [*timed, *untimed, *sorted(injects, key=lambda i: number[i["id"]])]:
        walk(inject)
    return ordered


def test_injects_take_storyline_order_and_their_actions_follow(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    payload = _payload_from(_saved_example(client, exercise))
    # A new contingent inject off the first mandatory one: created last, it
    # belongs right after it on the storyline.
    first = min(
        (
            i
            for i in payload["injects"]
            if i["kind"] == "mandatory" and i["offset_minutes"] is not None
        ),
        key=lambda i: i["offset_minutes"],
    )
    template = next(i for i in payload["injects"] if i["kind"] == "contingent")
    payload["injects"].append(
        {
            **template,
            "id": None,
            "key": "branch",
            "title": "Branch",
            "phase_key": first["phase_key"],
            "branch_from_key": first["id"],
            "branch_action_key": None,
            "rejoin_key": None,
            "expected_actions": [],
        }
    )
    saved = _put(client, ttx_id, payload)
    assert saved.status_code == 200, saved.text
    saved = saved.json()
    branch = next(i for i in saved["injects"] if i["title"] == "Branch")
    payload = _payload_from(saved)
    next(i for i in payload["injects"] if i["id"] == branch["id"])["facilitator_notes"] = (
        f"Is {branch['code']}."
    )
    saved = _put(client, ttx_id, payload).json()
    assert "injects" in saved["renumberable"]

    body = _renumber(client, _url(ttx_id, "/renumber"), "injects").json()
    msel = body["msel"]
    by_id = {i["id"]: i for i in msel["injects"]}
    ordered = _storyline(msel["injects"], body["previous"])
    assert [by_id[i]["code"] for i in ordered] == [
        f"INJ-{n:02d}" for n in range(1, len(ordered) + 1)
    ]
    renamed = by_id[branch["id"]]
    assert ordered.index(branch["id"]) > ordered.index(first["id"])
    assert renamed["code"] != branch["code"]
    assert renamed["facilitator_notes"] == f"Is {renamed['code']}."
    for inject in msel["injects"]:
        for n, action in enumerate(inject["expected_actions"], start=1):
            assert action["code"] == f"{inject['code']}-A{n}"
    assert "injects" not in msel["renumberable"]
    # A new inject continues right after the last code.
    again = _payload_from(msel)
    again["injects"].append(
        {**again["injects"][0], "id": None, "title": "New", "expected_actions": []}
    )
    added = _put(client, ttx_id, again)
    assert added.status_code == 200, added.text
    codes = {i["title"]: i["code"] for i in added.json()["injects"]}
    assert codes["New"] == f"INJ-{len(ordered) + 1:02d}"


def test_a_msel_ready_before_renumbers_only_once_confirmed(
    client: TestClient,
    exercise: dict,  # noqa: F811
    db_session: Session,
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _to_ready(client, exercise)
    # Being played: its codes stay put.
    assert client.get(_url(ttx_id)).json()["frozen_versions"] == []
    response = _renumber(client, _url(ttx_id, "/renumber"), "phases")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "MSEL_RENUMBER_NOT_ALLOWED"

    assert _move(client, ttx_id, "draft").status_code == 200
    payload = _payload_from(client.get(_url(ttx_id)).json())
    first, second = payload["phases"][0], payload["phases"][1]
    first["start_offset"], second["start_offset"] = second["start_offset"], first["start_offset"]
    first["end_offset"], second["end_offset"] = second["end_offset"], first["end_offset"]
    saved = _put(client, ttx_id, payload).json()
    assert "phases" in saved["renumberable"]
    [frozen] = saved["frozen_versions"]
    assert frozen["version"] == 1
    assert frozen["sessions"] == 0
    assert frozen["ready_by"]
    assert frozen["ready_at"]

    response = _renumber(client, _url(ttx_id, "/renumber"), "phases")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "MSEL_RENUMBER_CONFIRM"

    response = client.post(
        _url(ttx_id, "/renumber"),
        json={"kind": "phases", "codes": None, "confirm_frozen": True},
        headers=_csrf(client),
    )
    assert response.status_code == 200, response.text
    by_id = {p["id"]: p["code"] for p in response.json()["msel"]["phases"]}
    assert by_id[second["id"]] == "PH-01"
    # The frozen version keeps the codes it was frozen with.
    snapshot = db_session.exec(select(MselSnapshot)).one()
    frozen_codes = {p["id"]: p["code"] for p in snapshot.payload["phases"]}
    assert frozen_codes[second["id"]] == "PH-02"
    assert "frozen_versions" not in snapshot.payload


def test_undo_codes_must_match_the_rows(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    saved = _saved_example(client, exercise)
    ids = [p["id"] for p in saved["phases"]]
    for codes in (
        {ids[0]: "PH-01"},  # not every phase
        dict.fromkeys(ids, "PH-01"),  # repeated
        {i: f"INJ-0{n}" for n, i in enumerate(ids, start=1)},  # another kind
    ):
        response = _renumber(client, _url(ttx_id, "/renumber"), "phases", codes)
        assert response.status_code == 422, codes
        assert response.json()["error"]["code"] == "MSEL_RENUMBER_INVALID"


def _needs_url(ttx_id: str) -> str:
    return f"/api/v1/ttx/{ttx_id}/needs-form/renumber"


def test_a_first_draft_of_the_needs_analysis_renumbers_its_needs(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    saved = _save(client, ttx["id"], _complete_payload(_get(client, ttx["id"]))).json()
    # Drop NEED-01: the rest keep NEED-02, NEED-03.
    payload = _complete_payload(saved)
    kept = saved["needs"][1:]
    payload["needs"] = [
        {
            **{k: need[k] for k in ("id", "source", "title", "finding", "affected_capability")},
            "priority": need["priority"],
            "key": need["id"],
        }
        for need in kept
    ]
    payload["needs"][1]["finding"] = "Unlike NEED-02, seen twice."
    payload["objectives"] = [
        {**objective, "id": saved_objective["id"], "linked_need_keys": [kept[0]["id"]]}
        for objective, saved_objective in zip(
            payload["objectives"], saved["objectives"], strict=True
        )
    ]
    payload["revision"] = saved["revision"]
    response = _save(client, ttx["id"], payload)
    assert response.status_code == 200, response.text
    assert response.json()["renumberable"] == ["needs"]

    response = _renumber(client, _needs_url(ttx["id"]), "needs")
    assert response.status_code == 200, response.text
    body = response.json()
    assert [n["code"] for n in body["form"]["needs"]] == ["NEED-01", "NEED-02"]
    assert body["form"]["needs"][1]["finding"] == "Unlike NEED-01, seen twice."
    assert body["form"]["renumberable"] == []
    assert body["previous"] == {kept[0]["id"]: "NEED-02", kept[1]["id"]: "NEED-03"}


def test_needs_are_renumbered_in_creation_order_only_when_there_are_gaps(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    saved = _save(client, ttx["id"], _complete_payload(_get(client, ttx["id"]))).json()

    def save_needs(form: dict, needs: list[dict]) -> dict:
        payload = _complete_payload(form)
        payload["needs"] = [
            {
                **{k: need[k] for k in ("id", "source", "title", "finding", "affected_capability")},
                "priority": need["priority"],
                "key": need["id"],
            }
            for need in needs
        ]
        payload["objectives"] = [
            {**objective, "id": saved_objective["id"], "linked_need_keys": [needs[0]["id"]]}
            for objective, saved_objective in zip(
                payload["objectives"], form["objectives"], strict=True
            )
        ]
        payload["revision"] = form["revision"]
        response = _save(client, ttx["id"], payload)
        assert response.status_code == 200, response.text
        return response.json()

    # Listed in another order, but no gaps: nothing to renumber.
    reordered = save_needs(saved, list(reversed(saved["needs"])))
    assert [n["code"] for n in reordered["needs"]] == ["NEED-03", "NEED-02", "NEED-01"]
    assert reordered["renumberable"] == []

    # NEED-02 deleted: a gap. Renumbering follows creation, not the list.
    gapped = save_needs(reordered, [n for n in reordered["needs"] if n["code"] != "NEED-02"])
    assert gapped["renumberable"] == ["needs"]
    body = _renumber(client, _needs_url(ttx["id"]), "needs").json()
    assert [n["code"] for n in body["form"]["needs"]] == ["NEED-02", "NEED-01"]
    assert body["form"]["renumberable"] == []


def test_an_approved_needs_analysis_keeps_its_codes(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    assert _transition(client, ttx["id"], "draft").status_code == 200
    assert _get(client, ttx["id"])["renumberable"] == []
    response = _renumber(client, _needs_url(ttx["id"]), "needs")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "NEEDS_FORM_RENUMBER_NOT_ALLOWED"


def test_objectives_are_renumbered_in_needs_order(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    saved = _save(client, ttx["id"], _complete_payload(_get(client, ttx["id"]))).json()
    assert saved["renumberable"] == []
    needs = {n["code"]: n["id"] for n in saved["needs"]}
    # OBJ-01 now covers NEED-03 and OBJ-03 covers NEED-01: out of needs order.
    covers = {"OBJ-01": "NEED-03", "OBJ-02": "NEED-02", "OBJ-03": "NEED-01"}
    payload = _complete_payload(saved)
    payload["needs"] = [
        {**need, "id": saved_need["id"], "key": saved_need["id"]}
        for need, saved_need in zip(payload["needs"], saved["needs"], strict=True)
    ]
    payload["objectives"] = [
        {
            **objective,
            "id": saved_objective["id"],
            "linked_need_keys": [needs[covers[saved_objective["code"]]]],
        }
        for objective, saved_objective in zip(
            payload["objectives"], saved["objectives"], strict=True
        )
    ]
    payload["revision"] = saved["revision"]
    response = _save(client, ttx["id"], payload)
    assert response.status_code == 200, response.text
    assert response.json()["renumberable"] == ["objectives"]
    before = {o["id"]: o["code"] for o in response.json()["objectives"]}

    body = _renumber(client, _needs_url(ttx["id"]), "objectives").json()
    code_of_need = {n["id"]: n["code"] for n in body["form"]["needs"]}
    assert {
        o["code"]: code_of_need[o["linked_need_ids"][0]] for o in body["form"]["objectives"]
    } == {"OBJ-01": "NEED-01", "OBJ-02": "NEED-02", "OBJ-03": "NEED-03"}
    assert body["form"]["renumberable"] == []

    undone = _renumber(client, _needs_url(ttx["id"]), "objectives", body["previous"]).json()
    assert {o["id"]: o["code"] for o in undone["form"]["objectives"]} == before
