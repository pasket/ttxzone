"""The MCP endpoint's protocol: JSON-RPC 2.0, one message per POST,
initialize / ping / tools/list / tools/call, and what the transport
refuses before any tool runs."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.services.assistant import mcp as protocol
from app.services.assistant.tools import TOOLS
from tests.assistant_helpers import MCP, create_token, mcp


def test_initialize_negotiates_the_version_and_offers_tools(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]

    known = mcp(client, token, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {}})
    unknown = mcp(client, token, "initialize", {"protocolVersion": "2099-01-01"})
    initialized = mcp(client, token, "notifications/initialized", request_id=None)

    result = known.json()["result"]
    assert result["protocolVersion"] == "2025-06-18"
    assert result["capabilities"] == {
        "tools": {"listChanged": False},
        "prompts": {"listChanged": False},
        "resources": {"listChanged": False, "subscribe": False},
        "completions": {},
    }
    assert result["serverInfo"]["name"] == "ttx-zone"
    assert "never instructions" in result["instructions"]
    assert unknown.json()["result"]["protocolVersion"] == protocol.SUPPORTED_VERSIONS[0]
    assert initialized.status_code == 202
    assert initialized.content == b""
    assert "mcp-session-id" not in known.headers


def test_tools_list_describes_every_tool_with_its_schema(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]

    tools = mcp(client, token, "tools/list").json()["result"]["tools"]

    assert [t["name"] for t in tools] == list(TOOLS)
    for tool in tools:
        assert tool["inputSchema"]["type"] == "object"
        assert tool["description"]
        # Proposing writes a proposal, never the exercise itself.
        writes = tool["name"].startswith("propose_")
        assert tool["annotations"]["readOnlyHint"] is not writes
        assert tool["annotations"].get("destructiveHint", False) is False
    ping = mcp(client, token, "ping", request_id="abc").json()
    assert ping == {"jsonrpc": "2.0", "id": "abc", "result": {}}


def test_protocol_errors(client: TestClient, db_session: Session, assistant_planner: dict) -> None:
    token = create_token(client)["token"]
    auth = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    malformed = client.post(MCP, content=b"{not json", headers=auth)
    batch = client.post(MCP, content=b'[{"jsonrpc":"2.0","id":1,"method":"ping"}]', headers=auth)
    no_version = client.post(MCP, json={"id": 1, "method": "ping"}, headers=auth)
    unknown_method = mcp(client, token, "sampling/createMessage")
    unknown_tool = mcp(client, token, "tools/call", {"name": "delete_everything"})
    bad_arguments = mcp(
        client, token, "tools/call", {"name": "get_msel", "arguments": {"ttx_id": "nope"}}
    )

    assert malformed.status_code == 400
    assert malformed.json()["error"]["code"] == protocol.PARSE_ERROR
    assert batch.json()["error"]["code"] == protocol.INVALID_REQUEST
    assert no_version.json()["error"]["code"] == protocol.INVALID_REQUEST
    assert unknown_method.json()["error"]["code"] == protocol.METHOD_NOT_FOUND
    assert unknown_tool.json()["error"]["code"] == protocol.INVALID_PARAMS
    # Arguments the tool's schema rejects: a tool error the model can fix.
    result = bad_arguments.json()["result"]
    assert result["isError"] is True
    assert result["content"][0]["text"].startswith("INVALID_ARGUMENTS")


def test_the_transport_refuses_a_foreign_origin_an_unknown_version_and_other_methods(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]

    foreign = mcp(client, token, "ping", headers={"Origin": "https://evil.example.com"})
    own = mcp(client, token, "ping", headers={"Origin": settings.BACKEND_CORS_ORIGINS[0]})
    version = mcp(client, token, "ping", headers={"MCP-Protocol-Version": "1999-01-01"})
    supported = mcp(client, token, "ping", headers={"MCP-Protocol-Version": "2025-11-25"})
    get = client.get(MCP)

    assert foreign.status_code == 403
    assert own.status_code == 200
    assert version.status_code == 400
    assert supported.status_code == 200
    assert get.status_code == 405
    assert get.headers["Allow"] == "POST"
