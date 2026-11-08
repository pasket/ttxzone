"""TTX-Zone's knowledge base: generic background for the AI assistant. The
entries are validated on load, so these tests are also the catalog's
integrity check -- plus the anonymization rules a regex can enforce."""

import re

import pytest
from pydantic import ValidationError

from app.data.attack_catalog import LATEST_ATTACK_VERSION, load_groups
from app.data.knowledge_catalog import (
    _DIR,
    SECTIONS,
    KnowledgeCatalog,
    KnowledgeEntryError,
    KnowledgeKind,
    group_names,
    load_knowledge_catalog,
    parse_entry,
)


def _text(code: str) -> str:
    return next(_DIR.glob(f"*/{code}.kb.md")).read_text()


def _broken(code: str, old: str, new: str) -> None:
    text = _text(code)
    assert old in text, old
    with pytest.raises((ValidationError, KnowledgeEntryError)):
        parse_entry(text.replace(old, new, 1))


# -- integrity ------------------------------------------------------------------


def test_the_catalog_loads_and_covers_every_kind() -> None:
    catalog = load_knowledge_catalog()

    assert {entry.kind for entry in catalog.entries} == set(KnowledgeKind)
    assert set(SECTIONS) == set(KnowledgeKind)


def test_every_section_reads_on_its_own() -> None:
    """Each section is one retrieval chunk: it must carry real content."""
    for entry in load_knowledge_catalog().entries:
        for section in entry.sections:
            assert len(section.text) >= 80, (entry.id, section.heading)


@pytest.mark.parametrize(
    ("code", "old", "new"),
    [
        # Code doesn't match the kind.
        ("KB-TRD-001", 'id: "KB-TRD-001"', 'id: "KB-CAS-001"'),
        # A section missing, renamed or out of order.
        ("KB-TRD-001", "## Realistic timings", "## Timings"),
        ("KB-CAS-001", "## Impacts", "## Impact"),
        # A technique this release revoked, a group it doesn't have.
        ("KB-TRD-001", '"enterprise:T1685"', '"enterprise:T1562.001"'),
        ("KB-CAS-001", '"G0035"', '"G9999"'),
        # Not fictitious: a real-looking email, URL or IP; an absolute date.
        ("KB-ART-001", "To the management", "Write to ceo@acme.com. To the management"),
        ("KB-ART-001", "To the management", "See https://leaks.onion.ly. To the management"),
        ("KB-CAS-001", "a fleet of", "10.20.30.40 and a fleet of"),
        ("KB-CAS-001", "**Day 0, early morning", "**29 December, early morning"),
        # A variable the front matter doesn't declare; one with no default.
        ("KB-ART-001", "To the management of", "{product} -- to the management of"),
        ("KB-ART-001", '"leak_portal": "a fictitious hidden-service address"', '"x_y": "z"'),
        # Variables, stage or sender outside an artifact; an artifact without them.
        ("KB-TRD-001", "## Overview\n", "## Overview\n{organization} "),
        ("KB-TRD-001", 'period: "2025"', 'period: "2025"\nactor: "threat-actor"'),
        ("KB-ART-001", 'actor: "threat-actor"\n', ""),
        ("KB-ART-001", 'actor: "threat-actor"', 'actor: "nobody"'),
        # Not English; front matter that isn't JSON; text before the first section.
        ("KB-TRD-001", 'language: "en"', 'language: "es"'),
        ("KB-TRD-001", 'kind: "trend"', "kind: trend"),
        ("KB-TRD-001", "\n## Overview", "Stray text.\n## Overview"),
        # A threat entry without families; unknown frameworks or requirements; a
        # framework entry naming none; an objective with no requirement.
        ("KB-TRD-001", 'families: ["ransomware", "data_breach"]', "families: []"),
        ("KB-FRM-001", 'frameworks: ["NIS2"]', 'frameworks: ["NIS9"]'),
        ("KB-FRM-001", 'frameworks: ["NIS2"]', "frameworks: []"),
        ("KB-OBJ-001", '"NIS2-21-2-F", ', '"NIS2-99", '),
        ("KB-OBJ-002", 'requirements: ["NIS2-23", "DORA-19"]', "requirements: []"),
        ("KB-GLS-001", "## Common confusions", "## Confusions"),
    ],
)
def test_a_broken_entry_is_rejected(code: str, old: str, new: str) -> None:
    _broken(code, old, new)


@pytest.mark.parametrize(
    ("code", "old", "new"),
    [
        ("KB-ART-001", 'related: ["KB-TRD-001"]', 'related: ["KB-TRD-999"]'),
        ("KB-TRD-001", "(INJ-RAN-03)", "(INJ-RAN-99)"),
        ("KB-TRD-001", "(INJ-RAN-03)", "(KB-ART-999)"),
    ],
)
def test_references_must_exist(code: str, old: str, new: str) -> None:
    entries = [e for e in load_knowledge_catalog().entries if e.id != code]
    entries.append(parse_entry(_text(code).replace(old, new, 1)))

    with pytest.raises(ValidationError):
        KnowledgeCatalog(entries=entries)


# -- anonymization ----------------------------------------------------------------

# Who publishes threat reports, and who makes the products incidents name: the
# knowledge base names neither -- its sources stay generic (`source_class`).
_FORBIDDEN_NAMES = (
    "Accenture|Allianz|Check Point|Cisco|Cloudflare|CrowdStrike|Deloitte|Dragos|ENISA|"
    "ESET|Fortinet|FortiGate|Google|Hitachi|IBM|Kaspersky|Mandiant|Microsoft|Mikronika|"
    "Moxa|Palo Alto|PwC|Rapid7|SANS|Schneider|Siemens|SonicWall|Sophos|Splunk|Symantec|"
    "Trend Micro|Unit ?42|Verizon|VMware|DBIR|M-Trends|X-Force|Year in Review|"
    "Threat Landscape|Digital Defense"
)
# Vendor naming schemes for threat actors (animal suffixes, weather events, numbered
# clusters): an actor is named only as the ATT&CK group listed in `attack_groups`.
_VENDOR_ACTOR_NAME = (
    r"\b[A-Z]+ (SPIDER|BEAR|PANDA|KITTEN|CHOLLIMA|JACKAL|TIGER|BUFFALO|LIBRA)\b|"
    r"\b[A-Z][a-z]+ (Typhoon|Blizzard|Sandstorm|Sleet|Tempest|Tsunami|Hail|Dust|Cyclone)\b|"
    r"\b(UNC|APT|TA|FIN|DEV-|Storm-)\d+\b"
)


def test_no_source_vendor_or_product_is_named() -> None:
    forbidden = re.compile(rf"\b({_FORBIDDEN_NAMES})\b", re.IGNORECASE)
    for entry in load_knowledge_catalog().entries:
        for text in entry.texts():
            assert not forbidden.search(text), (entry.id, forbidden.search(text)[0])


def test_actors_are_named_only_as_their_attack_group() -> None:
    vendor_name = re.compile(_VENDOR_ACTOR_NAME)
    for entry in load_knowledge_catalog().entries:
        allowed = group_names(entry)
        other_names = {
            name
            for group in load_groups(entry.attack_version).values()
            for name in (group.name, *group.aliases)
            if len(name) > 3
        } - allowed
        for text in entry.texts():
            for name in allowed:
                text = text.replace(name, "")
            assert not vendor_name.search(text), (entry.id, vendor_name.search(text)[0])
            named = [n for n in other_names if re.search(rf"\b{re.escape(n)}\b", text)]
            assert not named, (entry.id, named)


def test_the_catalog_is_written_against_the_latest_attack_release() -> None:
    """Importing a new ATT&CK release means reviewing the knowledge base too:
    its techniques may be revoked or deprecated. Bump each entry's
    `attack_version` once reviewed (see scripts/import_attack.py)."""
    for entry in load_knowledge_catalog().entries:
        assert entry.attack_version == LATEST_ATTACK_VERSION, entry.id
