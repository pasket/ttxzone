"""GET /ttx/{ttx_id}/attention: what keeps each document from moving on,
counted for the Creator menu, without opening a document that isn't."""

from fastapi.testclient import TestClient

from tests.test_ttx_conduct_prep import _ready_msel
from tests.test_ttx_needs_form import _create_ttx, _manager, _to_approved


def test_blocking_issues_are_counted_for_the_documents_that_exist(
    client: TestClient, db_session
) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    url = f"/api/v1/ttx/{ttx['id']}/attention"

    fresh = client.get(url).json()
    assert fresh["needs_analysis"] > 0
    assert fresh["msel"] is None and fresh["session_plan"] is None
    # Reading it opens nothing.
    assert client.get(url).json()["msel"] is None

    _to_approved(client, ttx["id"])
    _ready_msel(client, ttx["id"])
    ready = client.get(url).json()
    assert ready["needs_analysis"] == 0
    assert ready["msel"] == 0
    assert ready["session_plan"] is None
