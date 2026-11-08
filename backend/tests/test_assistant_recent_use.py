"""Platform -> AI assistant -> Recent use: the latest tool calls for the
instance administrator, never what was asked or answered."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.main import app
from tests.assistant_helpers import call, create_token
from tests.test_instance_tenancy import _make_admin, _register

CALLS = "/api/v1/instance/assistant/calls"


def test_the_administrator_sees_who_called_what_and_how_it_ended(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx = assistant_planner["ttx"]
    token = create_token(client, "Laptop")["token"]
    call(client, token, "get_exercise_overview", {"ttx_id": ttx["id"]})
    call(client, token, "get_knowledge_entry", {"id": "KB-XXX-999"})

    with TestClient(app) as admin:
        _register(admin, "ops@acme.com")
        _make_admin(db_session, "ops@acme.com")
        listed = admin.get(CALLS)
        mine = admin.get(CALLS, params={"user_id": listed.json()["callers"][0]["user_id"]})
        nobody = admin.get(CALLS, params={"user_id": "00000000-0000-0000-0000-000000000000"})

    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["retention_days"] == 90
    assert [c["email"] for c in body["callers"]] == ["planner@acme.com"]
    missing, overview = body["items"]  # newest first
    assert (overview["tool"], overview["outcome"]) == ("get_exercise_overview", "ok")
    assert (overview["ttx_code"], overview["ttx_name"]) == (ttx["code"], ttx["name"])
    assert overview["organization_name"] == "Acme"
    assert (overview["token_name"], overview["token_prefix"]) == ("Laptop", token[:9])
    assert (missing["outcome"], missing["ttx_id"]) == ("ASSISTANT_ENTRY_NOT_FOUND", None)
    assert token not in listed.text
    assert len(mine.json()["items"]) == 2
    assert nobody.json()["items"] == []


def test_only_the_instance_administrator_sees_it(
    client: TestClient, assistant_planner: dict
) -> None:
    assert client.get(CALLS).status_code == 403
