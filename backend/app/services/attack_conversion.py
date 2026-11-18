"""Moving ATT&CK references onto another release -- the one rule behind
every place a reference crosses releases: upgrading an MSEL, copying a
library threat actor or inject into an MSEL pinned to another release,
and updating an organization's library to the latest release.

A revoked technique (or group) becomes MITRE's replacement; one that is
deprecated or that the release doesn't have is removed; a technique whose
tactic no longer applies takes its first tactic there. A group the release
doesn't have is dropped from the actor, which stays as an unknown actor
with its name and profile. Everything replaced or removed is reported.

An MSEL's upgrade is planned first (`plan_upgrade`): the same conversion,
plus what it would change without replacing or removing anything -- a
technique whose tactic no longer applies, or that MITRE renamed or filed
under other tactics. A plan that changes none of it is `neutral`: only the
release number moves, so it needs nobody's review."""

from collections.abc import Hashable
from dataclasses import dataclass, field

from app.data.attack_catalog import (
    group_replacement,
    load_domain,
    upgrade_selection,
    upgrade_techniques,
)
from app.schemas.ttx_msel import AttackConversionRead, AttackReplacement, AttackTacticMove


@dataclass
class ConversionReport:
    """What a conversion changed, in order, each change once."""

    replaced: dict[tuple[str, str], None] = field(default_factory=dict)
    removed: dict[str, None] = field(default_factory=dict)

    def read(self) -> AttackConversionRead:
        return AttackConversionRead(
            replaced=[AttackReplacement(from_id=a, to_id=b) for a, b in self.replaced],
            removed=list(self.removed),
        )


def convert_refs(
    triples: list[tuple[str, str, str]], to_version: str, report: ConversionReport
) -> list[tuple[str, str, str]]:
    """(domain, tactic, technique) references -- an inject's -- on `to_version`."""
    outcome = upgrade_selection(triples, to_version)
    report.replaced.update(dict.fromkeys(outcome.replaced))
    report.removed.update(dict.fromkeys(outcome.removed))
    return outcome.kept


def convert_profile(
    group_id: str | None,
    pairs: list[tuple[str, str]],
    to_version: str,
    report: ConversionReport,
) -> tuple[str | None, list[tuple[str, str]]]:
    """A threat actor -- its MITRE group and (domain, technique) profile --
    on `to_version`."""
    kept, replaced, removed = upgrade_techniques(pairs, to_version)
    report.replaced.update(dict.fromkeys(replaced))
    report.removed.update(dict.fromkeys(removed))
    if group_id is None:
        return None, kept
    target = group_replacement(to_version, group_id)
    if target is None:
        report.removed[group_id] = None
    elif target != group_id:
        report.replaced[(group_id, target)] = None
    return target, kept


def _face(version: str, domain: str, technique_id: str) -> tuple[str, str, tuple[str, ...]] | None:
    """What a read shows of a technique in `version`: its name, its
    parent's and its tactics. None for a release or technique unknown."""
    try:
        catalog = load_domain(version, domain)
    except KeyError:
        return None
    technique = catalog.techniques.get(technique_id)
    if technique is None:
        return None
    parent = catalog.techniques.get(technique.parent) if technique.parent else None
    return technique.name, parent.name if parent else "", technique.tactics


@dataclass
class UpgradePlan:
    """An MSEL's references on `to_version`, by the caller's keys, and what
    getting there changes."""

    to_version: str
    injects: dict[Hashable, list[tuple[str, str, str]]]
    actors: dict[Hashable, tuple[str | None, list[tuple[str, str]]]]
    report: ConversionReport
    # An inject's technique kept under another tactic (its own no longer applies).
    moved: list[AttackTacticMove]
    # Techniques kept whose name or tactics differ in the new release.
    changed: list[str]

    @property
    def neutral(self) -> bool:
        """Nothing replaced, removed, moved or renamed: every read of the
        MSEL stays word for word the same."""
        return not (self.report.replaced or self.report.removed or self.moved or self.changed)


def plan_upgrade(
    from_version: str,
    to_version: str,
    injects: dict[Hashable, list[tuple[str, str, str]]],
    actors: dict[Hashable, tuple[str | None, list[tuple[str, str]]]],
) -> UpgradePlan:
    """What moving an MSEL -- each inject's (domain, tactic, technique)
    references and each threat actor's (group, profile) -- from
    `from_version` onto `to_version` gives and changes."""
    report = ConversionReport()
    new_injects = {
        key: convert_refs(triples, to_version, report) for key, triples in injects.items()
    }
    new_actors = {
        key: convert_profile(group_id, pairs, to_version, report)
        for key, (group_id, pairs) in actors.items()
    }
    replaced = {old for old, _ in report.replaced}
    moved: dict[tuple[str, str, str], None] = {}
    used: dict[tuple[str, str], None] = {}
    for key, triples in injects.items():
        kept = set(new_injects[key])
        for domain, tactic_id, technique_id in triples:
            if technique_id in replaced:
                continue
            tactics = [ta for d, ta, te in new_injects[key] if (d, te) == (domain, technique_id)]
            if not tactics:
                continue  # removed
            used[(domain, technique_id)] = None
            if (domain, tactic_id, technique_id) not in kept:
                # `upgrade_selection` gave it the technique's first tactic there.
                target = load_domain(to_version, domain).techniques[technique_id].tactics[0]
                moved[(technique_id, tactic_id, target)] = None
    for key, (_group_id, pairs) in actors.items():
        kept_pairs = set(new_actors[key][1])
        for pair in pairs:
            if pair[1] not in replaced and pair in kept_pairs:
                used[pair] = None
    changed = [
        technique_id
        for domain, technique_id in used
        if _face(from_version, domain, technique_id) != _face(to_version, domain, technique_id)
    ]
    return UpgradePlan(
        to_version=to_version,
        injects=new_injects,
        actors=new_actors,
        report=report,
        moved=[
            AttackTacticMove(technique_id=t, from_tactic_id=a, to_tactic_id=b) for t, a, b in moved
        ],
        changed=changed,
    )
