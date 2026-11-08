"""How an objective's measurement texts are read: one condition (success
criterion) or one item (evidence) per line -- what the objective dialog
writes, and what the EEG turns into observation points and a checklist.
No database access, so the needs form, the EEG and the migrations can all
use it."""

import re

# A line that says how to rate rather than what to observe -- a rating
# level ("Partially achieved: ...", "No conseguido: ...") or a lead-in
# ending in ":" ("Achieved only if all of the following:") -- belongs in
# the objective's rating guidance, never among its conditions. A condition
# that merely opens with "Achieved if ...: (1) ..." is not one.
RATING_LEVEL = re.compile(
    r"^\s*(?:(?:fully|partially|not)\s+achieved|"
    r"(?:parcialmente|totalmente)\s+(?:conseguido|logrado|alcanzado)|"
    r"no\s+(?:se\s+)?(?:consigue|conseguido|logrado|alcanzado))"
    r"[^:\n]*:",
    re.IGNORECASE,
)


def lines(text: str) -> list[str]:
    """The non-blank lines, trimmed, without a closing "." or ";"."""
    return [line.strip().rstrip(".;").strip() for line in text.splitlines() if line.strip()]


def condition_lines(success_criterion: str) -> list[str]:
    return lines(success_criterion)


def evidence_items(evidence: str) -> list[str]:
    return lines(evidence)


def is_rating_level(line: str) -> bool:
    stripped = line.strip()
    return bool(RATING_LEVEL.match(stripped)) or stripped.endswith(":")


# The level a rating line describes, by its opening words.
_PARTIAL = re.compile(
    r"^\s*(?:partially\s+achieved|(?:parcialmente)\s+(?:conseguido|logrado|alcanzado))\s*:?\s*",
    re.IGNORECASE,
)
_NOT = re.compile(
    r"^\s*(?:not\s+achieved|no\s+(?:se\s+)?(?:consigue|conseguido|logrado|alcanzado))\s*:?\s*",
    re.IGNORECASE,
)
# Where a second level starts inside one line ("Partially …. Not achieved: …").
_INLINE_NOT = re.compile(
    r"(?<=[.;])\s+(?=(?:not\s+achieved|no\s+(?:se\s+)?(?:consigue|conseguido|logrado|alcanzado))\s*:)",
    re.IGNORECASE,
)


def classify_level(line: str) -> str | None:
    """Which rating level a line of guidance describes: "partial", "not",
    "achieved" (a lead-in ending in ":", or "Achieved/Fully achieved …:"),
    or None for an ordinary line."""
    if _PARTIAL.match(line):
        return "partial"
    if _NOT.match(line):
        return "not"
    if is_rating_level(line):
        return "achieved"
    return None


def strip_level(line: str) -> str:
    """The guidance without its "Partially achieved:" / "Not achieved:"
    prefix."""
    text = _NOT.sub("", _PARTIAL.sub("", line.strip(), count=1), count=1).strip()
    return text[:1].upper() + text[1:]


def split_levels(guidance: str) -> dict[str, str]:
    """A free-text rating guidance split into the three levels: each line
    (and a second level inside a line) to its level, prefixes dropped;
    anything else is a note on what "achieved" means."""
    out: dict[str, list[str]] = {"achieved": [], "partial": [], "not": []}
    for raw in guidance.splitlines():
        for part in _INLINE_NOT.split(raw):
            line = part.strip()
            if not line:
                continue
            level = classify_level(line) or "achieved"
            out[level].append(strip_level(line) if level != "achieved" else line)
    return {level: "\n".join(lines) for level, lines in out.items()}


def clamp_at_least(value: int | None, conditions: int) -> int | None:
    """At least K of N makes sense for 1 <= K < N; otherwise it's "all"."""
    if value is None or conditions < 2 or value >= conditions:
        return None
    return max(1, value)


def objective_name(objective) -> str:
    """How an objective is named in references, headings and lists: its
    title, or its statement while it has none (an older record)."""
    return (getattr(objective, "title", "") or "").strip() or objective.statement
