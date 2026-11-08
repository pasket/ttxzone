"""An improvement action linked to the later exercise that re-tests it --
and, optionally, which of its objectives: follow-up, so it never reopens a
FINAL report; seen from both exercises and in Admin -> Improvement plan."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import TTX, ImprovementAction
from tests.test_after_action import _aar, _payload, played  # noqa: F401 (fixture)
from tests.test_exercise_run import _pdf_text
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_needs_form import _create_ttx, _csrf, _get, _to_approved


def _with_action(client: TestClient, ttx_id: str) -> dict:
    read = client.post(_aar(ttx_id), headers=_csrf(client)).json()
    new = {
        "objective_code": read["objectives"][0]["objective_code"],
        "finding": "Nobody called the regulator",
        "action": "Add the regulator to the call tree",
        "owner": "Laura",
        "owner_area": "Legal",
        "due_date": None,
        "status": "open",
    }
    saved = client.put(_aar(ttx_id), json=_payload(read, actions=[new]), headers=_csrf(client))
    assert saved.status_code == 200, saved.text
    return saved.json()


def _link(client: TestClient, ttx_id: str, **body):
    return client.patch(
        _aar(ttx_id, "/actions/IP-01"), json={"status": "in_progress", **body},
        headers=_csrf(client),
    )  # fmt: skip


def test_an_action_is_linked_to_a_later_exercise_and_one_of_its_objectives(
    client: TestClient,
    played: dict,  # noqa: F811
) -> None:
    source = played["ttx_id"]
    _with_action(client, source)
    later = _create_ttx(client, played["org_id"], "Ransomware drill II")
    _to_approved(client, later["id"])
    objective = _get(client, later["id"])["objectives"][0]

    candidates = client.get(_aar(source, "/retest-candidates")).json()
    assert [c["ttx_id"] for c in candidates] == [later["id"]]
    assert objective["id"] in [o["id"] for o in candidates[0]["objectives"]]
    # Code, name and objectives only.
    assert set(candidates[0]) == {"ttx_id", "ttx_code", "ttx_name", "archived", "objectives"}

    final = client.post(_aar(source, "/transitions"), json={"to": "final"}, headers=_csrf(client))
    assert final.status_code == 200, final.text
    linked = _link(client, source, retest_ttx_id=later["id"], retest_objective_id=objective["id"])
    assert linked.status_code == 200, linked.text
    body = linked.json()
    assert body["status"] == "final" and body["version"] == 1
    retest = body["actions"][0]["retest"]
    assert (retest["ttx_code"], retest["objective_code"]) == (later["code"], objective["code"])

    pdf = client.get(_aar(source, "/export.pdf?lang=en"))
    assert "Re-tested in" in _pdf_text(pdf.content) and later["code"] in _pdf_text(pdf.content)

    # A status change alone leaves the link as it is.
    kept = client.patch(_aar(source, "/actions/IP-01"), json={"status": "done"},
                        headers=_csrf(client))  # fmt: skip
    assert kept.json()["actions"][0]["retest"]["ttx_id"] == later["id"]

    # The later exercise sees it.
    retests = client.get(f"/api/v1/ttx/{later['id']}/retests").json()
    assert [(r["code"], r["source_ttx_id"], r["objective_id"]) for r in retests] == [
        ("IP-01", source, objective["id"])
    ]

    # And so does Admin -> Improvement plan, filtered by it.
    plan = f"/api/v1/organizations/{played['org_id']}/improvement-plan"
    assert (
        client.get(f"{plan}?retest=linked").json()["items"][0]["retest"]["ttx_id"] == (later["id"])
    )
    assert client.get(f"{plan}?retest=unlinked").json()["items"] == []

    cleared = _link(client, source, retest_ttx_id=None)
    assert cleared.json()["actions"][0]["retest"] is None
    assert client.get(f"/api/v1/ttx/{later['id']}/retests").json() == []


def test_only_a_later_exercise_of_the_organization_and_its_own_objectives(
    client: TestClient,
    db_session: Session,
    played: dict,  # noqa: F811
) -> None:
    source = played["ttx_id"]
    _with_action(client, source)
    later = _create_ttx(client, played["org_id"], "Later")
    other_objective = _get(client, source)["objectives"][0]

    for body, code in (
        ({"retest_ttx_id": source}, "RETEST_INVALID_EXERCISE"),
        ({"retest_ttx_id": str(uuid.uuid4())}, "RETEST_INVALID_EXERCISE"),
        (
            {"retest_ttx_id": later["id"], "retest_objective_id": other_objective["id"]},
            "RETEST_INVALID_OBJECTIVE",
        ),
    ):
        refused = _link(client, source, **body)
        assert refused.status_code == 422, (body, refused.text)
        assert refused.json()["error"]["code"] == code

    # An earlier exercise can't re-test it.
    earlier = db_session.get(TTX, uuid.UUID(later["id"]))
    earlier.created_at = db_session.get(TTX, uuid.UUID(source)).created_at.replace(year=2000)
    db_session.add(earlier)
    db_session.commit()
    refused = _link(client, source, retest_ttx_id=later["id"])
    assert refused.json()["error"]["code"] == "RETEST_INVALID_EXERCISE"


def test_the_link_goes_with_the_exercise_or_objective_not_the_action(
    client: TestClient,
    db_session: Session,
    played: dict,  # noqa: F811
) -> None:
    source = played["ttx_id"]
    _with_action(client, source)
    later = _create_ttx(client, played["org_id"], "Later")
    _to_approved(client, later["id"])
    objective = _get(client, later["id"])["objectives"][0]
    _link(client, source, retest_ttx_id=later["id"], retest_objective_id=objective["id"])

    # Its objective goes (a scenario copied over the later exercise): the
    # exercise stays.
    exported = client.get(f"/api/v1/ttx/{later['id']}/scenario/export").text
    applied = client.post(
        f"/api/v1/ttx/{later['id']}/scenario/import?dry_run=false",
        files={"file": ("s.ttx.md", exported.encode(), "text/markdown")},
        headers=_csrf(client),
    )
    assert applied.status_code == 200, applied.text
    retest = client.get(_aar(source)).json()["actions"][0]["retest"]
    assert retest["ttx_id"] == later["id"] and retest["objective_id"] is None

    # The exercise goes: the action stays, unlinked.
    deleted = client.request(
        "DELETE", f"/api/v1/ttx/{later['id']}", json={"confirmation": "Later"},
        headers=_csrf(client),
    )  # fmt: skip
    assert deleted.status_code == 204, deleted.text
    db_session.expire_all()
    action = db_session.exec(
        select(ImprovementAction).where(ImprovementAction.code == "IP-01")
    ).one()
    assert action.retest_ttx_id is None and action.retest_objective_id is None


def test_a_program_manager_links_it_from_the_organization_plan(
    client: TestClient,
    played: dict,  # noqa: F811
) -> None:
    source = played["ttx_id"]
    _with_action(client, source)
    later = _create_ttx(client, played["org_id"], "Later")
    plan = f"/api/v1/organizations/{played['org_id']}/improvement-plan"
    action_id = client.get(plan).json()["items"][0]["id"]

    candidates = client.get(f"{plan}/{action_id}/retest-candidates").json()
    assert [c["ttx_id"] for c in candidates] == [later["id"]]
    linked = client.put(
        f"{plan}/{action_id}/retest", json={"retest_ttx_id": later["id"]}, headers=_csrf(client)
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["retest"]["ttx_code"] == later["code"]
    unknown = client.put(
        f"{plan}/{uuid.uuid4()}/retest", json={"retest_ttx_id": None}, headers=_csrf(client)
    )
    assert unknown.status_code == 404
