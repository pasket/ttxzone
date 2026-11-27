"""Asking the AI assistant from a design page: a request waits until the
person's own client reads it, and proposals that name it answer it."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import AssistantProposal, AssistantRequest, RoleEnum
from tests.assistant_helpers import call, create_token
from tests.test_assistant_proposals import _approved_with_msel, _list
from tests.test_assistant_tools import _data, _error_code, _member
from tests.test_ttx_needs_form import _csrf


def _base(ttx_id: str) -> str:
    return f"/api/v1/ttx/{ttx_id}/assistant/requests"


def test_a_request_waits_until_proposals_answer_it(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    msel = _approved_with_msel(client, ttx_id)
    inject = msel["injects"][0]

    made_up = client.post(
        _base(ttx_id),
        json={"section": "msel", "row_id": str(uuid.uuid4()), "note": "Sharper"},
        headers=_csrf(client),
    )
    assert made_up.status_code == 404
    assert made_up.json()["error"]["code"] == "ASSISTANT_REQUEST_ROW_NOT_FOUND"
    blank = client.post(
        _base(ttx_id), json={"section": "msel", "note": "  "}, headers=_csrf(client)
    )
    assert blank.status_code == 422

    asked = client.post(
        _base(ttx_id),
        json={
            "section": "msel",
            "row_id": inject["id"],
            "note": " Make this read like a real SOC alert. ",
        },
        headers=_csrf(client),
    )
    assert asked.status_code == 201, asked.text
    request = asked.json()
    assert request["row_code"] == inject["code"] and request["status"] == "open"
    assert request["note"] == "Make this read like a real SOC alert."
    whole = client.post(
        _base(ttx_id), json={"section": "needs", "note": "Two more risks"}, headers=_csrf(client)
    ).json()
    assert whole["row_code"] is None

    token = create_token(client)["token"]
    told = _data(call(client, token, "list_requests", {"ttx_id": ttx_id}))
    assert [(r["document"], r["row"], r["note"]) for r in told["requests"]] == [
        ("MSEL", inject["code"], "Make this read like a real SOC alert."),
        ("needs analysis", None, "Two more risks"),
    ]

    # A request that isn't theirs refuses the proposal before it's kept.
    stray = call(
        client,
        token,
        "propose_injects",
        {
            "ttx_id": ttx_id,
            "request_id": str(uuid.uuid4()),
            "items": [{"code": inject["code"], "title": "EDR: mass file renames"}],
        },
    )
    assert _error_code(stray) == "ASSISTANT_REQUEST_NOT_FOUND"
    assert _list(client, ttx_id) == []
    # A dry run answers nothing.
    args = {
        "ttx_id": ttx_id,
        "request_id": request["id"],
        "items": [{"code": inject["code"], "title": "EDR: mass file renames"}],
    }
    assert "answers_request" not in _data(
        call(client, token, "propose_injects", {**args, "dry_run": True})
    )
    answer = _data(call(client, token, "propose_injects", args))
    assert answer["answers_request"] == request["id"]

    [proposal] = _list(client, ttx_id)
    assert proposal["request_id"] == request["id"]
    assert [r["id"] for r in client.get(_base(ttx_id)).json()["items"]] == [whole["id"]]
    [answered] = client.get(_base(ttx_id) + "?status=answered").json()["items"]
    assert answered["id"] == request["id"] and answered["answered_at"]
    left = _data(call(client, token, "list_requests", {"ttx_id": ttx_id}))
    assert [r["request_id"] for r in left["requests"]] == [whole["id"]]

    gone = client.delete(f"{_base(ttx_id)}/{whole['id']}", headers=_csrf(client))
    assert gone.status_code == 204
    assert client.get(_base(ttx_id)).json()["items"] == []


def test_requests_are_the_persons_own_and_leave_with_the_exercise(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    asked = client.post(
        _base(ttx_id), json={"section": "needs", "note": "A sharper scope"}, headers=_csrf(client)
    ).json()
    player = _member(db_session, "player@acme.com", ttx_id, RoleEnum.PLAYER)

    refused = call(client, player, "list_requests", {"ttx_id": ttx_id})
    assert _error_code(refused) == "TTX_ACCESS_DENIED"

    deleted = client.request(
        "DELETE",
        f"/api/v1/ttx/{ttx_id}",
        json={"confirmation": assistant_planner["ttx"]["name"]},
        headers=_csrf(client),
    )
    assert deleted.status_code in (200, 204), deleted.text
    db_session.expire_all()
    assert db_session.get(AssistantRequest, uuid.UUID(asked["id"])) is None
    assert db_session.exec(select(AssistantProposal)).all() == []


def test_asking_needs_the_assistant_on(
    client: TestClient, db_session: Session, assistant_planner: dict, monkeypatch
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "ASSISTANT_ENABLED", False)
    ttx_id = assistant_planner["ttx"]["id"]

    off = client.post(_base(ttx_id), json={"section": "needs", "note": "x"}, headers=_csrf(client))

    assert off.status_code == 409 and off.json()["error"]["code"] == "ASSISTANT_DISABLED"
