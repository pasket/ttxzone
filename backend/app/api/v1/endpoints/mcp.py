"""The MCP endpoint (docs/features/ai-assistant.md): an AI client reads
TTX-Zone as the person whose personal access token it sends. Only a token
authenticates here -- a session cookie never does -- and a token
authenticates nothing else. Every answer is JSON-RPC, outside the app's
{"success": false} error envelope."""

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlmodel import Session
from starlette.concurrency import run_in_threadpool

from app.core.db import get_session
from app.core.exceptions import AppException
from app.services.assistant import mcp, tokens

router = APIRouter(prefix="/mcp", tags=["assistant"])


def _send(result: mcp.McpResponse) -> Response:
    if result.body is None:
        return Response(status_code=result.status, headers=result.headers)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post("")
async def mcp_endpoint(request: Request, session: Session = Depends(get_session)) -> Response:
    """The AI assistant's MCP endpoint: JSON-RPC, with a personal access token."""
    headers = {k.lower(): v for k, v in request.headers.items()}
    body = await request.body()
    # The database work is synchronous: off the event loop.
    return _send(await run_in_threadpool(_process, session, headers, request.url.path, body))


def _process(session: Session, headers: dict[str, str], path: str, body: bytes) -> mcp.McpResponse:
    refused = mcp.check_transport(headers)
    if refused is not None:
        return refused
    try:
        user, token = tokens.authenticate(session, headers.get("authorization"), path)
    except AppException as exc:
        session.rollback()
        return mcp.auth_failure(exc)
    return mcp.handle(session, user, token, body)


@router.api_route("", methods=["GET", "DELETE", "PUT", "PATCH"], include_in_schema=False)
def mcp_other_methods() -> Response:
    """No server-sent stream and no sessions to end: only POST."""
    return Response(status_code=405, headers={"Allow": "POST"})
