"""MCP prompts, resources and completion: guided flows for the client's
menu, an exercise's documents to attach, and suggestions for their
arguments -- each read through its tool, with its guard and record."""

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.data.knowledge_catalog import load_knowledge_catalog
from app.models import AssistantCall, RoleEnum
from app.services.assistant import mcp_extras
from app.services.assistant.tools import TOOLS
from tests.assistant_helpers import create_token, mcp
from tests.test_assistant_tools import _member
from tests.test_ttx_needs_form import _to_approved


def _result(response) -> dict:
    assert response.status_code == 200, response.text
    body = response.json()
    assert "error" not in body, body
    return body["result"]


def _error(response) -> dict:
    assert response.status_code == 200, response.text
    return response.json()["error"]


def test_initialize_offers_prompts_resources_and_completion(
    client: TestClient, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]
    capabilities = _result(mcp(client, token, "initialize", {"protocolVersion": "2025-06-18"}))[
        "capabilities"
    ]
    assert set(capabilities) == {"tools", "prompts", "resources", "completions"}
    # Every resource reads through a tool, with its guard.
    assert all(kind.tool in TOOLS for kind in mcp_extras.RESOURCE_KINDS)


def test_an_exercises_documents_are_listed_and_read_through_their_tools(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx = assistant_planner["ttx"]
    _to_approved(client, ttx["id"])
    assert client.get(f"/api/v1/ttx/{ttx['id']}/msel").status_code == 200  # opens it
    token = create_token(client)["token"]

    templates = _result(mcp(client, token, "resources/templates/list"))["resourceTemplates"]
    assert {t["uriTemplate"] for t in templates} == {k.template for k in mcp_extras.RESOURCE_KINDS}
    listed = _result(mcp(client, token, "resources/list"))["resources"]
    uris = {r["uri"] for r in listed}
    needs_uri = f"ttx-zone://exercise/{ttx['id']}/needs-analysis"
    assert needs_uri in uris and f"ttx-zone://exercise/{ttx['id']}/msel" in uris
    assert any(r["name"].startswith(ttx["code"]) for r in listed)

    [content] = _result(mcp(client, token, "resources/read", {"uri": needs_uri}))["contents"]
    assert content["mimeType"] == "text/markdown"
    # The Markdown export, TLP label first.
    assert content["text"].startswith("**TLP:") and "# Needs analysis" in content["text"]
    recorded = db_session.exec(select(AssistantCall).order_by(AssistantCall.created_at)).all()
    assert recorded[-1].tool == "resource:needs-analysis"
    assert str(recorded[-1].ttx_id) == ttx["id"]

    entry = load_knowledge_catalog().entries[0]
    [kb] = _result(
        mcp(client, token, "resources/read", {"uri": f"ttx-zone://knowledge/{entry.id}"})
    )["contents"]
    assert entry.id in kb["text"]
    [scenario] = _result(
        mcp(client, token, "resources/read", {"uri": "ttx-zone://scenario/ransomware"})
    )["contents"]
    assert "how_to_use" in scenario["text"]

    unknown = _error(mcp(client, token, "resources/read", {"uri": "ttx-zone://nowhere/1"}))
    assert unknown["code"] == mcp_extras_not_found()


def mcp_extras_not_found() -> int:
    from app.services.assistant.mcp import RESOURCE_NOT_FOUND

    return RESOURCE_NOT_FOUND


def test_a_resource_takes_its_tools_guard(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx = assistant_planner["ttx"]
    player = _member(db_session, "player@acme.com", ttx["id"], RoleEnum.PLAYER)
    refused = _error(
        mcp(
            client,
            player,
            "resources/read",
            {"uri": f"ttx-zone://exercise/{ttx['id']}/needs-analysis"},
        )
    )
    assert refused["data"]["code"] == "TTX_ACCESS_DENIED"
    # Only the guides, which read nothing of anyone's.
    listed = _result(mcp(client, player, "resources/list"))["resources"]
    assert {r["uri"] for r in listed} == {f"ttx-zone://guide/{g}" for g in mcp_extras.GUIDES}


def test_prompts_are_listed_and_filled_with_the_exercise(
    client: TestClient, assistant_planner: dict
) -> None:
    ttx = assistant_planner["ttx"]
    token = create_token(client)["token"]
    prompts = _result(mcp(client, token, "prompts/list"))["prompts"]
    assert {p["name"] for p in prompts} == set(mcp_extras.PROMPTS)
    assert all(p["arguments"][0]["name"] == "exercise" for p in prompts)

    got = _result(
        mcp(
            client,
            token,
            "prompts/get",
            {"name": "build_msel", "arguments": {"exercise": ttx["code"]}},
        )
    )
    [message] = got["messages"]
    text = message["content"]["text"]
    assert message["role"] == "user"
    assert ttx["id"] in text and "propose_phases" in text and "never decide" in text

    review = _result(
        mcp(
            client,
            token,
            "prompts/get",
            {
                "name": "review_before_ready",
                "arguments": {"exercise": ttx["id"], "document": "msel"},
            },
        )
    )
    assert "its msel" in review["messages"][0]["content"]["text"]

    missing = _error(mcp(client, token, "prompts/get", {"name": "build_msel", "arguments": {}}))
    assert missing["code"] == -32602
    nobody = _error(
        mcp(client, token, "prompts/get", {"name": "build_msel", "arguments": {"exercise": "ZZZ"}})
    )
    assert nobody["code"] == -32602
    unknown = _error(mcp(client, token, "prompts/get", {"name": "nope", "arguments": {}}))
    assert unknown["code"] == -32602


def test_completion_suggests_exercises_and_ids(client: TestClient, assistant_planner: dict) -> None:
    ttx = assistant_planner["ttx"]
    token = create_token(client)["token"]

    def complete(name: str, value: str) -> list[str]:
        return _result(
            mcp(
                client,
                token,
                "completion/complete",
                {
                    "ref": {"type": "ref/prompt", "name": "build_msel"},
                    "argument": {"name": name, "value": value},
                },
            )
        )["completion"]["values"]

    assert complete("exercise", ttx["code"][:4]) == [ttx["code"]]
    assert complete("ttx_id", "") == [ttx["id"]]
    assert complete("document", "ms") == ["msel"]
    assert all(v.startswith("KB-") for v in complete("entry_id", "kb-cas"))
    assert "ransomware" in complete("scenario_id", "ransom")
    assert complete("unknown", "x") == []
