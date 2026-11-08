"""TTX-Zone's inject catalog: the read-only first level of the inject
library. The data file is validated on load, so these tests are also the
catalog's integrity check."""

import copy
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError
from sqlmodel import Session

from app.data.actor_catalog import ACTOR_CATALOG_BY_ID
from app.data.attack_catalog import LATEST_ATTACK_VERSION
from app.data.inject_catalog import (
    _FILE,
    FAMILY_CODES,
    IMAGE_DIR,
    InjectCatalog,
    InjectFamily,
    load_inject_catalog,
)
from tests.test_ttx_evaluation import _account, _login


def _raw() -> dict:
    return json.loads(_FILE.read_text())


def _broken(mutate) -> None:
    raw = copy.deepcopy(_raw())
    mutate(raw["injects"])
    with pytest.raises(ValidationError):
        InjectCatalog.model_validate(raw)


def _by_id(injects: list[dict], code: str) -> dict:
    return next(i for i in injects if i["id"] == code)


# -- integrity ------------------------------------------------------------------


def test_the_catalog_loads_and_covers_every_family() -> None:
    catalog = load_inject_catalog()

    assert len(catalog.injects) >= 60
    assert {f for i in catalog.injects for f in i.families} == set(InjectFamily)
    assert set(FAMILY_CODES) == set(InjectFamily)


def test_codes_follow_the_first_family_and_are_unique() -> None:
    catalog = load_inject_catalog()

    for inject in catalog.injects:
        assert inject.id.split("-")[1] == FAMILY_CODES[inject.families[0]]
    assert len({i.id for i in catalog.injects}) == len(catalog.injects)


def test_every_sender_is_a_ttx_zone_actor() -> None:
    assert {i.actor for i in load_inject_catalog().injects} <= set(ACTOR_CATALOG_BY_ID)


def test_contingent_injects_point_to_a_mandatory_one_of_their_family() -> None:
    catalog = load_inject_catalog()
    by_id = {i.id: i for i in catalog.injects}
    contingents = [i for i in catalog.injects if i.contingent_for]

    assert contingents
    for inject in contingents:
        parent = by_id[inject.contingent_for]
        assert parent.kind == "mandatory"
        assert parent.families == inject.families
        assert inject.id.startswith(parent.id.rsplit("-", 1)[0] + "-C")


def test_executive_and_mixed_injects_ask_a_key_question() -> None:
    for inject in load_inject_catalog().injects:
        if inject.audience != "technical":
            assert inject.key_question, inject.id


def test_scenario_variables_carry_a_default() -> None:
    ransom = next(i for i in load_inject_catalog().injects if i.id == "INJ-RAN-02")

    assert "{ransom_amount}" in ransom.content.es
    assert ransom.variable_defaults["ransom_amount"].en == "USD 4.5 million"
    assert "data_type" in ransom.variables and "data_type" not in ransom.variable_defaults


@pytest.mark.parametrize(
    "mutate",
    [
        # Code doesn't match the first family.
        lambda items: _by_id(items, "INJ-RAN-01").update(families=["ddos"]),
        # Tactic that isn't one of the technique's.
        lambda items: _by_id(items, "INJ-RAN-01")["attack"][0].update(tactic="TA0001"),
        # Unknown sender.
        lambda items: _by_id(items, "INJ-RAN-01").update(actor="nobody"),
        # A variable in the text that `variables` doesn't list.
        lambda items: _by_id(items, "INJ-RAN-01")["content"].update(es="{location} ¡"),
        # A scenario variable with no default.
        lambda items: _by_id(items, "INJ-RAN-02")["variable_defaults"].pop("ransom_amount"),
        # A contingent inject pointing nowhere.
        lambda items: _by_id(items, "INJ-RAN-C01").update(contingent_for="INJ-RAN-99"),
        # Duplicate code.
        lambda items: items.append(copy.deepcopy(items[0])),
    ],
)
def test_a_broken_catalog_is_rejected(mutate) -> None:
    _broken(mutate)


# -- API ------------------------------------------------------------------------


def test_the_catalog_is_served_with_attack_names(client: TestClient, db_session: Session) -> None:
    _account(db_session, "player@example.com")
    _login(client, "player@example.com")

    response = client.get("/api/v1/inject-catalog")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["attack_version"] == "19.2"
    ransom = next(i for i in body["items"] if i["id"] == "INJ-RAN-01")
    assert ransom["title"] == {
        "es": "Cifrado masivo de madrugada",
        "en": "Mass encryption in the early hours",
    }
    assert ransom["attack"][0] == {
        "domain": "enterprise",
        "tactic_id": "TA0040",
        "tactic_name": "Impact",
        "technique_id": "T1486",
        "technique_name": "Data Encrypted for Impact",
    }
    assert ransom["facilitator_notes"]["es"].startswith("Si nadie escala")


def test_the_catalog_needs_a_session(client: TestClient) -> None:
    assert client.get("/api/v1/inject-catalog").status_code == 401


def test_the_new_actors_are_in_the_actor_catalog(client: TestClient, db_session: Session) -> None:
    _account(db_session, "player@example.com")
    _login(client, "player@example.com")

    ids = {a["id"] for a in client.get("/api/v1/actor-catalog").json()["items"]}

    assert {
        "dfir-provider",
        "threat-intel-provider",
        "bank",
        "security-researcher",
        "board-chair",
    } <= ids


def test_the_catalog_is_written_against_the_latest_attack_release() -> None:
    """Importing a new ATT&CK release means reviewing this catalog: its
    techniques may be revoked, deprecated or moved to another tactic. Bump
    its `attack_version` once reviewed (see scripts/import_attack.py)."""
    assert load_inject_catalog().attack_version == LATEST_ATTACK_VERSION


# -- illustrations ------------------------------------------------------------------


def test_every_illustration_is_a_small_fictitious_image_in_both_languages() -> None:
    illustrated = [i for i in load_inject_catalog().injects if i.images]
    assert len(illustrated) >= 10  # a demo: a few injects, not all
    used: set[str] = set()
    for inject in illustrated:
        for image in inject.images:
            # The caption says it's made up, in both languages.
            assert "ficti" in image.caption.es.lower() and "ficti" in image.caption.en.lower()
            for language in ("en", "es"):
                path = image.path(language)
                used.add(path.name)
                with Image.open(path) as picture:
                    picture.verify()
                with Image.open(path) as picture:
                    assert picture.format == "PNG"
                    assert max(picture.size) <= 2000, path.name
    # Every rendered file is used, and every mock-up has its source.
    assert used == {p.name for p in IMAGE_DIR.glob("*.png")}
    sources = {p.stem for p in (IMAGE_DIR / "src").glob("*.html")}
    assert {name.rsplit("-", 1)[0] for name in used} == sources


def test_an_illustration_must_exist(tmp_path) -> None:
    def mutate(injects):
        injects[0]["images"] = [
            {
                "file": {"es": "missing-es.png", "en": "missing-en.png"},
                "caption": {"es": "x", "en": "x"},
            }
        ]

    _broken(mutate)


def test_the_catalog_serves_its_illustrations(client: TestClient, db_session: Session) -> None:
    _account(db_session, "player@example.com")
    _login(client, "player@example.com")

    items = client.get("/api/v1/inject-catalog").json()["items"]
    note = next(i for i in items if i["id"] == "INJ-RAN-02")
    assert note["images"] == [
        {
            "index": 0,
            "caption": {
                "es": "Nota de rescate ficticia en las pantallas cifradas",
                "en": "Fictitious ransom note on the encrypted screens",
            },
            "width": 1280,
            "height": 720,
        }
    ]
    assert "file" not in json.dumps(note["images"])
    english = client.get("/api/v1/inject-catalog/INJ-RAN-02/images/0")
    spanish = client.get("/api/v1/inject-catalog/INJ-RAN-02/images/0?lang=es")
    assert english.status_code == spanish.status_code == 200
    assert english.headers["content-type"] == "image/png"
    assert english.headers["x-content-type-options"] == "nosniff"
    assert english.content != spanish.content
    assert client.get("/api/v1/inject-catalog/INJ-RAN-02/images/1").status_code == 404
    assert client.get("/api/v1/inject-catalog/INJ-BEC-01/images/0").status_code == 404
    assert client.get("/api/v1/inject-catalog/../images/0").status_code == 404
