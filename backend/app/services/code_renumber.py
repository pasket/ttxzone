"""Renumbering a document's row codes (PH-02, PH-03... -> PH-01, PH-02...).

Codes come from counters that never go back, so deleting a row leaves a
gap and the numbers say the order rows were created in. While a document
is still a draft that has never been frozen, the Planner can renumber one
kind of row in its order. Codes are written in free text too ("see
PH-03"), so the same old -> new map rewrites the document's text, in one
pass (PH-02 -> PH-01 and PH-03 -> PH-02 never chain). Undo sends the
previous codes back (`codes`)."""

import re
import uuid
from collections.abc import Callable, Iterable, Sequence
from typing import Any

from app.core.exceptions import AppException

# A kind's prefix, or one per row when a kind shares a number series under
# several prefixes (an MSEL's injects: INJ-01, DSC-02, POL-03).
Prefix = str | Callable[[Any], str]


def code_number(code: str, prefix: str | tuple[str, ...]) -> int | None:
    prefixes = (prefix,) if isinstance(prefix, str) else prefix
    alternatives = "|".join(re.escape(p) for p in prefixes)
    match = re.fullmatch(rf"(?:{alternatives})-(\d{{2,4}})", code)
    return int(match.group(1)) if match else None


def _prefix_of(prefix: Prefix, row: Any) -> str:
    return prefix if isinstance(prefix, str) else prefix(row)


def planned_codes(
    rows: Sequence[Any],
    prefix: Prefix,
    codes: dict[uuid.UUID, str] | None,
    error_code: str,
) -> dict[uuid.UUID, str]:
    """Each row's new code: its place in `rows` (already in the order
    wanted) or, to undo, the codes given -- exactly these rows, each with a
    well-formed code of this kind and none repeated."""
    if codes is None:
        return {
            row.id: f"{_prefix_of(prefix, row)}-{index:02d}"
            for index, row in enumerate(rows, start=1)
        }
    ids = {row.id for row in rows}
    values = list(codes.values())
    if (
        set(codes) != ids
        or len(set(values)) != len(values)
        or any(code_number(codes[row.id], _prefix_of(prefix, row)) is None for row in rows)
    ):
        raise AppException(error_code, "These codes don't match the document's rows.", 422)
    return dict(codes)


def out_of_order(rows: Sequence[Any], prefix: Prefix) -> bool:
    """Whether renumbering would change any code."""
    return any(
        row.code != f"{_prefix_of(prefix, row)}-{index:02d}"
        for index, row in enumerate(rows, start=1)
    )


def next_number(
    codes: Iterable[str], prefix: str | tuple[str, ...], renumbered: bool, current: int
) -> int:
    """The counter after the change: right after the last code when
    renumbering; never below the codes in use when putting old ones back."""
    highest = max((code_number(code, prefix) or 0 for code in codes), default=0)
    return highest + 1 if renumbered else max(current, highest + 1)


def code_rewriter(mapping: dict[str, str]):
    """Replaces whole codes only: PH-02 in "see PH-02." but not in PH-021;
    an inject's code also inside its actions' (INJ-04-A1 -> INJ-01-A1)."""
    if not mapping:
        return lambda text: text
    pattern = re.compile(
        r"\b(" + "|".join(re.escape(old) for old in sorted(mapping, key=len, reverse=True)) + r")\b"
    )

    def rewrite(value):
        if isinstance(value, str):
            return pattern.sub(lambda match: mapping[match.group(1)], value)
        if isinstance(value, list):
            return [rewrite(item) for item in value]
        return value

    return rewrite


def rewrite_fields(rows: Iterable[Any], fields: Sequence[str], rewrite) -> None:
    for row in rows:
        for field in fields:
            value = getattr(row, field)
            new = rewrite(value)
            if new != value:
                setattr(row, field, new)
