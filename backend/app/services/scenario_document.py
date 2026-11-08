"""The scenario file: `<name>.ttx.md`, Markdown that reads on its own (a
repository, a chat, an email) and carries the data losslessly.

    ---
    format: "ttx-zone.scenario"
    format_version: 1
    language: "en"
    title: "Ransomware on the payment platform"
    exported_at: "2026-10-12T10:00:00+00:00"
    generator: "ttx-zone"
    attack_version: "19.2"
    ---
    # Ransomware on the payment platform
    ...a readable summary: objectives, phases, injects...

    ```json ttx-zone-scenario
    { ...ScenarioDocument... }
    ```

The front matter is YAML restricted to `key: <JSON scalar>` lines, so it
parses without a YAML library. Only the front matter and the one fenced
block tagged `ttx-zone-scenario` are read back; the readable body is
regenerated on every export and ignored on import (edit the data block,
not the prose). JSON never holds a raw newline inside a string, so no
line of the block can close the fence early.

Versioning: `format_version` names the data's shape. A file from a newer
TTX-Zone is refused; an older one goes through `UPGRADERS` (one step per
version, oldest first) before validation."""

import json
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from app.core.i18n import translate_error
from app.schemas.scenario import (
    SCENARIO_FORMAT,
    SCENARIO_FORMAT_VERSION,
    ScenarioDocument,
    ScenarioIssue,
)

FENCE_INFO = "json ttx-zone-scenario"
FILE_SUFFIX = ".ttx.md"


# format_version -> a function turning that version's data into the next.
def _upgrade_1_to_2(data: dict[str, Any]) -> dict[str, Any]:
    """Version 2 adds an optional headline to each phase: nothing to change."""
    return data


def _upgrade_2_to_3(data: dict[str, Any]) -> dict[str, Any]:
    """Version 3 adds rooms (optional; none: played at one table)."""
    return data


def _upgrade_3_to_4(data: dict[str, Any]) -> dict[str, Any]:
    """Version 4 adds inject files (optional; none: images only)."""
    return data


def _upgrade_4_to_5(data: dict[str, Any]) -> dict[str, Any]:
    """Version 5 adds rendered artifacts (optional; none: plain text)."""
    return data


def _upgrade_5_to_6(data: dict[str, Any]) -> dict[str, Any]:
    """Version 6 replaces each inject's `scored` with its `format`, which
    also has polls."""
    for inject in (data.get("msel") or {}).get("injects", []):
        if isinstance(inject, dict) and "scored" in inject:
            scored = inject.pop("scored")
            inject["format"] = "inject" if scored else "discussion"
    return data


def _upgrade_6_to_7(data: dict[str, Any]) -> dict[str, Any]:
    """Version 7 adds what follows each option of a poll (optional)."""
    return data


def _upgrade_7_to_8(data: dict[str, Any]) -> dict[str, Any]:
    """Version 8 adds impact meters and what each poll option adds to them
    (optional)."""
    return data


UPGRADERS: dict[int, Callable[[dict[str, Any]], dict[str, Any]]] = {
    1: _upgrade_1_to_2,
    2: _upgrade_2_to_3,
    3: _upgrade_3_to_4,
    4: _upgrade_4_to_5,
    5: _upgrade_5_to_6,
    6: _upgrade_6_to_7,
    7: _upgrade_7_to_8,
}


class ScenarioFormatError(Exception):
    """The file isn't a readable scenario: the issues say why."""

    def __init__(self, issues: list[ScenarioIssue]):
        super().__init__("; ".join(issue_text(issue, "en") for issue in issues))
        self.issues = issues


def scenario_issue(path: str, code: str, message: str, **params: str | int) -> ScenarioIssue:
    return ScenarioIssue(path=path, code=code, message=message, params=params or None)


def issue_text(issue: ScenarioIssue, locale: str) -> str:
    """An issue's message in `locale`, its values filled in."""
    return translate_error(issue.message, issue.params, locale)


def _front_matter(lines: list[str]) -> tuple[dict[str, Any], int]:
    """The `key: value` pairs between the leading `---` lines, and the
    index of the line after them."""
    if not lines or lines[0].strip() != "---":
        raise ScenarioFormatError(
            [
                scenario_issue(
                    "front_matter", "SCENARIO_NO_FRONT_MATTER", "The file must start with ---."
                )
            ]
        )
    meta: dict[str, Any] = {}
    for index in range(1, len(lines)):
        line = lines[index].strip()
        if line == "---":
            return meta, index + 1
        if not line or line.startswith("#"):
            continue
        key, sep, raw = line.partition(":")
        if not sep or not key.strip():
            raise ScenarioFormatError(
                [
                    scenario_issue(
                        f"front_matter[{index}]",
                        "SCENARIO_BAD_FRONT_MATTER",
                        "Line {line} isn't `key: value`.",
                        line=index + 1,
                    )
                ]
            )
        raw = raw.strip()
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            value = raw  # a bare YAML string
        meta[key.strip()] = value
    raise ScenarioFormatError(
        [
            scenario_issue(
                "front_matter", "SCENARIO_NO_FRONT_MATTER", "The front matter isn't closed (---)."
            )
        ]
    )


def _data_block(lines: list[str], start: int) -> str:
    blocks: list[str] = []
    index = start
    while index < len(lines):
        if lines[index].strip() == f"```{FENCE_INFO}":
            end = index + 1
            while end < len(lines) and lines[end].strip() != "```":
                end += 1
            if end == len(lines):
                raise ScenarioFormatError(
                    [
                        scenario_issue(
                            "data", "SCENARIO_NO_DATA", "The data block isn't closed (```)."
                        )
                    ]
                )
            blocks.append("\n".join(lines[index + 1 : end]))
            index = end
        index += 1
    if len(blocks) != 1:
        raise ScenarioFormatError(
            [
                scenario_issue(
                    "data",
                    "SCENARIO_NO_DATA",
                    "The file must hold exactly one ```{fence} block (found {found}).",
                    fence=FENCE_INFO,
                    found=len(blocks),
                )
            ]
        )
    return blocks[0]


def scenario_path(location: tuple) -> str:
    out = ""
    for part in location:
        out += f"[{part}]" if isinstance(part, int) else (f".{part}" if out else str(part))
    return out or "data"


def validate_data(data: Any) -> ScenarioDocument:
    """Upgrade (if older) and validate a document's data."""
    if not isinstance(data, dict):
        raise ScenarioFormatError(
            [scenario_issue("data", "SCENARIO_BAD_DATA", "The data block must be a JSON object.")]
        )
    if data.get("format") != SCENARIO_FORMAT:
        raise ScenarioFormatError(
            [
                scenario_issue(
                    "format",
                    "SCENARIO_BAD_FORMAT",
                    "Not a {format} document.",
                    format=SCENARIO_FORMAT,
                )
            ]
        )
    version = data.get("format_version")
    if not isinstance(version, int) or version < 1:
        raise ScenarioFormatError(
            [
                scenario_issue(
                    "format_version", "SCENARIO_BAD_FORMAT", "format_version must be 1 or later."
                )
            ]
        )
    if version > SCENARIO_FORMAT_VERSION:
        raise ScenarioFormatError(
            [
                scenario_issue(
                    "format_version",
                    "SCENARIO_NEWER_FORMAT",
                    "This file uses format version {version}, made by a newer TTX-Zone; "
                    "this one reads up to version {supported}.",
                    version=version,
                    supported=SCENARIO_FORMAT_VERSION,
                )
            ]
        )
    while version < SCENARIO_FORMAT_VERSION:
        data = UPGRADERS[version](data)
        version += 1
        data["format_version"] = version
    try:
        return ScenarioDocument.model_validate(data)
    except ValidationError as exc:
        raise ScenarioFormatError(
            [
                scenario_issue(scenario_path(error["loc"]), "SCENARIO_INVALID", error["msg"])
                for error in exc.errors()[:50]
            ]
        ) from None


def parse(text: str) -> ScenarioDocument:
    """A `.ttx.md` file's document, or ScenarioFormatError."""
    lines = text.replace("\r\n", "\n").split("\n")
    meta, body_start = _front_matter(lines)
    raw = _data_block(lines, body_start)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ScenarioFormatError(
            [
                scenario_issue(
                    "data",
                    "SCENARIO_BAD_JSON",
                    "The data block isn't valid JSON: {detail}.",
                    detail=exc.msg,
                )
            ]
        ) from None
    if isinstance(data, dict):
        for key in ("format", "format_version"):
            if key in meta and meta[key] != data.get(key):
                raise ScenarioFormatError(
                    [
                        scenario_issue(
                            f"front_matter.{key}",
                            "SCENARIO_FRONT_MATTER_MISMATCH",
                            "The front matter's {key} doesn't match the data block's.",
                            key=key,
                        )
                    ]
                )
    return validate_data(data)


# -- export ----------------------------------------------------------------------


def _scalar(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _heading_text(value: str) -> str:
    return " ".join(value.split()) or "—"


def render_body(doc: ScenarioDocument) -> str:
    """The readable part: a summary for people browsing the file. Never
    read back."""
    spanish = doc.language == "es"

    def label(en: str, es: str) -> str:
        return es if spanish else en

    out: list[str] = [f"# {_heading_text(doc.exercise.name)}", ""]
    if doc.exercise.description:
        out += [doc.exercise.description.strip(), ""]
    out += [
        "> "
        + label(
            "TTX-Zone scenario. Import it from Library → Scenarios. The readable part below "
            "is generated on export; only the data block at the end is imported.",
            "Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible "
            "se genera al exportar; solo se importa el bloque de datos del final.",
        ),
        "",
    ]
    if doc.needs.objectives:
        out += [f"## {label('Objectives', 'Objetivos')}", ""]
        out += [
            f"- **{o.code}** {_heading_text(o.title or o.statement)}" for o in doc.needs.objectives
        ]
        out.append("")
    if doc.msel:
        if doc.msel.summary:
            out += [f"## {label('Scenario', 'Escenario')}", "", doc.msel.summary.strip(), ""]
        injects_by_phase: dict[str | None, list] = {}
        for inject in doc.msel.injects:
            injects_by_phase.setdefault(inject.phase_code, []).append(inject)
        if doc.msel.phases:
            out += [f"## {label('Phases and injects', 'Fases e injects')}", ""]
        for phase in doc.msel.phases:
            out += [f"### {phase.code} {_heading_text(phase.name)}", ""]
            if phase.situation_update:
                out += [phase.situation_update.strip(), ""]
            for inject in injects_by_phase.get(phase.code, []):
                when = (
                    f"T+{inject.offset_minutes}′"
                    if inject.offset_minutes is not None
                    else label("contingent", "contingente")
                )
                out.append(f"- **{inject.code}** ({when}) {_heading_text(inject.title)}")
                if inject.poll_question:
                    out.append(f"  - {_heading_text(inject.poll_question)}")
                    for index, option in enumerate(inject.poll_options):
                        out.append(f"    - {_heading_text(option)}")
                        if index < len(inject.poll_outcomes) and inject.poll_outcomes[index]:
                            out.append(f"      - {_heading_text(inject.poll_outcomes[index])}")
            out.append("")
    if doc.cast:
        out += [f"## {label('Simulated actors', 'Actores simulados')}", ""]
        out += [f"- **{a.code}** {_heading_text(a.name)}" for a in doc.cast]
        out.append("")
    return "\n".join(out)


def render(doc: ScenarioDocument, *, generator: str = "ttx-zone", stamp: bool = False) -> str:
    """The whole `.ttx.md` file. `stamp`: dated now (an export), rather
    than keeping the document's own date."""
    exported_at = datetime.now(UTC) if stamp else (doc.exported_at or datetime.now(UTC))
    doc = doc.model_copy(update={"exported_at": exported_at})
    meta = {
        "format": doc.format,
        "format_version": doc.format_version,
        "language": doc.language,
        "title": doc.exercise.name,
        "exported_at": exported_at.isoformat(),
        "generator": generator,
        "attack_version": doc.msel.attack_version if doc.msel else None,
    }
    front = ["---", *(f"{key}: {_scalar(value)}" for key, value in meta.items()), "---", ""]
    data = json.dumps(doc.model_dump(mode="json"), ensure_ascii=False, indent=2)
    return "\n".join(
        [*front, render_body(doc), f"```{FENCE_INFO}", data, "```", ""],
    )


def file_name(doc: ScenarioDocument) -> str:
    """A safe download name from the scenario's name."""
    slug = "".join(c.lower() if c.isascii() and c.isalnum() else "-" for c in doc.exercise.name)
    slug = "-".join(part for part in slug.split("-") if part)[:60] or "scenario"
    return f"{slug}{FILE_SUFFIX}"
