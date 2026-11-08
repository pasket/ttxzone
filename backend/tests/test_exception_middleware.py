import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middlewares.exception_mw import GlobalExceptionMiddleware


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(GlobalExceptionMiddleware)

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("kaboom - should never reach the client")

    return app


def test_global_exception_middleware_returns_generic_500() -> None:
    client = TestClient(_build_app())
    response = client.get("/boom")

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred. Please try again later.",
            "ttx_id": None,
        },
    }


def test_global_exception_middleware_hides_internal_details() -> None:
    client = TestClient(_build_app())
    response = client.get("/boom")

    assert "kaboom" not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text


def test_global_exception_middleware_logs_full_trace(caplog) -> None:
    with caplog.at_level(logging.ERROR, logger="app.middlewares.exception_mw"):
        TestClient(_build_app()).get("/boom")

    assert any("Unhandled exception" in record.message for record in caplog.records)
    assert any(record.exc_info for record in caplog.records)
