"""The inject library beyond TTX-Zone's catalog: each organization's own
injects (managed by Program Managers) and single injects added
to or removed from an exercise's MSEL, copies that remember their origin."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import OrganizationMembership, OrgRoleEnum
from tests.msel_helpers import example_payload
from tests.test_actor_library import _open
from tests.test_ttx_evaluation import _account, _enable_totp, _login
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager, _to_approved


def _org_url(org_id: str, suffix: str = "") -> str:
    return f"/api/v1/organizations/{org_id}/injects{suffix}"


def _msel_url(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/msel{suffix}"


TEMPLATE = {
    "language": "en",
    "title": "Ransom note with a countdown",
    "content": "The {attacker_group} group demands {ransom_amount} within 72 hours.",
    "kind": "mandatory",
    "actor_name": "Attacker (sender)",
    "actor_type": "threat_actor",
    "actor_origin": "system",
    "actor_origin_id": "threat-actor",
    "delivery_method": "document",
    "recipients": ["Crisis Committee"],
    "expected_actions": [
        {"description": "Reports to the police", "responsible_role": "Legal", "within_minutes": 240}
    ],
    "key_question": "Do we open the attacker's chat?",
    "families": ["ransomware"],
    "stage": "escalation",
    "audience": "mixed",
    "capabilities": ["crisis_decision_making"],
    "attack": [{"domain": "enterprise", "tactic_id": "TA0040", "technique_id": "T1486"}],
    "variable_defaults": {"attacker_group": "Nebula", "ransom_amount": "USD 4.5 million"},
    "origin": "system",
    "origin_id": "INJ-RAN-02",
    "origin_name": "Ransom note with a countdown",
}


@pytest.fixture
def exercise(client: TestClient, db_session: Session) -> dict:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    _to_approved(client, ttx["id"])
    msel = _open(client, ttx["id"])
    saved = client.put(_msel_url(ttx["id"]), json=example_payload(msel), headers=_csrf(client))
    assert saved.status_code == 200, saved.text
    return {"ttx": ttx, "org_id": owner["organization"]["id"], "msel": saved.json()}


# -- organization library -------------------------------------------------------


def test_planners_manage_the_organization_library(client: TestClient, exercise: dict) -> None:
    org = exercise["org_id"]
    headers = _csrf(client)

    created = client.post(_org_url(org), json=TEMPLATE, headers=headers)
    assert created.status_code == 201, created.text
    inject = created.json()
    assert (inject["origin"], inject["origin_id"]) == ("system", "INJ-RAN-02")
    assert inject["attack"][0]["technique_name"] == "Data Encrypted for Impact"
    assert inject["variable_defaults"]["ransom_amount"] == "USD 4.5 million"
    assert inject["language"] == "en"

    own = client.post(
        _org_url(org),
        json={"title": "Board asks for a briefing", "stage": "response"},
        headers=headers,
    )
    assert own.status_code == 201, own.text
    assert (own.json()["origin"], own.json()["families"]) == (None, [])
    # Not stated: only injects saved before the language was recorded.
    assert own.json()["language"] is None

    unsupported = client.post(_org_url(org), json={**TEMPLATE, "language": "fr"}, headers=headers)
    assert unsupported.status_code == 422

    renamed = client.patch(
        _org_url(org, f"/{inject['id']}"),
        json={**TEMPLATE, "title": "Ransom note (our version)"},
        headers=headers,
    )
    assert renamed.json()["title"] == "Ransom note (our version)"
    titles = [i["title"] for i in client.get(_org_url(org)).json()["items"]]
    assert titles == ["Board asks for a briefing", "Ransom note (our version)"]

    deleted = client.delete(_org_url(org, f"/{inject['id']}"), headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["result"] == "deleted"
    assert [i["title"] for i in client.get(_org_url(org)).json()["items"]] == [
        "Board asks for a briefing"
    ]


@pytest.mark.parametrize(
    ("change", "code"),
    [
        ({"origin_id": "INJ-XXX-99"}, "UNKNOWN_SYSTEM_INJECT"),
        ({"actor_origin_id": "no-such-actor"}, "UNKNOWN_SYSTEM_ACTOR"),
        (
            {"attack": [{"domain": "enterprise", "tactic_id": "TA0001", "technique_id": "T1486"}]},
            "UNKNOWN_ATTACK_TECHNIQUE",
        ),
    ],
)
def test_a_template_must_name_what_exists(
    client: TestClient, exercise: dict, change: dict, code: str
) -> None:
    response = client.post(
        _org_url(exercise["org_id"]), json={**TEMPLATE, **change}, headers=_csrf(client)
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == code


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

    response = client.post(_org_url(org), json={"title": "Press call"}, headers=_csrf(client))

    assert response.status_code == 201, response.text


def test_the_library_is_closed_to_players_and_other_organizations(
    client: TestClient, db_session: Session
) -> None:
    owner = _manager(client, db_session, "owner@acme.com", "Acme")
    _manager(client, db_session, "other@globex.com", "Globex")
    assert client.get(_org_url(owner["organization"]["id"])).status_code == 403

    _account(db_session, "player@acme.com", "Pia Player")
    _login(client, "player@acme.com")
    assert client.get(_org_url(owner["organization"]["id"])).status_code == 403


# -- the exercise's MSEL, one inject at a time ------------------------------------


def _copy_payload(msel: dict, **extra) -> dict:
    return {
        "phase_id": msel["phases"][1]["id"],
        "objective_ids": [msel["needs"]["objectives"][0]["id"]],
        "offset_minutes": 50,
        "kind": "mandatory",
        "title": "Ransom note with a countdown",
        "content": "The Nebula group demands USD 4.5 million within 72 hours.",
        "sender": {
            "name": "Attacker (sender)",
            "type": "threat_actor",
            "origin": "system",
            "origin_id": "threat-actor",
        },
        "recipients": ["Crisis Committee"],
        "delivery_method": "document",
        "attack_techniques": [
            {"domain": "enterprise", "tactic_id": "TA0040", "technique_id": "T1486"},
            # Not under that tactic in the MSEL's release: left out.
            {"domain": "enterprise", "tactic_id": "TA0001", "technique_id": "T1486"},
        ],
        "facilitator_notes": "Key question: do we open the attacker's chat?",
        "expected_actions": [
            {
                "description": "Reports to the police",
                "responsible_role": "Crisis Committee",
                "expected_within_minutes": 12,
            }
        ],
        "origin": "system",
        "origin_id": "INJ-RAN-02",
        "origin_name": "Ransom note with a countdown",
        **extra,
    }


def test_a_library_inject_is_copied_into_the_msel(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    before = exercise["msel"]

    response = client.post(
        _msel_url(ttx_id, "/injects"), json=_copy_payload(before), headers=_csrf(client)
    )

    assert response.status_code == 201, response.text
    msel = response.json()["msel"]
    assert msel["revision"] == before["revision"] + 1
    copy = msel["injects"][-1]
    assert (
        copy["code"]
        # One series for every inject: the next after all of them.
        == f"INJ-{len(before['injects']) + 1:02d}"
    )
    assert (copy["origin"], copy["origin_id"]) == ("system", "INJ-RAN-02")
    assert copy["phase_id"] == before["phases"][1]["id"]
    assert [t["technique_id"] for t in copy["attack_techniques"]] == ["T1486"]
    # A template says nothing about attribution: the scenario's first actor.
    assert copy["attack_attribution"] == "threat_actor"
    assert copy["threat_actor_id"] == msel["threat_actors"][0]["id"]
    assert copy["expected_actions"][0]["code"] == f"{copy['code']}-A1"
    # The sender was already in the cast (by name): reused, not added.
    threat = [a for a in msel["actors"] if a["name"] == "Attacker (sender)"]
    assert len(threat) == 1 and copy["simulated_actor_id"] == threat[0]["id"]
    assert len(msel["actors"]) == len(before["actors"])


def test_a_poll_goes_through_the_library_without_its_meters(
    client: TestClient, exercise: dict
) -> None:
    org_id, ttx_id = exercise["org_id"], exercise["ttx"]["id"]
    poll = {
        "format": "poll",
        "poll_question": "Pay?",
        "poll_options": ["Yes", "No"],
        "poll_outcomes": ["They come back."],
    }
    saved = client.post(
        _org_url(org_id),
        json={**TEMPLATE, **poll},
        headers=_csrf(client),
    )
    assert saved.status_code == 201, saved.text
    body = saved.json()
    assert body["format"] == "poll" and body["poll_outcomes"] == ["They come back.", ""]
    assert body["expected_actions"] == []

    copied = client.post(
        _msel_url(ttx_id, "/injects"),
        json=_copy_payload(exercise["msel"], **poll),
        headers=_csrf(client),
    )
    assert copied.status_code == 201, copied.text
    inject = copied.json()["msel"]["injects"][-1]
    assert inject["code"].startswith("POL-")
    assert inject["poll_options"] == ["Yes", "No"] and inject["poll_impacts"] == []
    assert inject["objective_ids"] == [] and inject["expected_actions"] == []


def test_a_ttx_zone_inject_brings_its_illustration_in_the_copys_language(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    from app.services import msel_image_service

    ttx_id = exercise["ttx"]["id"]
    spanish = client.post(
        _msel_url(ttx_id, "/injects"),
        json=_copy_payload(exercise["msel"], language="es"),
        headers=_csrf(client),
    ).json()["msel"]
    copy = spanish["injects"][-1]
    assert [i["caption"] for i in copy["images"]] == [
        "Nota de rescate ficticia en las pantallas cifradas"
    ]
    image = copy["images"][0]
    assert (image["width"], image["height"]) == (1280, 720)
    served = client.get(_msel_url(ttx_id, f"/images/{image['id']}"))
    assert served.status_code == 200 and served.headers["content-type"] == "image/png"
    assert len(list(msel_image_service.MSEL_IMAGE_DIR.iterdir())) == 1

    # Copied from the organization's library: no illustration comes along.
    own = client.post(
        _msel_url(ttx_id, "/injects"),
        json=_copy_payload(spanish, origin="organization", origin_id=str(uuid.uuid4())),
        headers=_csrf(client),
    )
    assert own.status_code == 201, own.text
    assert own.json()["msel"]["injects"][-1]["images"] == []


def test_a_copy_can_be_noise_or_another_actor(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    headers = _csrf(client)

    noise = client.post(
        _msel_url(ttx_id, "/injects"),
        json=_copy_payload(exercise["msel"], attack_attribution="noise"),
        headers=headers,
    ).json()["msel"]["injects"][-1]
    assert (noise["attack_attribution"], noise["threat_actor_id"]) == ("noise", None)

    elsewhere = client.post(
        _msel_url(ttx_id, "/injects"),
        json=_copy_payload(
            exercise["msel"],
            attack_attribution="threat_actor",
            threat_actor_id="00000000-0000-0000-0000-000000000000",
        ),
        headers=headers,
    )
    assert elsewhere.status_code == 404


def test_a_new_sender_joins_the_cast(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    before = exercise["msel"]
    sender = {
        "name": "Cyber insurer",
        "type": "other",
        "origin": "system",
        "origin_id": "cyber-insurer",
    }

    msel = client.post(
        _msel_url(ttx_id, "/injects"),
        json=_copy_payload(before, sender=sender),
        headers=_csrf(client),
    ).json()["msel"]

    insurer = next(a for a in msel["actors"] if a["origin_id"] == "cyber-insurer")
    assert msel["injects"][-1]["simulated_actor_id"] == insurer["id"]
    assert len(msel["actors"]) == len(before["actors"]) + 1


def test_a_copy_names_only_what_the_exercise_has(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    msel = exercise["msel"]
    headers = _csrf(client)

    foreign_phase = client.post(
        _msel_url(ttx_id, "/injects"),
        json=_copy_payload(msel, phase_id=str(uuid.uuid4())),
        headers=headers,
    )
    unknown_objective = client.post(
        _msel_url(ttx_id, "/injects"),
        json=_copy_payload(msel, objective_ids=[str(uuid.uuid4())]),
        headers=headers,
    )

    assert foreign_phase.status_code == 404
    assert unknown_objective.json()["error"]["code"] == "UNKNOWN_OBJECTIVE"


def test_an_msel_inject_is_removed(client: TestClient, exercise: dict) -> None:
    ttx_id = exercise["ttx"]["id"]
    victim = exercise["msel"]["injects"][0]

    response = client.delete(_msel_url(ttx_id, f"/injects/{victim['id']}"), headers=_csrf(client))

    assert response.status_code == 204
    msel = _open(client, ttx_id)
    assert victim["id"] not in {i["id"] for i in msel["injects"]}
    assert msel["revision"] == exercise["msel"]["revision"] + 1


def test_the_msel_must_be_editable(client: TestClient, db_session: Session) -> None:
    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])

    response = client.delete(
        _msel_url(ttx["id"], f"/injects/{uuid.uuid4()}"), headers=_csrf(client)
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "MSEL_NOT_FOUND"


def test_deleting_the_organization_takes_its_library(
    client: TestClient, db_session: Session, exercise: dict
) -> None:
    org = exercise["org_id"]
    client.post(_org_url(org), json=TEMPLATE, headers=_csrf(client))

    from sqlmodel import select

    from app.models import OrganizationInject, User
    from app.services.organization_service import delete_organization

    owner = db_session.exec(select(User).where(User.email == "planner@acme.com")).one()
    delete_organization(db_session, uuid.UUID(org), owner.id)

    assert db_session.query(OrganizationInject).count() == 0
