"""The AI assistant's proposals to an organization: a new exercise and
Library injects, kept for their author and decided on the page."""

import json

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import AssistantOrgProposal, OrganizationMembership, OrgRoleEnum
from tests.assistant_helpers import call, create_token
from tests.test_ttx_needs_form import _csrf


def _data(result: dict) -> dict:
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


def _code(result: dict) -> str:
    assert result["isError"] is True, result
    return result["content"][0]["text"].split(":", 1)[0]


def _url(organization_id: str) -> str:
    return f"/api/v1/organizations/{organization_id}/assistant/proposals"


def test_a_new_exercise_is_proposed_accepted_and_recorded(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    organization_id = assistant_planner["owner"]["organization"]["id"]
    token = create_token(client)["token"]

    made = _data(
        call(
            client,
            token,
            "propose_new_exercise",
            {
                "organization_id": organization_id,
                "name": "Ransomware in the plant",
                "description": "Tests escalation to the crisis committee.",
                "content_language": "en",
                "summary": "Retests two overdue actions.",
            },
        )
    )

    [waiting] = client.get(_url(organization_id), params={"target": "new_exercise"}).json()["items"]
    assert waiting["id"] == made["proposal_id"]
    assert waiting["patch"] == {
        "name": "Ransomware in the plant",
        "description": "Tests escalation to the crisis committee.",
        "content_language": "en",
    }
    created = client.post(
        "/api/v1/ttx",
        json={**waiting["patch"], "organization_id": organization_id},
        headers=_csrf(client),
    )
    assert created.status_code == 201, created.text
    applied = client.post(
        f"{_url(organization_id)}/{waiting['id']}/applied",
        json={"row_id": created.json()["id"]},
        headers=_csrf(client),
    )
    assert applied.status_code == 200, applied.text
    assert applied.json()["status"] == "accepted"
    assert client.get(_url(organization_id)).json()["items"] == []
    again = client.post(f"{_url(organization_id)}/{waiting['id']}/discard", headers=_csrf(client))
    assert again.json()["error"]["code"] == "ASSISTANT_PROPOSAL_DECIDED"


def test_library_injects_are_proposed_by_a_program_manager_and_fit_the_form(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    organization_id = assistant_planner["owner"]["organization"]["id"]
    token = create_token(client)["token"]
    inject = {
        "title": "Ransom note on {system}",
        "content": "A note demands payment within 48 hours.",
        "expected_actions": [{"description": "Escalate to the crisis committee"}],
        "variable_defaults": {"system": "the ERP"},
    }

    made = _data(
        call(
            client,
            token,
            "propose_library_injects",
            {"organization_id": organization_id, "items": [inject], "summary": "Worked in TTX-1"},
        )
    )
    [waiting] = client.get(_url(organization_id)).json()["items"]
    assert made["proposals"] == [{"proposal_id": waiting["id"], "title": inject["title"]}]
    # The whole form, defaults included: the Library's own save takes it as it is.
    saved = client.post(
        f"/api/v1/organizations/{organization_id}/injects",
        json=waiting["patch"],
        headers=_csrf(client),
    )
    assert saved.status_code == 201, saved.text

    discarded = client.post(
        f"{_url(organization_id)}/{waiting['id']}/discard",
        json={"reason": "duplicate", "note": "We have this one."},
        headers=_csrf(client),
    )
    assert discarded.json()["status"] == "discarded"
    listed = _data(
        call(client, token, "list_organization_proposals", {"organization_id": organization_id})
    )
    assert listed["proposals"][0]["discard_note"] == "We have this one."

    invalid = call(
        client,
        token,
        "propose_library_injects",
        {"organization_id": organization_id, "items": [{"title": "x", "origin": "system"}]},
    )
    assert _code(invalid) == "INVALID_ARGUMENTS"

    # A Planner who isn't a Program Manager doesn't write the Library.
    manager = db_session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER
        )
    ).one()
    db_session.delete(manager)
    db_session.commit()
    refused = call(
        client,
        token,
        "propose_library_injects",
        {"organization_id": organization_id, "items": [inject]},
    )
    assert _code(refused) == "HTTP_403"
    assert len(db_session.exec(select(AssistantOrgProposal)).all()) == 1
