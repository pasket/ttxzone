"""Moving ATT&CK references onto another release -- the one rule behind
every place a reference crosses releases: upgrading an MSEL, copying a
library threat actor or inject into an MSEL pinned to another release,
and updating an organization's library to the latest release.

A revoked technique (or group) becomes MITRE's replacement; one that is
deprecated or that the release doesn't have is removed; a technique whose
tactic no longer applies takes its first tactic there. A group the release
doesn't have is dropped from the actor, which stays as an unknown actor
with its name and profile. Everything replaced or removed is reported."""

from dataclasses import dataclass, field

from app.data.attack_catalog import group_replacement, upgrade_selection, upgrade_techniques
from app.schemas.ttx_msel import AttackConversionRead, AttackReplacement


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
