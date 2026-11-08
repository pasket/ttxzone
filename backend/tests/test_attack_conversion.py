"""Moving ATT&CK references across releases: copies from the libraries
into an MSEL pinned to another release, a group that release doesn't
have, and the organization's library brought up to the latest release.
Uses the fake v99.0 of test_ttx_msel (`next_release`)."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.msel_helpers import example_payload
from tests.test_inject_library import TEMPLATE, _copy_payload
from tests.test_ttx_msel import _open, _put, _url
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager, _to_approved


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    return {"ttx": ttx, "org_id": owner["organization"]["id"], "msel": _open(client, ttx["id"])}


def _ids(items: list[dict]) -> list[str]:
    return [t["technique_id"] for t in items]


def test_a_profile_is_moved_onto_another_release(
    client: TestClient, exercise, next_release
) -> None:
    response = client.post(
        "/api/v1/attack/99.0/threat-actor",
        json={
            "mitre_group_id": "G0007",
            "techniques": [
                {"domain": "enterprise", "technique_id": "T1566"},
                {"domain": "enterprise", "technique_id": "T1490"},
                {"domain": "enterprise", "technique_id": "T1486"},
            ],
        },
        headers=_csrf(client),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["mitre_group_id"] == "G0007"
    assert _ids(body["techniques"]) == ["T1566.001", "T1486"]
    assert body["conversion"] == {
        "replaced": [{"from_id": "T1566", "to_id": "T1566.001"}],
        "removed": ["T1490"],
    }


def test_a_group_the_release_lacks_becomes_an_unknown_actor(
    client: TestClient, exercise, next_release
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _put(client, ttx_id, example_payload(exercise["msel"]))

    # The catalog shows v99; this MSEL is still pinned to v19.2.
    added = client.post(
        _url(ttx_id, "/threat-actors"),
        json={
            "name": "Newcomer",
            "mitre_group_id": "G9998",
            "attack_version": "99.0",
            "techniques": [{"domain": "enterprise", "technique_id": "T1486"}],
            "origin": "system",
            "origin_id": "G9998",
            "origin_name": "Newcomer",
        },
        headers=_csrf(client),
    )

    assert added.status_code == 201, added.text
    body = added.json()
    assert (body["actor"]["name"], body["actor"]["mitre_group_id"]) == ("Newcomer", None)
    assert _ids(body["actor"]["techniques"]) == ["T1486"]
    assert body["conversion"]["removed"] == ["G9998"]


def test_a_library_inject_is_moved_onto_the_msels_release(
    client: TestClient, exercise, next_release
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _put(client, ttx_id, example_payload(exercise["msel"]))
    upgraded = client.post(_url(ttx_id, "/attack-upgrade"), headers=_csrf(client))
    assert upgraded.json()["msel"]["attack_version"] == "99.0"

    # A v19.2 template naming T1566 (revoked in v99) and T1490 (deprecated).
    response = client.post(
        _url(ttx_id, "/injects"),
        json=_copy_payload(
            upgraded.json()["msel"],
            attack_techniques=[
                {"domain": "enterprise", "tactic_id": "TA0001", "technique_id": "T1566"},
                {"domain": "enterprise", "tactic_id": "TA0040", "technique_id": "T1490"},
            ],
        ),
        headers=_csrf(client),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert _ids(body["msel"]["injects"][-1]["attack_techniques"]) == ["T1566.001"]
    assert body["conversion"] == {
        "replaced": [{"from_id": "T1566", "to_id": "T1566.001"}],
        "removed": ["T1490"],
    }


def test_the_organizations_library_moves_to_the_latest_release(
    client: TestClient, exercise, next_release
) -> None:
    org = exercise["org_id"]
    headers = _csrf(client)
    actor = client.post(
        f"/api/v1/organizations/{org}/threat-actors",
        json={
            "name": "OilRig",
            "mitre_group_id": "G0049",
            "attack_version": "19.2",
            "techniques": [
                {"domain": "enterprise", "technique_id": "T1566"},
                {"domain": "enterprise", "technique_id": "T1490"},
            ],
        },
        headers=headers,
    )
    assert actor.status_code == 201, actor.text
    inject = client.post(
        f"/api/v1/organizations/{org}/injects",
        json={
            **TEMPLATE,
            "attack_version": "19.2",
            "attack": [{"domain": "enterprise", "tactic_id": "TA0001", "technique_id": "T1566"}],
        },
        headers=headers,
    )
    assert inject.status_code == 201, inject.text

    actors = client.post(
        f"/api/v1/organizations/{org}/threat-actors/attack-upgrade", headers=headers
    ).json()
    assert (actors["attack_version"], actors["upgraded"]) == ("99.0", 1)
    assert actors["conversion"]["removed"] == ["T1490", "G0049"]
    moved = client.get(f"/api/v1/organizations/{org}/threat-actors").json()["items"][0]
    assert (moved["attack_version"], moved["mitre_group_id"]) == ("99.0", None)
    assert _ids(moved["techniques"]) == ["T1566.001"]

    injects = client.post(
        f"/api/v1/organizations/{org}/injects/attack-upgrade", headers=headers
    ).json()
    assert (injects["upgraded"], injects["conversion"]["replaced"]) == (
        1,
        [{"from_id": "T1566", "to_id": "T1566.001"}],
    )
    # Nothing left to move: a second run changes nothing.
    again = client.post(
        f"/api/v1/organizations/{org}/injects/attack-upgrade", headers=headers
    ).json()
    assert again["upgraded"] == 0
