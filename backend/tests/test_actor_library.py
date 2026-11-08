"""The simulated actor library: TTX-Zone's read-only catalog, each
organization's own actors (managed by Program Managers), and an
exercise's cast holding copies that remember their origin."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import (
    MselSimulatedActor,
    OrganizationActor,
    OrganizationMembership,
    OrgRoleEnum,
)
from tests.test_ttx_evaluation import _account, _enable_totp, _login
from tests.test_ttx_needs_form import (
    _create_ttx,
    _csrf,
    _manager,
    _to_approved,
)


def _open(client: TestClient, ttx_id: str) -> dict:
    response = client.get(f"/api/v1/ttx/{ttx_id}/msel")
    assert response.status_code == 200, response.text
    return response.json()


def _org_url(org_id: str, suffix: str = "") -> str:
    return f"/api/v1/organizations/{org_id}/actors{suffix}"


def _cast_url(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/actors{suffix}"


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    return {"ttx": ttx, "org_id": owner["organization"]["id"], "msel": _open(client, ttx["id"])}


# -- TTX-Zone's catalog ---------------------------------------------------------


def test_the_catalog_is_served_in_both_languages(client: TestClient, exercise: dict) -> None:
    items = client.get("/api/v1/actor-catalog").json()["items"]

    csirt = next(a for a in items if a["id"] == "national-csirt")
    assert (csirt["name_en"], csirt["name_es"], csirt["type"]) == (
        "National CSIRT",
        "CSIRT nacional",
        "csirt",
    )
    assert csirt["default"] is True
    assert {"cyber-insurer", "police-cybercrime", "data-protection-authority"} <= {
        a["id"] for a in items
    }


def test_the_catalog_holds_the_other_security_teams(client: TestClient, exercise: dict) -> None:
    items = {a["id"]: a for a in client.get("/api/v1/actor-catalog").json()["items"]}

    assert items["soc"]["channel"] == "ticket"
    for actor_id in ("soc-local", "soc-global", "soc-business-unit"):
        assert (items[actor_id]["type"], items[actor_id]["channel"]) == ("soc", "ticket")
    for actor_id in ("csirt-global", "csirt-local"):
        assert items[actor_id]["type"] == "csirt"
    assert items["csirt-local"]["name_es"] == "CSIRT local"
    # A team that usually plays is simulated only when it doesn't.
    assert "isn't playing" in items["cybersecurity-team-member"]["description_en"]
    member = items["cybersecurity-team-member"]
    assert (member["type"], member["channel"]) == ("internal", "security_tool")
    assert member["name_es"] == "Miembro del equipo de ciberseguridad"
    # The incident response retainer is the DFIR provider, not a second actor.
    assert items["dfir-provider"]["name_en"] == "Incident response provider (retainer)"
    assert not any("retainer" in actor_id for actor_id in items)
    assert not any(a["default"] for a in items.values() if a["id"].startswith(("soc-", "csirt-")))


def test_a_new_cast_is_made_of_copies_of_ttx_zone_actors(exercise: dict) -> None:
    soc = exercise["msel"]["actors"][0]

    assert (soc["name"], soc["origin"], soc["origin_id"]) == ("SOC", "system", "soc")
    assert soc["channel"] == "ticket"
    assert soc["description"].startswith("The security operations centre")


# -- organization library -------------------------------------------------------


def test_planners_manage_the_organization_library(client: TestClient, exercise: dict) -> None:
    org = exercise["org_id"]
    headers = _csrf(client)

    created = client.post(
        _org_url(org),
        json={
            "name": "Regional CERT",
            "type": "csirt",
            "description": "Our sector CERT.",
            "channel": "email",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    actor = created.json()
    assert (actor["origin"], actor["origin_id"]) == (None, None)

    # Duplicating a TTX-Zone actor: a copy that names its origin.
    duplicate = client.post(
        _org_url(org),
        json={
            "name": "Supervisor (copy)",
            "type": "authority",
            "origin": "system",
            "origin_id": "financial-supervisor",
        },
        headers=headers,
    )
    assert duplicate.json()["origin_id"] == "financial-supervisor"
    unknown = client.post(
        _org_url(org),
        json={"name": "Ghost", "origin": "system", "origin_id": "no-such-actor"},
        headers=headers,
    )
    assert unknown.status_code == 422
    assert unknown.json()["error"]["code"] == "UNKNOWN_SYSTEM_ACTOR"

    renamed = client.patch(
        _org_url(org, f"/{actor['id']}"),
        json={"name": "Sector CERT", "type": "csirt"},
        headers=headers,
    )
    assert renamed.json()["name"] == "Sector CERT"
    names = [a["name"] for a in client.get(_org_url(org)).json()["items"]]
    assert names == ["Sector CERT", "Supervisor (copy)"]

    deleted = client.delete(_org_url(org, f"/{actor['id']}"), headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["result"] == "deleted"
    assert [a["name"] for a in client.get(_org_url(org)).json()["items"]] == ["Supervisor (copy)"]


def test_program_managers_manage_it_too(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    org = owner["organization"]["id"]
    pm = _account(db_session, "pm@acme.com", "Pat Manager")
    db_session.add(
        OrganizationMembership(
            user_id=pm.id, organization_id=uuid.UUID(org), role=OrgRoleEnum.PROGRAM_MANAGER
        )
    )
    db_session.commit()
    _login(client, "pm@acme.com")
    _enable_totp(db_session, pm)

    response = client.post(_org_url(org), json={"name": "Board member"}, headers=_csrf(client))

    assert response.status_code == 201, response.text


def test_the_library_is_closed_to_players_and_other_organizations(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    other = _manager(client, db_session, "other@globex.com", "Globex")
    # `client` is now signed in as Globex's founder.
    response = client.get(_org_url(owner["organization"]["id"]))
    assert response.status_code == 403

    _account(db_session, "player@acme.com", "Pia Player")
    _login(client, "player@acme.com")
    assert client.get(_org_url(owner["organization"]["id"])).status_code == 403
    assert other["organization"]["id"] != owner["organization"]["id"]


def test_deleting_a_library_actor_keeps_the_exercises_copies(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    headers = _csrf(client)
    library = client.post(
        _org_url(exercise["org_id"]), json={"name": "Regulator X"}, headers=headers
    ).json()
    copy = client.post(
        _cast_url(exercise["ttx"]["id"]),
        json={"name": "Regulator X", "origin": "organization", "origin_id": library["id"]},
        headers=headers,
    )
    assert copy.status_code == 201, copy.text

    client.delete(_org_url(exercise["org_id"], f"/{library['id']}"), headers=headers)

    cast = _open(client, exercise["ttx"]["id"])["actors"]
    kept = next(a for a in cast if a["name"] == "Regulator X")
    assert (kept["origin"], kept["origin_id"]) == ("organization", library["id"])


# -- the exercise's cast, one actor at a time ------------------------------------


def test_the_cast_is_edited_one_actor_at_a_time(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    headers = _csrf(client)
    revision = exercise["msel"]["revision"]

    added = client.post(
        _cast_url(ttx_id),
        json={
            "name": "Cyber insurer",
            "type": "other",
            "channel": "phone",
            "origin": "system",
            "origin_id": "cyber-insurer",
            "played_by": "Controller 2",
        },
        headers=headers,
    )
    assert added.status_code == 201, added.text
    actor = added.json()
    assert actor["code"] == f"ACT-{len(exercise['msel']['actors']) + 1:02d}"

    updated = client.patch(
        _cast_url(ttx_id, f"/{actor['id']}"),
        json={"name": "Insurer", "type": "other", "origin": "system", "origin_id": "cyber-insurer"},
        headers=headers,
    )
    assert updated.json()["name"] == "Insurer"
    msel = _open(client, ttx_id)
    # Each write is an edit of the MSEL: an open MSEL page sees it as stale.
    assert msel["revision"] == revision + 2

    assert client.delete(_cast_url(ttx_id, f"/{actor['id']}"), headers=headers).status_code == 204
    assert "Insurer" not in [a["name"] for a in _open(client, ttx_id)["actors"]]


def test_an_actor_an_inject_uses_cannot_be_removed(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    from tests.msel_helpers import example_payload

    ttx_id = exercise["ttx"]["id"]
    saved = client.put(
        f"/api/v1/ttx/{ttx_id}/msel",
        json=example_payload(exercise["msel"]),
        headers=_csrf(client),
    )
    assert saved.status_code == 200, saved.text
    soc = next(a for a in saved.json()["actors"] if a["name"] == "SOC")

    response = client.delete(_cast_url(ttx_id, f"/{soc['id']}"), headers=_csrf(client))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ACTOR_IN_USE"
    assert db_session.exec(
        select(MselSimulatedActor).where(MselSimulatedActor.id == uuid.UUID(soc["id"]))
    ).first()


def test_the_cast_is_managed_before_the_needs_analysis_is_approved(
    client: TestClient, db_session: Session
) -> None:
    """Templates is independent of the needs analysis and the MSEL."""
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    headers = _csrf(client)

    # First use seeds TTX-Zone's defaults -- once.
    listed = client.get(_cast_url(ttx["id"])).json()["items"]
    assert [a["name"] for a in listed][:2] == ["SOC", "National CSIRT"]
    assert all(a["in_use"] is False for a in listed)
    assert len(client.get(_cast_url(ttx["id"])).json()["items"]) == len(listed)

    added = client.post(
        _cast_url(ttx["id"]),
        json={
            "name": "SOC_copy",
            "type": "soc",
            "origin": "exercise",
            "origin_id": listed[0]["id"],
            "origin_name": "SOC",
        },
        headers=headers,
    )
    assert added.status_code == 201, added.text
    assert added.json()["origin_name"] == "SOC"
    assert (
        client.delete(_cast_url(ttx["id"], f"/{listed[0]['id']}"), headers=headers).status_code
        == 204
    )

    # The MSEL, once it exists, uses that same cast (and keeps its codes).
    _to_approved(client, ttx["id"])
    cast = _open(client, ttx["id"])["actors"]
    names = [a["name"] for a in cast]
    assert "SOC_copy" in names and names.count("SOC") == 0
    assert cast[-1]["code"] == f"ACT-{len(listed) + 1 + 2:02d}"  # + the 2 NCCS actors


def test_deleting_the_organization_removes_its_library(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    org = owner["organization"]["id"]
    client.post(_org_url(org), json={"name": "Local press"}, headers=_csrf(client))

    response = client.request(
        "DELETE",
        f"/api/v1/organizations/{org}",
        json={"confirmation": "Acme"},
        headers=_csrf(client),
    )

    assert response.status_code == 204, response.text
    assert db_session.exec(select(OrganizationActor)).all() == []
