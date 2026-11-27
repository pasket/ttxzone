"""The organization's design context: written by its Program Manager in
Admin → Organization, read by its Planners' AI client."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import RoleEnum
from tests.assistant_helpers import call, create_token
from tests.test_assistant_tools import _data, _member
from tests.test_ttx_needs_form import _csrf


def test_the_context_is_saved_whole_and_the_assistant_reads_it(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    org_id = assistant_planner["owner"]["organization"]["id"]
    base = f"/api/v1/organizations/{org_id}/context"
    assert client.get(base).json() == {
        "sector": "", "size": "", "regulators": "", "technologies": "", "critical_assets": "",
    }  # fmt: skip
    token = create_token(client)["token"]
    empty = _data(call(client, token, "get_organization_profile", {"organization_id": org_id}))
    assert empty["note"] and empty["sector"] == ""

    saved = client.put(
        base,
        json={
            "sector": " Electricity distribution ",
            "size": "2,400 people, 3 countries",
            "regulators": "The national energy regulator; the data protection authority.",
            "technologies": "SCADA on a segregated OT network; a cloud office suite.",
            "critical_assets": "The control centre and its backup site.",
        },
        headers=_csrf(client),
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["sector"] == "Electricity distribution"
    # Saved whole: a field left out is cleared.
    again = client.put(base, json={"sector": "Electricity distribution"}, headers=_csrf(client))
    assert again.json()["size"] == ""
    unknown = client.put(base, json={"owner": "x"}, headers=_csrf(client))
    assert unknown.status_code == 422

    told = _data(call(client, token, "get_organization_profile", {"organization_id": org_id}))
    assert told["sector"] == "Electricity distribution" and told["note"] is None
    assert told["name"] == assistant_planner["owner"]["organization"]["name"]
    # Its PATCH never touches the context.
    client.patch(
        f"/api/v1/organizations/{org_id}", json={"description": "x"}, headers=_csrf(client)
    )
    assert client.get(base).json()["sector"] == "Electricity distribution"


def test_only_its_program_managers_and_planners_reach_it(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    org_id = assistant_planner["owner"]["organization"]["id"]
    player = _member(db_session, "player@acme.com", assistant_planner["ttx"]["id"], RoleEnum.PLAYER)

    refused = call(client, player, "get_organization_profile", {"organization_id": org_id})
    elsewhere = client.get(f"/api/v1/organizations/{uuid.uuid4()}/context")

    assert refused["isError"] is True
    assert elsewhere.status_code in (403, 404)
