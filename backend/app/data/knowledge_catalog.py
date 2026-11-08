"""TTX-Zone's cybersecurity knowledge base: generic, anonymized background
the AI assistant grounds its answers in when it helps design an exercise --
threat trends, real incidents turned into archetypes, artifact templates an
inject can be built from, the regulations and frameworks exercises answer
to, objective patterns mapped to their regulatory requirements, and the
glossary of exercise design. A code-level, read-only catalog like
the inject and ATT&CK ones: one `.kb.md` file per entry under
app/data/knowledge/<kind>/, English only (the assistant answers in the
person's language), validated here when first loaded -- a broken entry
fails the tests, never a request.

    ---
    format: "ttx-zone.knowledge"
    format_version: 1
    id: "KB-TRD-001"
    kind: "trend"
    title: "Ransomware tempo: from first access to extortion in hours"
    sectors: ["cross-sector"]
    attack_techniques: ["enterprise:T1486"]
    ...
    ---
    # Ransomware tempo: from first access to extortion in hours

    ## Overview
    ...

The front matter is `key: <JSON value>` lines (scalars and arrays), so it
parses without a YAML library. The body is a fixed list of `##` sections per
kind (`SECTIONS`); each section is one retrieval chunk carrying the entry's
metadata, so a section must read on its own.

Every entry has a stable code, KB-<KIND>-NNN: never reused or renumbered.
Content is synthesized and generic: no source, vendor, product, victim or
person is named (docs/features/knowledge-base.md). The checks that can be
automated -- fictitious emails, domains and IPs, no absolute dates, codes
and ATT&CK ids that exist -- run here; the rest is review."""

import json
import re
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, Field, model_validator

from app.data.actor_catalog import ACTOR_CATALOG_BY_ID
from app.data.attack_catalog import (
    DOMAINS,
    group_replacement,
    is_live_technique,
    is_shipped,
    load_groups,
)
from app.data.inject_catalog import (
    SYSTEM_VARIABLES,
    InjectFamily,
    InjectStage,
    load_inject_catalog,
)
from app.data.regulatory_catalog import FRAMEWORK_CATALOG, REGULATORY_REQUIREMENT_IDS
from app.models.inject import DeliveryMethod
from app.models.ttx_needs_form import Capability

_DIR = Path(__file__).resolve().parent / "knowledge"
FILE_SUFFIX = ".kb.md"
KNOWLEDGE_FORMAT = "ttx-zone.knowledge"
KNOWLEDGE_FORMAT_VERSION = 1


class KnowledgeKind(StrEnum):
    # A threat pattern: indicative figures, its usual attack chain, timings.
    TREND = "trend"
    # A real incident generalized into an archetype a scenario can follow.
    CASE = "case"
    # A template for something a Player receives (a note, an alert, a post).
    ARTIFACT = "artifact"
    # A regulation or framework: what it expects from exercises and reports.
    FRAMEWORK = "framework"
    # An objective pattern by capability, with the requirements it evidences.
    OBJECTIVE = "objective"
    # A term of exercise design or incident response, explained.
    GLOSSARY = "glossary"


KIND_CODES: dict[KnowledgeKind, str] = {
    KnowledgeKind.TREND: "TRD",
    KnowledgeKind.CASE: "CAS",
    KnowledgeKind.ARTIFACT: "ART",
    KnowledgeKind.FRAMEWORK: "FRM",
    KnowledgeKind.OBJECTIVE: "OBJ",
    KnowledgeKind.GLOSSARY: "GLS",
}

# The kinds about threats, which say which inject families they feed.
THREAT_KINDS = frozenset({KnowledgeKind.TREND, KnowledgeKind.CASE, KnowledgeKind.ARTIFACT})

# Every entry's `##` sections, exactly these and in this order.
SECTIONS: dict[KnowledgeKind, tuple[str, ...]] = {
    KnowledgeKind.TREND: (
        "Overview",
        "Indicative figures",
        "Typical attack chain",
        "Realistic timings",
        "Exercise hooks",
    ),
    KnowledgeKind.CASE: (
        "Archetype",
        "Relative timeline",
        "Decision points",
        "Impacts",
        "Lessons",
        "Inject ideas",
    ),
    KnowledgeKind.ARTIFACT: (
        "Purpose",
        "Template",
        "Variants",
        "Realism notes",
    ),
    KnowledgeKind.FRAMEWORK: (
        "Scope",
        "What it expects from exercises",
        "Notification duties",
        "Evidence to keep",
        "Exercise hooks",
    ),
    KnowledgeKind.OBJECTIVE: (
        "Objective",
        "Success criterion",
        "Evidence",
        "Regulatory mapping",
        "Common pitfalls",
    ),
    KnowledgeKind.GLOSSARY: (
        "Definition",
        "In an exercise",
        "Common confusions",
    ),
}


class Sector(StrEnum):
    CROSS_SECTOR = "cross-sector"
    ENERGY_UTILITIES = "energy-utilities"
    OT_MANUFACTURING = "ot-manufacturing"
    FINANCE = "finance"
    HEALTHCARE = "healthcare"
    PUBLIC_ADMINISTRATION = "public-administration"
    TELECOM = "telecom"
    TRANSPORT_LOGISTICS = "transport-logistics"
    RETAIL_ECOMMERCE = "retail-ecommerce"
    EDUCATION = "education"
    TECHNOLOGY_MSP = "technology-msp"


class SourceClass(StrEnum):
    """What kind of material an entry was distilled from -- never which
    document (that mapping is kept outside the repository)."""

    ANNUAL_INDUSTRY_REPORT = "annual-industry-report"
    GOVERNMENT_ASSESSMENT = "government-assessment"
    SECTOR_INCIDENT_REPORT = "sector-incident-report"
    TRADE_MAGAZINE = "trade-magazine"
    PRACTITIONER_EXPERIENCE = "practitioner-experience"
    # The published text of a regulation or standard (frameworks).
    REGULATORY_TEXT = "regulatory-text"


_CODE = re.compile(r"KB-(?P<kind>[A-Z]{3})-\d{3}")
_CODE_IN_TEXT = re.compile(r"\bKB-[A-Z]{3}-\d{3}\b")
_INJECT_IN_TEXT = re.compile(r"\bINJ-[A-Z]{3}-C?\d{2}\b")
_TECHNIQUE = re.compile(r"(?P<domain>[a-z]+):(?P<id>T\d{4}(\.\d{3})?)")
_GROUP = re.compile(r"G\d{4}")
_VARIABLE = re.compile(r"\{(\w+)\}")
_SCENARIO_VARIABLE = re.compile(r"[a-z][a-z0-9_]{1,31}")
_PERIOD = re.compile(r"\d{4}(-\d{4})?")

# Fictitious-data rules shared with the inject catalog.
_EMAIL = re.compile(r"[\w.+-]+@(?P<domain>[\w-]+(\.[\w-]+)+)")
_URL = re.compile(r"(https?://|www\.)(?P<domain>[\w-]+(\.[\w-]+)+)", re.IGNORECASE)
_EXAMPLE_DOMAIN = re.compile(r"(.+\.)?example\.(com|org|net)", re.IGNORECASE)
_IPV4 = re.compile(r"(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])")
_DOCUMENTATION_NETS = ("192.0.2.", "198.51.100.", "203.0.113.")
_MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
_ABSOLUTE_DATE = re.compile(
    rf"\b(\d{{4}}-\d{{2}}-\d{{2}}|\d{{1,2}}/\d{{1,2}}/\d{{2,4}}|"
    rf"(\d{{1,2}} ({_MONTHS}))|(({_MONTHS}) \d{{1,2}}\b))",
    re.IGNORECASE,
)


class KnowledgeSection(BaseModel):
    heading: str
    text: Annotated[str, Field(min_length=1)]


class KnowledgeEntry(BaseModel):
    format: str
    format_version: int
    id: str
    kind: KnowledgeKind
    title: Annotated[str, Field(min_length=1, max_length=120)]
    # One or two sentences: what the assistant reads first to pick entries.
    summary: Annotated[str, Field(min_length=1, max_length=400)]
    language: str
    sectors: Annotated[list[Sector], Field(min_length=1)]
    # Required on the threat kinds (THREAT_KINDS), optional elsewhere.
    families: list[InjectFamily]
    capabilities: Annotated[list[Capability], Field(max_length=3)]
    attack_version: str
    # "<domain>:<technique id>", e.g. "ics:T0809".
    attack_techniques: list[str]
    attack_groups: list[str]
    related: list[str]
    # Frameworks (`regulatory_catalog.FRAMEWORK_CATALOG` ids) and regulatory
    # requirements (`REGULATORY_CATALOG` ids) the entry is about: required on
    # a framework (frameworks) and an objective (requirements).
    frameworks: list[str] = []
    requirements: list[str] = []
    source_class: SourceClass
    # The year (or span) the facts describe, e.g. "2025" or "2024-2025".
    period: str
    reviewed: str
    # Artifacts only: how it reaches the Players, from whom, and when.
    stage: InjectStage | None = None
    delivery_method: DeliveryMethod | None = None
    actor: str | None = None
    variables: list[str] = []
    variable_defaults: dict[str, str] = {}
    sections: list[KnowledgeSection]

    def section(self, heading: str) -> str:
        return next(s.text for s in self.sections if s.heading == heading)

    def texts(self) -> list[str]:
        """Every text a reader sees: what the content rules apply to."""
        return [self.title, self.summary, *(s.text for s in self.sections)]

    @model_validator(mode="after")
    def _check(self) -> "KnowledgeEntry":
        if (self.format, self.format_version) != (KNOWLEDGE_FORMAT, KNOWLEDGE_FORMAT_VERSION):
            raise ValueError(f"{self.id}: not a {KNOWLEDGE_FORMAT} v1 entry")
        if self.language != "en":
            raise ValueError(f"{self.id}: the knowledge base is written in English")
        code = _CODE.fullmatch(self.id)
        if not code or code["kind"] != KIND_CODES[self.kind]:
            raise ValueError(f"{self.id}: not a KB-{KIND_CODES[self.kind]}-NNN code")
        if [s.heading for s in self.sections] != list(SECTIONS[self.kind]):
            raise ValueError(f"{self.id}: sections must be {', '.join(SECTIONS[self.kind])}")
        if not _PERIOD.fullmatch(self.period):
            raise ValueError(f"{self.id}: period is a year or a span of years")
        if self.kind in THREAT_KINDS and not self.families:
            raise ValueError(f"{self.id}: a {self.kind} names the inject families it feeds")
        self._check_attack()
        self._check_regulations()
        self._check_artifact()
        self._check_fictitious_data()
        return self

    def _check_attack(self) -> None:
        if not is_shipped(self.attack_version):
            raise ValueError(f"{self.id}: ATT&CK v{self.attack_version} isn't shipped")
        for ref in self.attack_techniques:
            match = _TECHNIQUE.fullmatch(ref)
            if (
                not match
                or match["domain"] not in DOMAINS
                or not is_live_technique(self.attack_version, match["domain"], match["id"])
            ):
                raise ValueError(f"{self.id}: {ref} isn't a live technique of this release")
        for group in self.attack_groups:
            live = group_replacement(self.attack_version, group) == group
            if not _GROUP.fullmatch(group) or not live:
                raise ValueError(f"{self.id}: {group} isn't a live group of this release")

    def _check_regulations(self) -> None:
        known = {f.id for f in FRAMEWORK_CATALOG}
        if unknown := set(self.frameworks) - known:
            raise ValueError(f"{self.id}: unknown frameworks {sorted(unknown)}")
        if unknown := set(self.requirements) - REGULATORY_REQUIREMENT_IDS:
            raise ValueError(f"{self.id}: unknown requirements {sorted(unknown)}")
        if self.kind == KnowledgeKind.FRAMEWORK and not self.frameworks:
            raise ValueError(f"{self.id}: a framework entry names its framework")
        if self.kind == KnowledgeKind.OBJECTIVE and not (self.requirements and self.capabilities):
            raise ValueError(f"{self.id}: an objective names its capability and requirements")

    def _check_artifact(self) -> None:
        artifact = self.kind == KnowledgeKind.ARTIFACT
        fields = (self.stage, self.delivery_method, self.actor)
        if artifact and not all(fields):
            raise ValueError(f"{self.id}: an artifact has a stage, delivery method and actor")
        if not artifact and any(fields):
            raise ValueError(f"{self.id}: only artifacts have a stage, delivery method or actor")
        if self.actor and self.actor not in ACTOR_CATALOG_BY_ID:
            raise ValueError(f"{self.id}: unknown actor {self.actor}")
        used = {name for text in self.texts() for name in _VARIABLE.findall(text)}
        if used != set(self.variables):
            raise ValueError(f"{self.id}: `variables` doesn't list what the texts use")
        scenario = used - SYSTEM_VARIABLES
        if set(self.variable_defaults) != scenario:
            raise ValueError(f"{self.id}: scenario variables need exactly one default each")
        if any(not _SCENARIO_VARIABLE.fullmatch(name) for name in scenario):
            raise ValueError(f"{self.id}: scenario variables are snake_case")
        if not artifact and used:
            raise ValueError(f"{self.id}: only artifacts carry variables")

    def _check_fictitious_data(self) -> None:
        for text in self.texts():
            for match in (*_EMAIL.finditer(text), *_URL.finditer(text)):
                if not _EXAMPLE_DOMAIN.fullmatch(match["domain"]):
                    raise ValueError(f"{self.id}: {match[0]} isn't an example.* address")
            for match in _IPV4.finditer(text):
                if not match[0].startswith(_DOCUMENTATION_NETS):
                    raise ValueError(f"{self.id}: {match[0]} isn't a documentation address")
            date = _ABSOLUTE_DATE.search(text)
            if date:
                raise ValueError(f"{self.id}: {date[0]!r} -- use relative times")


class KnowledgeEntryError(ValueError):
    """The file isn't a readable entry (before its content is validated)."""


def _split(text: str, name: str) -> tuple[dict, list[dict]]:
    """The front matter's values and the body's `##` sections."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise KnowledgeEntryError(f"{name}: must start with ---")
    try:
        end = lines.index("---", 1)
    except ValueError:
        raise KnowledgeEntryError(f"{name}: the front matter isn't closed (---)") from None
    meta: dict = {}
    for line in lines[1:end]:
        if not line.strip():
            continue
        key, sep, raw = line.partition(":")
        try:
            if not sep or not key.strip():
                raise ValueError
            meta[key.strip()] = json.loads(raw)
        except ValueError:
            raise KnowledgeEntryError(f"{name}: {line!r} isn't `key: <JSON>`") from None
    sections: list[dict] = []
    for line in lines[end + 1 :]:
        if line.startswith("## "):
            sections.append({"heading": line[3:].strip(), "lines": []})
        elif sections:
            sections[-1]["lines"].append(line)
        elif line.strip() and not line.startswith("# "):
            raise KnowledgeEntryError(f"{name}: text before the first ## section")
    return meta, [
        {"heading": s["heading"], "text": "\n".join(s["lines"]).strip()} for s in sections
    ]


def parse_entry(text: str, name: str = "entry") -> KnowledgeEntry:
    meta, sections = _split(text, name)
    return KnowledgeEntry.model_validate({**meta, "sections": sections})


class KnowledgeCatalog(BaseModel):
    entries: list[KnowledgeEntry]

    @model_validator(mode="after")
    def _check(self) -> "KnowledgeCatalog":
        ids = {entry.id for entry in self.entries}
        if len(ids) != len(self.entries):
            raise ValueError("duplicate knowledge codes")
        injects = {inject.id for inject in load_inject_catalog().injects}
        for entry in self.entries:
            cited = {code for text in entry.texts() for code in _CODE_IN_TEXT.findall(text)}
            missing = (set(entry.related) | cited) - ids
            if missing:
                raise ValueError(f"{entry.id}: refers to missing entries {sorted(missing)}")
            cited = {code for text in entry.texts() for code in _INJECT_IN_TEXT.findall(text)}
            if cited - injects:
                raise ValueError(f"{entry.id}: refers to missing injects {sorted(cited - injects)}")
        return self


def group_names(entry: KnowledgeEntry) -> set[str]:
    """The ATT&CK names an entry may use for the groups it lists."""
    groups = load_groups(entry.attack_version)
    return {groups[g].name for g in entry.attack_groups}


@lru_cache
def load_knowledge_catalog() -> KnowledgeCatalog:
    entries = []
    for path in sorted(_DIR.glob(f"*/*{FILE_SUFFIX}")):
        entry = parse_entry(path.read_text(), path.name)
        if path.name != f"{entry.id}{FILE_SUFFIX}" or path.parent.name != entry.kind:
            raise KnowledgeEntryError(f"{path.name}: belongs at {entry.kind}/{entry.id}.kb.md")
        entries.append(entry)
    return KnowledgeCatalog(entries=entries)
