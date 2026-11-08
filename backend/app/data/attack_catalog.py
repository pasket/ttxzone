"""MITRE ATT&CK, versioned: the tactics and techniques an MSEL scenario and
its injects reference. A code-level, read-only catalog like the regulatory
one, but one file per domain and release under app/data/attack/, generated
from MITRE's official STIX data by scripts/import_attack.py -- nothing is
downloaded at runtime.

Every MSEL is pinned to a release (TTXMsel.attack_version) and stores
(domain, tactic, technique) ids; names are read from the pinned release's
file, which is never deleted. Moving an MSEL to a newer release is an
explicit upgrade (`upgrade_selection`): revoked techniques follow MITRE's
replacement, deprecated or vanished ones are dropped and reported.

Each release also carries MITRE's groups (threat actors): name, associated
groups and the techniques MITRE attributes to them -- the TTX-Zone level of
Library -> Threat actors, and what a scenario's MITRE-based threat actor is
copied from. A group can span both domains; `load_groups` merges them.

Names are English only, as MITRE publishes them."""

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).resolve().parent / "attack"

# Shipped releases, oldest first. Add a new one after importing it; never
# remove one (MSELs pinned to it read their names from its files).
ATTACK_VERSIONS: tuple[str, ...] = ("19.2",)
LATEST_ATTACK_VERSION = ATTACK_VERSIONS[-1]
DOMAINS: tuple[str, ...] = ("enterprise", "ics")
DOMAIN_NAMES = {"enterprise": "Enterprise", "ics": "ICS"}


@dataclass(frozen=True)
class Tactic:
    id: str
    name: str


@dataclass(frozen=True)
class Technique:
    id: str
    name: str
    tactics: tuple[str, ...]
    parent: str | None = None
    deprecated: bool = False


@dataclass(frozen=True)
class Group:
    """A MITRE ATT&CK group: `techniques` are (domain, technique id) pairs
    MITRE attributes to it (its `uses`), in both domains once merged."""

    id: str
    name: str
    aliases: tuple[str, ...]
    techniques: tuple[tuple[str, str], ...]
    deprecated: bool = False


@dataclass(frozen=True)
class AttackDomain:
    domain: str
    version: str
    released: str
    source_url: str
    source_sha256: str
    copyright: str
    tactics: tuple[Tactic, ...]
    techniques: dict[str, Technique] = field(repr=False)
    revoked: dict[str, str] = field(repr=False)
    groups: dict[str, Group] = field(default_factory=dict, repr=False)
    revoked_groups: dict[str, str] = field(default_factory=dict, repr=False)

    @property
    def tactic_names(self) -> dict[str, str]:
        return {t.id: t.name for t in self.tactics}


@lru_cache
def load_domain(version: str, domain: str) -> AttackDomain:
    if version not in ATTACK_VERSIONS or domain not in DOMAINS:
        raise KeyError(f"No ATT&CK {domain} v{version} in this build.")
    raw = json.loads((_DIR / f"{domain}-v{version}.json").read_text())
    if raw["domain"] != domain or raw["version"] != version:
        raise ValueError(f"{domain}-v{version}.json holds {raw['domain']} v{raw['version']}.")
    tactics = tuple(Tactic(t["id"], t["name"]) for t in raw["tactics"])
    tactic_ids = {t.id for t in tactics}
    techniques = {
        t["id"]: Technique(
            id=t["id"],
            name=t["name"],
            tactics=tuple(t["tactics"]),
            parent=t.get("parent"),
            deprecated=bool(t.get("deprecated")),
        )
        for t in raw["techniques"]
    }
    for technique in techniques.values():
        if not set(technique.tactics) <= tactic_ids:
            raise ValueError(f"{technique.id} names a tactic outside its matrix.")
    groups = {
        g["id"]: Group(
            id=g["id"],
            name=g["name"],
            aliases=tuple(g["aliases"]),
            techniques=tuple((domain, t) for t in g["techniques"]),
            deprecated=bool(g.get("deprecated")),
        )
        for g in raw.get("groups", [])
    }
    for group in groups.values():
        unknown = [t for _, t in group.techniques if t not in techniques]
        if unknown:
            raise ValueError(f"{group.id} uses techniques outside its matrix: {unknown}.")
    return AttackDomain(
        domain=domain,
        version=version,
        released=raw["released"],
        source_url=raw["source"]["url"],
        source_sha256=raw["source"]["sha256"],
        copyright=raw["copyright"],
        tactics=tactics,
        techniques=techniques,
        revoked=raw["revoked"],
        groups=groups,
        revoked_groups=raw.get("revoked_groups", {}),
    )


@lru_cache
def load_groups(version: str) -> dict[str, Group]:
    """The release's groups, both domains merged (a group like Sandworm
    Team has techniques in Enterprise and ICS), by id."""
    merged: dict[str, Group] = {}
    for domain in DOMAINS:
        for group in load_domain(version, domain).groups.values():
            known = merged.get(group.id)
            merged[group.id] = (
                group
                if known is None
                else Group(
                    id=group.id,
                    name=known.name,
                    aliases=tuple(dict.fromkeys(known.aliases + group.aliases)),
                    techniques=known.techniques + group.techniques,
                    deprecated=known.deprecated and group.deprecated,
                )
            )
    return dict(sorted(merged.items()))


def group_replacement(version: str, group_id: str) -> str | None:
    """The live group `group_id` stands for in `version`: itself, MITRE's
    replacement when it was revoked, or None when it's gone."""
    groups = load_groups(version)
    for domain in DOMAINS:
        group_id = load_domain(version, domain).revoked_groups.get(group_id, group_id)
    group = groups.get(group_id)
    return group_id if group is not None and not group.deprecated else None


def is_live_technique(version: str, domain: str, technique_id: str) -> bool:
    """A technique of that release that isn't deprecated (whatever tactic):
    what a threat actor's profile may hold."""
    try:
        technique = load_domain(version, domain).techniques.get(technique_id)
    except KeyError:
        return False
    return technique is not None and not technique.deprecated


def is_selectable(version: str, domain: str, tactic_id: str, technique_id: str) -> bool:
    """A live technique of that release, under one of its own tactics."""
    try:
        technique = load_domain(version, domain).techniques.get(technique_id)
    except KeyError:
        return False
    return technique is not None and not technique.deprecated and tactic_id in technique.tactics


def names(version: str, domain: str, tactic_id: str, technique_id: str) -> tuple[str, str]:
    """(tactic name, technique name) in that release; the ids themselves
    for anything it doesn't know, so a read never fails."""
    try:
        catalog = load_domain(version, domain)
    except KeyError:
        return tactic_id, technique_id
    technique = catalog.techniques.get(technique_id)
    name = technique.name if technique else technique_id
    if technique and technique.parent in catalog.techniques:
        name = f"{catalog.techniques[technique.parent].name}: {name}"
    return catalog.tactic_names.get(tactic_id, tactic_id), name


@dataclass(frozen=True)
class UpgradeOutcome:
    """What an MSEL's selection becomes in a newer release: `kept` in order,
    `replaced` (old -> new technique id) and `removed` technique ids."""

    kept: list[tuple[str, str, str]]
    replaced: list[tuple[str, str]]
    removed: list[str]


def upgrade_selection(selection: list[tuple[str, str, str]], to_version: str) -> UpgradeOutcome:
    """Map (domain, tactic, technique) triples onto `to_version`. A revoked
    technique becomes its replacement; if its tactic no longer applies it
    takes the technique's first tactic in the new release. Deprecated or
    unknown techniques are removed. Duplicates collapse."""
    kept: list[tuple[str, str, str]] = []
    replaced: list[tuple[str, str]] = []
    removed: list[str] = []
    for domain, tactic_id, technique_id in selection:
        catalog = load_domain(to_version, domain)
        target_id = catalog.revoked.get(technique_id, technique_id)
        technique = catalog.techniques.get(target_id)
        if technique is None or technique.deprecated or not technique.tactics:
            removed.append(technique_id)
            continue
        if target_id != technique_id:
            replaced.append((technique_id, target_id))
        tactic = tactic_id if tactic_id in technique.tactics else technique.tactics[0]
        triple = (domain, tactic, target_id)
        if triple not in kept:
            kept.append(triple)
    return UpgradeOutcome(kept=kept, replaced=replaced, removed=removed)


def upgrade_techniques(
    pairs: list[tuple[str, str]], to_version: str
) -> tuple[list[tuple[str, str]], list[tuple[str, str]], list[str]]:
    """A threat actor's profile -- (domain, technique) pairs, no tactic --
    on `to_version`: (kept, replaced old -> new, removed), like
    `upgrade_selection`."""
    kept: list[tuple[str, str]] = []
    replaced: list[tuple[str, str]] = []
    removed: list[str] = []
    for domain, technique_id in pairs:
        catalog = load_domain(to_version, domain)
        target_id = catalog.revoked.get(technique_id, technique_id)
        technique = catalog.techniques.get(target_id)
        if technique is None or technique.deprecated:
            removed.append(technique_id)
            continue
        if target_id != technique_id:
            replaced.append((technique_id, target_id))
        if (domain, target_id) not in kept:
            kept.append((domain, target_id))
    return kept, replaced, removed


def latest_attack_version() -> str:
    """The newest shipped release, read when called (tests add releases)."""
    return ATTACK_VERSIONS[-1]


def is_shipped(version: str) -> bool:
    """Whether this build has that release (read when called)."""
    return version in ATTACK_VERSIONS
