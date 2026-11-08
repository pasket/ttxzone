"""Deleting an organization library item that something still uses: it is
disabled instead (and can't be copied again), and deleted for good only
once nothing uses it -- that last step after a recent sign-in."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import PlatformAuditEvent, User, UserSession
from tests.msel_helpers import example_payload
from tests.test_actor_library import _open
from tests.test_inject_library import TEMPLATE, _copy_payload
from tests.test_threat_actor_library import _apt28
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager, _to_approved


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    msel = _open(client, ttx["id"])
    saved = client.put(
        f"/api/v1/ttx/{ttx['id']}/msel", json=example_payload(msel), headers=_csrf(client)
    )
    assert saved.status_code == 200, saved.text
    return {"ttx": ttx, "org_id": owner["organization"]["id"], "msel": saved.json()}


def _library(org_id: str, kind: str) -> str:
    return f"/api/v1/organizations/{org_id}/{kind}"


def _listed(client: TestClient, org_id: str, kind: str, item_id: str) -> dict:
    items = client.get(_library(org_id, kind)).json()["items"]
    return next(i for i in items if i["id"] == item_id)


def _stale_sign_in(db_session: Session, email: str) -> None:
    user = db_session.exec(select(User).where(User.email == email)).one()
    for user_session in db_session.exec(select(UserSession).where(UserSession.user_id == user.id)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()


def test_an_actor_in_a_cast_is_disabled_then_deleted_once_free(
    client: TestClient, exercise: dict
) -> None:
    org, ttx_id = exercise["org_id"], exercise["ttx"]["id"]
    headers = _csrf(client)
    actor = client.post(
        _library(org, "actors"), json={"name": "Regulator X", "type": "other"}, headers=headers
    ).json()
    copy_payload = {
        "name": "Regulator X",
        "type": "other",
        "origin": "organization",
        "origin_id": actor["id"],
        "origin_name": "Regulator X",
    }
    copy = client.post(f"/api/v1/ttx/{ttx_id}/actors", json=copy_payload, headers=headers).json()

    assert _listed(client, org, "actors", actor["id"])["usage_count"] == 1
    usage = client.get(_library(org, f"actors/{actor['id']}/usage")).json()
    assert [(e["ttx_id"], e["copies"]) for e in usage["exercises"]] == [(ttx_id, 1)]
    assert usage["total"] == 1

    disabled = client.delete(_library(org, f"actors/{actor['id']}"), headers=headers)
    assert disabled.status_code == 200, disabled.text
    assert disabled.json()["result"] == "disabled"
    assert _listed(client, org, "actors", actor["id"])["disabled_at"] is not None

    # A disabled item can't be copied again.
    again = client.post(f"/api/v1/ttx/{ttx_id}/actors", json=copy_payload, headers=headers)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "LIBRARY_ITEM_DISABLED"

    # Re-enabled: usable again.
    enabled = client.post(_library(org, f"actors/{actor['id']}/enable"), headers=headers)
    assert enabled.status_code == 200
    assert enabled.json()["disabled_at"] is None
    client.delete(_library(org, f"actors/{actor['id']}"), headers=headers)

    # The exercise drops its copy: nothing uses it, so it goes for good.
    client.delete(f"/api/v1/ttx/{ttx_id}/actors/{copy['id']}", headers=headers)
    deleted = client.delete(_library(org, f"actors/{actor['id']}"), headers=headers)
    assert deleted.json()["result"] == "deleted"
    assert actor["id"] not in [i["id"] for i in client.get(_library(org, "actors")).json()["items"]]


def test_an_actor_sending_a_library_inject_is_in_use(client: TestClient, exercise: dict) -> None:
    org = exercise["org_id"]
    headers = _csrf(client)
    actor = client.post(
        _library(org, "actors"), json={"name": "Journalist", "type": "other"}, headers=headers
    ).json()
    inject = client.post(
        _library(org, "injects"),
        json={
            **TEMPLATE,
            "actor_name": "Journalist",
            "actor_origin": "organization",
            "actor_origin_id": actor["id"],
        },
        headers=headers,
    ).json()

    result = client.delete(_library(org, f"actors/{actor['id']}"), headers=headers).json()

    assert result["result"] == "disabled"
    assert result["usage"]["injects"] == [{"id": inject["id"], "title": inject["title"]}]


def test_a_threat_actor_in_a_scenario_is_disabled(client: TestClient, exercise: dict) -> None:
    org, ttx_id = exercise["org_id"], exercise["ttx"]["id"]
    headers = _csrf(client)
    actor = client.post(_library(org, "threat-actors"), json=_apt28(), headers=headers).json()
    copy = _apt28(origin="organization", origin_id=actor["id"])
    # Make room: the example MSEL may already hold the maximum.
    msel = _open(client, ttx_id)
    for existing in msel["threat_actors"][1:]:
        client.delete(f"/api/v1/ttx/{ttx_id}/msel/threat-actors/{existing['id']}", headers=headers)
    added = client.post(f"/api/v1/ttx/{ttx_id}/msel/threat-actors", json=copy, headers=headers)
    assert added.status_code == 201, added.text

    result = client.delete(_library(org, f"threat-actors/{actor['id']}"), headers=headers).json()

    assert result["result"] == "disabled"
    assert result["usage"]["exercises"][0]["ttx_id"] == ttx_id
    refused = client.post(f"/api/v1/ttx/{ttx_id}/msel/threat-actors", json=copy, headers=headers)
    assert refused.json()["error"]["code"] == "LIBRARY_ITEM_DISABLED"


def test_an_inject_copied_into_an_msel_is_disabled(client: TestClient, exercise: dict) -> None:
    org, ttx_id = exercise["org_id"], exercise["ttx"]["id"]
    headers = _csrf(client)
    template = client.post(_library(org, "injects"), json=TEMPLATE, headers=headers).json()
    payload = _copy_payload(exercise["msel"], origin="organization", origin_id=template["id"])
    added = client.post(f"/api/v1/ttx/{ttx_id}/msel/injects", json=payload, headers=headers)
    assert added.status_code == 201, added.text

    result = client.delete(_library(org, f"injects/{template['id']}"), headers=headers).json()

    assert result["result"] == "disabled"
    assert _listed(client, org, "injects", template["id"])["usage_count"] == 1
    refused = client.post(f"/api/v1/ttx/{ttx_id}/msel/injects", json=payload, headers=headers)
    assert refused.json()["error"]["code"] == "LIBRARY_ITEM_DISABLED"


def test_a_tag_copied_into_an_exercise_is_disabled(client: TestClient, exercise: dict) -> None:
    org, ttx_id = exercise["org_id"], exercise["ttx"]["id"]
    headers = _csrf(client)
    tag = client.post(
        _library(org, "tags"), json={"name": "Pilot", "color": "sand"}, headers=headers
    ).json()
    copy = {
        "name": "Pilot",
        "color": "sand",
        "origin": "organization",
        "origin_id": tag["id"],
        "origin_name": "Pilot",
    }
    assert client.post(f"/api/v1/ttx/{ttx_id}/tags", json=copy, headers=headers).status_code == 201

    result = client.delete(_library(org, f"tags/{tag['id']}"), headers=headers).json()

    assert result["result"] == "disabled"
    assert _listed(client, org, "tags", tag["id"])["usage_count"] == 1
    refused = client.post(f"/api/v1/ttx/{ttx_id}/tags", json=copy, headers=headers)
    assert refused.json()["error"]["code"] == "LIBRARY_ITEM_DISABLED"


def test_deleting_for_good_needs_a_recent_sign_in(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    org, ttx_id = exercise["org_id"], exercise["ttx"]["id"]
    headers = _csrf(client)
    free = client.post(
        _library(org, "actors"), json={"name": "Free", "type": "other"}, headers=headers
    ).json()
    used = client.post(
        _library(org, "actors"), json={"name": "Used", "type": "other"}, headers=headers
    ).json()
    client.post(
        f"/api/v1/ttx/{ttx_id}/actors",
        json={"name": "Used", "type": "other", "origin": "organization", "origin_id": used["id"]},
        headers=headers,
    )
    _stale_sign_in(db_session, "planner@acme.com")

    # No step-up either way: deleting for good is audited.
    deleted = client.delete(_library(org, f"actors/{free['id']}"), headers=headers)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["result"] == "deleted"
    event = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "library.item_delete")
    ).one()
    assert event.details and event.details["kind"] == "actor"
    disabled = client.delete(_library(org, f"actors/{used['id']}"), headers=headers)
    assert disabled.json()["result"] == "disabled"


def test_usage_is_scoped_to_the_organizations_library(client: TestClient, exercise: dict) -> None:
    org = exercise["org_id"]
    for kind in ("actors", "threat-actors", "injects", "tags"):
        missing = client.get(_library(org, f"{kind}/{uuid.uuid4()}/usage"))
        assert missing.status_code == 404, kind
        enable = client.post(_library(org, f"{kind}/{uuid.uuid4()}/enable"), headers=_csrf(client))
        assert enable.status_code == 404, kind
