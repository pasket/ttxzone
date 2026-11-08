"""Explicit-organization URLs for tests.

Admin routes always take the organization in the path
(/api/v1/organizations/{organization_id}/...) -- the server never infers
which org a Program Manager means. Most tests act as the Program Manager of the
single org they just signed up; `org_base(client)` returns that org's
base URL, looked up the same way the frontend does (/organizations/mine).
"""

from fastapi.testclient import TestClient


def org_base(client: TestClient) -> str:
    orgs = client.get("/api/v1/organizations/mine").json()["items"]
    managed = [org for org in orgs if org["is_program_manager"]]
    assert len(managed) == 1, f"expected exactly one Program Manager org, got {len(managed)}"
    return f"/api/v1/organizations/{managed[0]['organization_id']}"
