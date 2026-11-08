import asyncio
import json

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.exceptions import AppException
from app.main import app_exception_handler, http_exception_handler, validation_exception_handler


def _build_request(path: str = "/", method: str = "GET") -> Request:
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [],
        "client": ("testclient", 123),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


def test_app_exception_handler_uses_exception_fields() -> None:
    exc = AppException(
        code="SOME_CODE", message="Something broke", status_code=418, ttx_id="abc-123"
    )
    response = asyncio.run(app_exception_handler(_build_request(), exc))

    assert response.status_code == 418
    assert json.loads(response.body) == {
        "success": False,
        "error": {"code": "SOME_CODE", "message": "Something broke", "ttx_id": "abc-123"},
    }


def test_validation_exception_handler_returns_generic_422() -> None:
    exc = RequestValidationError(errors=[])
    response = asyncio.run(validation_exception_handler(_build_request(), exc))

    assert response.status_code == 422
    assert json.loads(response.body) == {
        "success": False,
        "error": {"code": "VALIDATION_ERROR", "message": "Invalid request data.", "ttx_id": None},
    }


def test_http_exception_handler_maps_known_status_to_slug() -> None:
    exc = HTTPException(status_code=403, detail="Forbidden here")
    response = asyncio.run(http_exception_handler(_build_request(), exc))

    assert response.status_code == 403
    assert json.loads(response.body) == {
        "success": False,
        "error": {"code": "FORBIDDEN", "message": "Forbidden here", "ttx_id": None},
    }


def test_http_exception_handler_falls_back_to_generic_slug() -> None:
    exc = HTTPException(status_code=402, detail="Payment required")
    response = asyncio.run(http_exception_handler(_build_request(), exc))

    assert json.loads(response.body)["error"]["code"] == "HTTP_ERROR"


def test_unmatched_route_returns_unified_404_via_real_app(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {
        "success": False,
        "error": {"code": "NOT_FOUND", "message": "Not Found", "ttx_id": None},
    }
