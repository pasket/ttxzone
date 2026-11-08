from fastapi.testclient import TestClient

from app.core.middleware import API_CONTENT_SECURITY_POLICY


def test_api_responses_carry_the_baseline_headers_and_a_deny_all_csp(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Content-Security-Policy"] == API_CONTENT_SECURITY_POLICY
    assert "default-src 'none'" in API_CONTENT_SECURITY_POLICY


def test_error_responses_carry_the_csp_too(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.headers["Content-Security-Policy"] == API_CONTENT_SECURITY_POLICY


def test_the_interactive_docs_keep_working(client: TestClient) -> None:
    response = client.get("/docs")
    assert response.status_code == 200
    assert "Content-Security-Policy" not in response.headers
