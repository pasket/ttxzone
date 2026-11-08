"""The threat actor library: MITRE ATT&CK's groups as TTX-Zone's read-only
catalog, and each organization's own threat actors (MITRE groups copied and
narrowed, or profiles of its own) for Program Managers and Exercise
Planners."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.data.attack_catalog import LATEST_ATTACK_VERSION, group_replacement, load_groups
from app.models import OrganizationThreatActor
from tests.test_ttx_evaluation import _account, _login
from tests.test_ttx_needs_form import _csrf, _manager


def _org_url(org_id: str, suffix: str = "") -> str:
    return f"/api/v1/organizations/{org_id}/threat-actors{suffix}"


def _apt28(**overrides) -> dict:
    return {
        "name": "APT28",
        "mitre_group_id": "G0007",
        "aliases": ["Fancy Bear", "Sofacy"],
        "description": "Targets our sector's ministries.",
        "attack_version": LATEST_ATTACK_VERSION,
        "techniques": [
            {"domain": "enterprise", "technique_id": "T1566.001"},
            {"domain": "enterprise", "technique_id": "T1566.001"},
            {"domain": "enterprise", "technique_id": "T1071"},
        ],
        "origin": "system",
        "origin_id": "G0007",
        "origin_name": "APT28",
        **overrides,
    }


# -- the catalog --------------------------------------------------------------------


def test_groups_merge_both_domains_and_follow_revocations() -> None:
    groups = load_groups(LATEST_ATTACK_VERSION)

    sandworm = groups["G0034"]
    assert sandworm.name == "Sandworm Team"
    assert "ELECTRUM" in sandworm.aliases
    domains = {domain for domain, _ in sandworm.techniques}
    assert domains == {"enterprise", "ics"}
    # A revoked group stands for MITRE's replacement.
    assert group_replacement(LATEST_ATTACK_VERSION, "G0042") == "G0040"
    assert group_replacement(LATEST_ATTACK_VERSION, "G9999") is None


def test_the_catalog_serves_mitre_groups(client: TestClient, db_session: Session) -> None:
    _manager(client, db_session, "planner@acme.com", "Acme")

    body = client.get("/api/v1/threat-actor-catalog").json()

    assert body["attack_version"] == LATEST_ATTACK_VERSION
    assert "The MITRE Corporation" in body["copyright"]
    apt28 = next(g for g in body["items"] if g["id"] == "G0007")
    assert apt28["name"] == "APT28"
    assert "Fancy Bear" in apt28["aliases"]
    assert {"domain": "enterprise", "technique_id": "T1566.001"} in apt28["techniques"]
    # Deprecated groups are left out.
    assert not {"G0014", "G0015"} & {g["id"] for g in body["items"]}


def test_the_catalog_needs_a_session(client: TestClient) -> None:
    assert client.get("/api/v1/threat-actor-catalog").status_code == 401


# -- the organization's library -----------------------------------------------------


def test_planners_manage_the_organization_library(client: TestClient, db_session: Session) -> None:
    org = _manager(client, db_session, "planner@acme.com", "Acme")["organization"]["id"]
    headers = _csrf(client)

    created = client.post(_org_url(org), json=_apt28(), headers=headers)
    assert created.status_code == 201, created.text
    actor = created.json()
    assert (actor["mitre_group_id"], actor["origin"], actor["origin_id"]) == (
        "G0007",
        "system",
        "G0007",
    )
    # Duplicates collapse; names and tactics come from the release.
    phishing, c2 = actor["techniques"]
    assert phishing["technique_name"] == "Phishing: Spearphishing Attachment"
    assert phishing["tactic_ids"] == ["TA0001"]
    assert c2["technique_id"] == "T1071"

    # An actor of the organization's own: no MITRE id, no techniques yet.
    unknown = client.post(
        _org_url(org),
        json={"name": "Unknown actor A", "attack_version": LATEST_ATTACK_VERSION},
        headers=headers,
    )
    assert unknown.status_code == 201, unknown.text
    assert (unknown.json()["mitre_group_id"], unknown.json()["techniques"]) == (None, [])

    narrowed = client.patch(
        _org_url(org, f"/{actor['id']}"),
        json=_apt28(techniques=[{"domain": "enterprise", "technique_id": "T1071"}]),
        headers=headers,
    )
    assert [t["technique_id"] for t in narrowed.json()["techniques"]] == ["T1071"]
    names = [a["name"] for a in client.get(_org_url(org)).json()["items"]]
    assert names == ["APT28", "Unknown actor A"]

    deleted = client.delete(_org_url(org, f"/{actor['id']}"), headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["result"] == "deleted"
    assert [a["name"] for a in client.get(_org_url(org)).json()["items"]] == ["Unknown actor A"]


def test_it_only_references_what_the_release_holds(client: TestClient, db_session: Session) -> None:
    org = _manager(client, db_session, "planner@acme.com", "Acme")["organization"]["id"]
    headers = _csrf(client)

    cases = {
        "UNKNOWN_ATTACK_VERSION": _apt28(attack_version="1.0"),
        "UNKNOWN_ATTACK_GROUP": _apt28(mitre_group_id="G9999"),
        "UNKNOWN_ATTACK_TECHNIQUE": _apt28(
            techniques=[{"domain": "enterprise", "technique_id": "T9999"}]
        ),
    }
    for code, payload in cases.items():
        response = client.post(_org_url(org), json=payload, headers=headers)
        assert response.status_code == 422, code
        assert response.json()["error"]["code"] == code
    # A deprecated group can't be copied either.
    deprecated = client.post(_org_url(org), json=_apt28(mitre_group_id="G0014"), headers=headers)
    assert deprecated.json()["error"]["code"] == "UNKNOWN_ATTACK_GROUP"
    # Malformed ids never reach the service.
    malformed = client.post(_org_url(org), json=_apt28(mitre_group_id="APT28"), headers=headers)
    assert malformed.status_code == 422


def test_the_library_is_closed_to_players_and_other_organizations(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    _manager(client, db_session, "other@globex.com", "Globex")
    # `client` is now signed in as Globex's founder.
    assert client.get(_org_url(owner["organization"]["id"])).status_code == 403

    _account(db_session, "player@acme.com", "Pia Player")
    _login(client, "player@acme.com")
    assert client.get(_org_url(owner["organization"]["id"])).status_code == 403


def test_deleting_the_organization_removes_its_threat_actors(
    client: TestClient, db_session: Session
) -> None:
    org = _manager(client, db_session, "planner@acme.com", "Acme")["organization"]["id"]
    headers = _csrf(client)
    client.post(_org_url(org), json=_apt28(), headers=headers)

    response = client.request(
        "DELETE", f"/api/v1/organizations/{org}", json={"confirmation": "Acme"}, headers=headers
    )

    assert response.status_code == 204, response.text
    rows = db_session.exec(
        select(OrganizationThreatActor).where(
            OrganizationThreatActor.organization_id == uuid.UUID(org)
        )
    ).all()
    assert rows == []
