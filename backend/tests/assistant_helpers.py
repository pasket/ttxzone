"""Shared by the AI assistant's tests: the switch, tokens and MCP calls."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import INSTANCE_SETTINGS_ID, InstanceSettings
from app.services.assistant.switch import ASSISTANT_DISCLAIMER_VERSION
from tests.test_ttx_needs_form import _csrf

MCP = "/api/v1/mcp"
TOKENS = "/api/v1/auth/tokens"


def enable_assistant(db_session: Session, enabled: bool = True) -> None:
    row = db_session.get(InstanceSettings, INSTANCE_SETTINGS_ID) or InstanceSettings(
        id=INSTANCE_SETTINGS_ID
    )
    row.assistant_enabled = enabled
    db_session.add(row)
    db_session.commit()


def create_token(client: TestClient, name: str = "Claude Desktop", **extra) -> dict:
    response = client.post(
        TOKENS,
        json={
            "name": name,
            "expires_in_days": 30,
            "acknowledge": True,
            "disclaimer_version": ASSISTANT_DISCLAIMER_VERSION,
            **extra,
        },
        headers=_csrf(client),
    )
    assert response.status_code == 201, response.text
    return response.json()


def mcp(
    client: TestClient,
    token: str | None,
    method: str,
    params: dict | None = None,
    *,
    request_id: int | None = 1,
    headers: dict | None = None,
):
    body: dict = {"jsonrpc": "2.0", "method": method}
    if request_id is not None:
        body["id"] = request_id
    if params is not None:
        body["params"] = params
    sent = dict(headers or {})
    if token is not None:
        sent["Authorization"] = f"Bearer {token}"
    return client.post(MCP, json=body, headers=sent)


def call(client: TestClient, token: str, tool: str, arguments: dict | None = None) -> dict:
    response = mcp(client, token, "tools/call", {"name": tool, "arguments": arguments or {}})
    assert response.status_code == 200, response.text
    return response.json()["result"]
