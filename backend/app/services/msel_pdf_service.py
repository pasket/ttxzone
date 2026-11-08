"""PDF exports built from an exercise's MSEL. This module serves the full
list (`msel`, for the planning team) and holds the stories the session
documents share -- exported from Creator -> Session plan
(conduct_prep_pdf_service), each per audience:

- the facilitator and controller guide -- per phase, what to say, ask and
  deliver, the contingents with their triggers, and the stop procedure;
- the Situation Manual Players get before the session;
- one inject card per inject for the controllers to hand out.

Content safety is structural, not cosmetic: the Players' and controllers'
documents are built from their own export schemas (`SitmanExport`,
`InjectCardsExport`), which have no field for expected actions,
facilitator notes or trigger conditions -- so they can't leak by a missed
`if` in the layout code. A READY MSEL is exported from its frozen snapshot.

Every page carries the logo, the TLP label top and bottom and an EXERCISE
band; all user text is html.escape'd before it reaches reportlab markup
(see pdf_common)."""

import logging
from datetime import UTC, datetime, time
from html import escape
from typing import Literal

from pydantic import BaseModel
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    Spacer,
    Table,
    TableStyle,
)
from sqlmodel import Session

from app.core.exceptions import AppException
from app.data.attack_catalog import DOMAIN_NAMES, DOMAINS, load_domain
from app.models import TTX, InjectFormat, InjectKind, MselStatus
from app.schemas.ttx_msel import InjectArtifact, InjectRead, MselRead
from app.schemas.ttx_needs_form import ValidationReport
from app.services.msel_pdf_labels import LABELS
from app.services.needs_pdf_labels import LABELS as NEEDS_LABELS
from app.services.objective_text import objective_name
from app.services.pdf_common import (
    BAND,
    CONTENT_WIDTH,
    LANDSCAPE_CONTENT_WIDTH,
    LINE,
    build_pdf,
    code_ref,
    code_ref_cell,
    format_date,
    formatted,
    grid,
    join,
    kv_table,
    landscape_content_height,
    para,
    ref_lines,
    text,
    tlp_file_part,
)
from app.services.storyline_pdf import StorylineFlowable
from app.services.ttx_msel_service import find_msel, latest_snapshot, msel_read

# The session documents (SitMan, guide, cards, EEG) are exported from
# Creator -> Session plan.
ExportKind = Literal["msel"]


# -- export schemas (what each audience may see) ----------------------------


class SitmanPhase(BaseModel):
    name: str
    start_offset: int
    end_offset: int


class SitmanObjective(BaseModel):
    code: str
    title: str = ""
    statement: str


class SitmanExport(BaseModel):
    """The Players' Situation Manual. Deliberately no injects, expected
    actions, facilitator notes, trigger conditions, situation updates,
    threat actors or ATT&CK attribution (saying an inject is noise gives
    the answer away): Players discover the scenario as it unfolds. It does
    carry the stop procedure and keyword: every participant must know how
    to halt the exercise, as the Playground's band tells them too."""

    title: str
    summary: str
    exercise_start: time | None
    duration_minutes: int | None
    time_compression: int
    objectives: list[SitmanObjective]
    areas: list[str]
    phases: list[SitmanPhase]
    # The session, from the conduct prep (empty when there is none yet).
    # Already formatted for the document's language.
    session_date: str = ""
    session_start: str = ""
    timezone: str = ""
    modality: str | None = None
    venue: str = ""
    room: str = ""
    meeting_link: str = ""
    facilitators: list[str] = []
    # Empty: the stop section is left out (the MSEL's own export has no plan).
    stop_procedure: str = ""
    stop_keyword: str = ""


class CardImage(BaseModel):
    """An image the players get with the inject: its stored file, its size
    and its caption."""

    path: str
    width: int
    height: int
    caption: str = ""


class CardFile(BaseModel):
    """A file the players download with the inject: named, never drawn."""

    name: str
    size_bytes: int
    sha256: str
    description: str = ""


def _file_size(size: int) -> str:
    for unit in ("B", "KB", "MB"):
        if size < 1024 or unit == "MB":
            return f"{size} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size} B"  # pragma: no cover


def _objectives_cell(inject, objective_refs, fields: dict) -> str:
    """The MSEL table's objectives cell: only an inject evaluates any."""
    if inject.format == InjectFormat.INJECT:
        return objective_refs(inject.objective_ids)
    key = "poll" if inject.format == InjectFormat.POLL else "not_scored"
    return escape(fields[key])


def _poll_markup(inject) -> str:
    """A poll's question and its options, lettered as the Players see them."""
    options = [
        f"{chr(ord('A') + index)}. {escape(option)}"
        for index, option in enumerate(inject.poll_options)
    ]
    return "<br/>".join([f"<b>{escape(inject.poll_question)}</b>", *options])


def _poll_team_markup(inject) -> str:
    """A poll for the team's documents: each option with what follows it.
    Never on what's handed to the table."""
    lines = [f"<b>{escape(inject.poll_question)}</b>"]
    for index, option in enumerate(inject.poll_options):
        lines.append(f"{chr(ord('A') + index)}. {escape(option)}")
        outcome = inject.poll_outcomes[index] if index < len(inject.poll_outcomes) else ""
        if outcome.strip():
            lines.append(f"<font color='#5B6270'>→ {escape(outcome)}</font>")
    return "<br/>".join(lines)


class InjectCard(BaseModel):
    """What a controller hands out or reads: who sends what to whom, how and
    when. No expected actions, notes, trigger conditions or ATT&CK
    attribution."""

    code: str
    phase: str
    kind: InjectKind
    offset_minutes: int | None
    sender: str
    recipients: list[str]
    delivery_method: str
    title: str
    content: str
    attachment_notes: list[str]
    artifact: InjectArtifact | None = None
    poll_question: str = ""
    poll_options: list[str] = []
    images: list[CardImage] = []
    files: list[CardFile] = []


class InjectCardsExport(BaseModel):
    cards: list[InjectCard]


def sitman_export(msel: MselRead, **session) -> SitmanExport:
    """`session`: the conduct prep's session fields (and the start time,
    which then replaces the MSEL's) -- only those SitmanExport declares."""
    return SitmanExport(
        title=msel.title,
        summary=msel.summary,
        exercise_start=session.pop("exercise_start", None) or msel.exercise_start,
        duration_minutes=msel.duration_minutes,
        time_compression=msel.time_compression,
        objectives=[
            SitmanObjective(code=o.code, title=o.title, statement=o.statement)
            for o in msel.needs.objectives
        ],
        areas=msel.needs.participating_areas,
        phases=[
            SitmanPhase(name=p.name, start_offset=p.start_offset, end_offset=p.end_offset)
            for p in msel.phases
        ],
        **session,
    )


# The template fields each artifact kind shows, in order, with their label
# key -- the twin of the inject wizard's KIND_FIELDS (InjectArtifactField).
_ARTIFACT_FIELDS: dict[str, tuple[tuple[str, str], ...]] = {
    "email": (
        ("sender", "from"),
        ("sender_address", "from_address"),
        ("recipient", "to"),
        ("subject", "subject"),
        ("timestamp", "date"),
    ),
    "press_release": (
        ("sender", "outlet"),
        ("subject", "headline"),
        ("location", "dateline"),
        ("timestamp", "date"),
        ("sender_address", "press_contact"),
    ),
    "social_post": (("sender", "author"), ("sender_address", "handle"), ("timestamp", "date")),
    "chat_message": (("sender", "sender"), ("location", "channel"), ("timestamp", "date")),
}


def _artifact_markup(artifact: InjectArtifact, labels: dict) -> str:
    """How the table sees an inject drawn as a simulated artifact: its kind,
    then the template fields filled in (all escaped user text)."""
    names = labels["artifact_fields"]
    lines = [f"<b>{escape(labels['artifact_kinds'][artifact.kind])}</b>"]
    for field, label in _ARTIFACT_FIELDS[artifact.kind]:
        value = getattr(artifact, field)
        if value.strip():
            lines.append(f"{escape(names[label])}: {text(value)}")
    return "<br/>".join(lines)


def _rooms_markup(inject, msel: MselRead, labels: dict) -> str:
    """The rooms an inject is played in, or "All rooms"."""
    rooms = {r.id: r for r in msel.rooms}
    aimed = [rooms[r] for r in inject.room_ids if r in rooms]
    if not aimed:
        return escape(labels["fields"]["all_rooms"])
    return ", ".join(code_ref(r.code, r.name) for r in aimed)


def inject_cards_export(msel: MselRead, image_files: dict | None = None) -> InjectCardsExport:
    """`image_files`: each image id's stored file (an image without one --
    deleted meanwhile -- is left out)."""
    files = image_files or {}
    phases = {p.id: p.name for p in msel.phases}
    actors = {a.id: a.name for a in msel.actors}
    return InjectCardsExport(
        cards=[
            InjectCard(
                code=i.code,
                phase=phases.get(i.phase_id, ""),
                kind=i.kind,
                offset_minutes=i.offset_minutes,
                sender=actors.get(i.simulated_actor_id, ""),
                recipients=i.recipients,
                delivery_method=i.delivery_method,
                title=i.title,
                content=i.content,
                attachment_notes=i.attachment_notes,
                artifact=i.artifact,
                poll_question=i.poll_question,
                poll_options=i.poll_options,
                images=[
                    CardImage(
                        path=str(files[image.id]),
                        width=image.width,
                        height=image.height,
                        caption=image.caption,
                    )
                    for image in i.images
                    if image.id in files
                ],
                files=[
                    CardFile(
                        name=f.name,
                        size_bytes=f.size_bytes,
                        sha256=f.sha256,
                        description=f.description,
                    )
                    for f in i.files
                ],
            )
            for i in _ordered(msel)
        ]
    )


# -- helpers ------------------------------------------------------------------


def _offset(minutes: int | None, none: str = "—") -> str:
    if minutes is None:
        return none
    return f"T+{minutes // 60:02d}:{minutes % 60:02d}"


def _ordered(msel: MselRead) -> list[InjectRead]:
    """Timeline order: by phase, then time (contingents last), then saved order."""
    phase_order = {p.id: index for index, p in enumerate(msel.phases)}
    indexed = list(enumerate(msel.injects))
    indexed.sort(
        key=lambda pair: (
            phase_order.get(pair[1].phase_id, 99),
            pair[1].offset_minutes if pair[1].offset_minutes is not None else 10**6,
            pair[0],
        )
    )
    return [inject for _, inject in indexed]


def _source(session: Session, ttx: TTX) -> MselRead:
    """What to export: the frozen snapshot of a READY MSEL, else the live
    one -- which must be free of errors (only injects still to validate may
    remain), so a document never prints a scenario that breaks the rules."""
    msel = find_msel(session, ttx.id)
    if msel is None:
        raise AppException("MSEL_NOT_FOUND", "This exercise has no MSEL yet.", 404)
    live = msel_read(session, ttx, msel)
    if live.status == MselStatus.READY:
        snapshot = latest_snapshot(session, ttx.id)
        if snapshot is not None and snapshot.version == live.version:
            empty = ValidationReport(ready=[], approved=[], warnings=[])
            return MselRead.model_validate({**snapshot.payload, "validation": empty})
    if live.validation.ready:
        raise AppException(
            "MSEL_INCOMPLETE",
            "Fix the MSEL's issues before exporting it.",
            409,
            log_level=logging.WARNING,
        )
    return live


def _heading(story: list, labels: dict, kind: str, ttx: TTX, msel: MselRead) -> None:
    story += [
        para(escape(labels["titles"][kind]), "title"),
        para(f"{escape(ttx.code)} · {escape(ttx.name)}", "subtitle"),
        Spacer(1, 6),
    ]
    if msel.status != MselStatus.READY:
        story.append(
            para(
                escape(
                    labels["not_ready"].format(
                        version=msel.version, status=labels["statuses"][msel.status]
                    )
                ),
                "notice",
            )
        )
        story.append(Spacer(1, 4))


def _section(story: list, labels: dict, key: str) -> None:
    story.append(para(escape(labels["sections"][key]), "h2"))
    story.append(Spacer(1, 3))


def _span(minutes: int) -> str:
    """Minutes as "2 d 12 h", "1 h" or "20 min" -- the Scenario tab's format."""
    days, rest = divmod(minutes, 1440)
    hours, mins = divmod(rest, 60)
    parts = [
        f"{days} d" if days else "",
        f"{hours} h" if hours else "",
        f"{mins} min" if mins else "",
    ]
    return " ".join(p for p in parts if p) or "0 min"


def _clock(value: time | None) -> str:
    """A time of day on the 12-hour clock, like the storyline map: "9:30 am",
    "6:45 pm", "12:00 pm" (noon); "—" when not set."""
    if value is None:
        return "—"
    hour = value.hour % 12 or 12
    return f"{hour}:{value.minute:02d} {'am' if value.hour < 12 else 'pm'}"


def _time_jump(minutes: int, fields: dict, separator: str = "<br/>") -> str:
    """A phase's time jump ("48 h later in the incident"), or nothing."""
    if not minutes:
        return ""
    return separator + escape(fields["time_jump"].format(span=_span(minutes)))


def _scenario_rows(msel: MselRead, labels: dict) -> list[tuple[str, str]]:
    fields = labels["fields"]
    compression = (
        escape(fields["compression_value"].format(span=_span(msel.time_compression)))
        if msel.time_compression > 1
        else escape(fields["real_time"])
    )
    return [
        (fields["title"], text(msel.title)),
        (fields["summary"], formatted(msel.summary)),
        (fields["start"], _clock(msel.exercise_start)),
        (
            fields["incident_start"],
            _clock(msel.incident_start),
        ),
        (
            fields["duration"],
            escape(_span(msel.duration_minutes)) if msel.duration_minutes else "—",
        ),
        (fields["compression"], compression),
    ]


def _actions_markup(inject: InjectRead, labels: dict) -> str:
    if not inject.expected_actions:
        return labels["none"]
    lines = []
    for action in inject.expected_actions:
        extra = ", ".join(
            value
            for value in (
                action.responsible_role,
                labels["fields"]["within"].format(minutes=action.expected_within_minutes)
                if action.expected_within_minutes
                else "",
            )
            if value
        )
        lines.append(
            code_ref(action.code, action.description)
            + (f" <font color='#5B6270'>({escape(extra)})</font>" if extra else "")
        )
    return "<br/>".join(lines)


# -- ATT&CK -----------------------------------------------------------------


def _attack_version(msel: MselRead) -> str:
    domains = [
        DOMAIN_NAMES[d] for d in DOMAINS if any(r.domain == d for r in msel.attack_techniques)
    ]
    suffix = f" ({', '.join(domains)})" if domains else ""
    return f"MITRE ATT&CK v{msel.attack_version}{suffix}"


def _techniques_markup(msel: MselRead) -> str:
    """The scenario's techniques grouped by tactic, tactics in matrix order
    (names as frozen in the read model, so snapshots print on their own)."""
    if not msel.attack_techniques:
        return "—"
    lines = []
    for domain in DOMAINS:
        refs = [r for r in msel.attack_techniques if r.domain == domain]
        if not refs:
            continue
        try:
            order = [t.id for t in load_domain(msel.attack_version, domain).tactics]
        except KeyError:
            order = []
        tactic_ids = sorted(
            dict.fromkeys(r.tactic_id for r in refs),
            key=lambda t: order.index(t) if t in order else len(order),
        )
        for tactic_id in tactic_ids:
            group = [r for r in refs if r.tactic_id == tactic_id]
            # The tactic, then its techniques one per line.
            lines.append(f"<b>{escape(group[0].tactic_name)}</b>")
            lines += [code_ref(r.technique_id, r.technique_name) for r in group]
    return "<br/>".join(lines)


def _attack_markup(inject, msel: MselRead, labels: dict) -> str:
    """Whose activity an inject's techniques are, and the techniques --
    for the planning team and whoever runs the session only."""
    if inject.attack_attribution is None:
        return ""
    fields = labels["fields"]
    if inject.attack_attribution == "noise":
        who = fields["noise"]
    else:
        actor = next((t for t in msel.threat_actors if t.id == inject.threat_actor_id), None)
        who = code_ref(actor.code, actor.name) if actor else escape(fields["no_actor"])
    if inject.attack_attribution == "noise":
        who = f"<b>{escape(who)}</b>"
    techniques = [code_ref(r.technique_id, r.technique_name) for r in inject.attack_techniques]
    return "<br/>".join([who, *techniques])


def _threat_actors_grid(msel: MselRead, labels: dict):
    table, fields = labels["table"], labels["fields"]
    return grid(
        [escape(table[k]) for k in ("threat_actor", "aliases", "notes", "techniques")],
        [
            [
                code_ref_cell(t.code, t.name)
                + "<br/><font color='#5B6270'>"
                + (
                    f"MITRE {escape(t.mitre_group_id)}"
                    if t.mitre_group_id
                    else escape(fields["unknown_actor"])
                )
                + "</font>",
                escape(", ".join(t.aliases)) or "—",
                text(t.description),
                str(len(t.techniques)),
            ]
            for t in msel.threat_actors
        ]
        or [["—"] * 4],
        [0.3, 0.22, 0.38, 0.1],
    )


def _attack_copyright(msel: MselRead) -> str:
    try:
        return load_domain(msel.attack_version, DOMAINS[0]).copyright
    except KeyError:
        return "MITRE ATT&CK® is a registered trademark of The MITRE Corporation."


# -- documents --------------------------------------------------------------


def _when(inject: InjectRead, msel: MselRead, labels: dict) -> str:
    """When an inject is delivered, for the planning and control team: its
    T+, or -- contingent -- "on condition" and the minute it's checked."""
    if inject.kind == InjectKind.MANDATORY:
        return _offset(inject.offset_minutes)
    when = escape(labels["contingent_when"])
    phase = next((p for p in msel.phases if p.id == inject.phase_id), None)
    if phase is None or inject.fires_at_minute is None:
        return when
    check = labels["fields"]["check_at"].format(
        time=_offset(phase.start_offset + inject.fires_at_minute)
    )
    return f"{when}<br/><font color='#5B6270'>{escape(check)}</font>"


def _msel_story(story: list, msel: MselRead, labels: dict) -> None:
    fields, table = labels["fields"], labels["table"]
    objectives = {o.id: o for o in msel.needs.objectives}

    def objective_refs(ids, due=()) -> str:
        return ref_lines(
            [
                code_ref(objectives[o].code, objective_name(objectives[o]), cut=40)
                + (f" <font color='#5B6270'>· {escape(fields['due'])}</font>" if o in due else "")
                for o in ids
                if o in objectives
            ]
        )

    actors = {a.id: a.name for a in msel.actors}

    _section(story, labels, "scenario")
    rows = _scenario_rows(msel, labels)
    rows.append((fields["attack_version"], escape(_attack_version(msel))))
    rows.append((fields["techniques"], _techniques_markup(msel)))
    story.append(kv_table(rows))

    _section(story, labels, "threat_actors")
    story.append(_threat_actors_grid(msel, labels))
    if msel.attack_techniques or msel.threat_actors:
        story.append(para(escape(_attack_copyright(msel)), "small"))

    # The storyline map, as the app draws it, on a page of its own turned
    # landscape so it's as large as it gets.
    if msel.phases and msel.injects and msel.duration_minutes:
        story += [NextPageTemplate("landscape"), PageBreak()]
        _section(story, labels, "storyline")
        story.append(
            StorylineFlowable(
                msel,
                LANDSCAPE_CONTENT_WIDTH,
                landscape_content_height(labels["banner"]) - 14 * mm,
                labels["storyline"],
            )
        )
        story += [NextPageTemplate("portrait"), PageBreak()]

    _section(story, labels, "phases")
    story.append(
        grid(
            [escape(table[k]) for k in ("phase", "band", "objectives")],
            [
                [
                    code_ref_cell(p.code, p.name)
                    + f"<br/><font color='#5B6270'>{text(p.situation_update, '')}</font>",
                    f"{_offset(p.start_offset)} – {_offset(p.end_offset)}"
                    + _time_jump(p.incident_jump_minutes, fields),
                    objective_refs(p.objective_ids, p.due_objective_ids),
                ]
                for p in msel.phases
            ]
            or [["—"] * 3],
            [0.38, 0.2, 0.42],
        )
    )

    _section(story, labels, "injects")
    story.append(
        grid(
            [escape(table[k]) for k in ("time", "inject", "from", "to", "objectives", "actions")],
            [
                [
                    _when(i, msel, labels),
                    f"{code_ref(i.code, i.title)}<br/>{formatted(i.content)}"
                    + (f"<br/>{_poll_team_markup(i)}" if i.format == InjectFormat.POLL else "")
                    + (
                        f"<br/><font color='#5B6270'>{escape(fields['artifact'])}: "
                        f"{_artifact_markup(i.artifact, labels)}</font>"
                        if i.artifact
                        else ""
                    )
                    + (
                        f"<br/><font color='#5B6270'>{escape(fields['trigger'])}: "
                        f"{text(i.trigger_condition)}</font>"
                        if i.kind == InjectKind.CONTINGENT
                        else ""
                    )
                    + (
                        f"<br/><font color='#5B6270'>{escape(fields['facilitator_notes'])}: "
                        f"{text(i.facilitator_notes)}</font>"
                        if i.facilitator_notes.strip()
                        else ""
                    )
                    + (
                        f"<br/><font color='#5B6270'>{escape(fields['attribution'])}: "
                        f"{_attack_markup(i, msel, labels)}</font>"
                        if i.attack_attribution
                        else ""
                    ),
                    text(actors.get(i.simulated_actor_id, "")),
                    join(i.recipients)
                    + (
                        f"<br/><font color='#5B6270'>{escape(fields['rooms'])}: "
                        f"{_rooms_markup(i, msel, labels)}</font>"
                        if msel.uses_rooms
                        else ""
                    ),
                    _objectives_cell(i, objective_refs, fields),
                    _actions_markup(i, labels),
                ]
                for i in _ordered(msel)
            ]
            or [["—"] * 6],
            [0.08, 0.3, 0.1, 0.1, 0.18, 0.24],
        )
    )

    _section(story, labels, "coverage")
    coverage_rows = []
    for objective in msel.needs.objectives:
        cells = []
        for phase in [*msel.phases, None]:
            injects = [
                i
                for i in msel.injects
                if objective.id in i.objective_ids and (phase is None or i.phase_id == phase.id)
            ]
            actions = sum(len(i.expected_actions) for i in injects)
            cells.append(f"{len(injects)} / {actions}" if injects else "—")
        coverage_rows.append([code_ref_cell(objective.code, objective_name(objective)), *cells])
    phase_count = len(msel.phases)
    story.append(
        grid(
            [escape(table["objective"])]
            + [code_ref_cell(p.code, p.name) for p in msel.phases]
            + [escape(table["total"])],
            coverage_rows or [["—"] * (phase_count + 2)],
            [0.4] + [0.6 / (phase_count + 1)] * (phase_count + 1),
        )
    )

    _section(story, labels, "actors")
    story.append(
        grid(
            [escape(table[k]) for k in ("name", "type", "played_by")],
            [
                [text(a.name), escape(labels["actor_types"][a.type]), text(a.played_by)]
                for a in msel.actors
            ]
            or [["—"] * 3],
            [0.4, 0.25, 0.35],
        )
    )


def _facilitator_story(
    story: list,
    msel: MselRead,
    labels: dict,
    keyword: str,
    stop_procedure: str = "",
    add_sections=None,
) -> None:
    """`stop_procedure` replaces the default text; `add_sections(story)` adds the
    conduct prep's sections after the stop procedure."""
    fields = labels["fields"]
    actors = {a.id: a.name for a in msel.actors}
    _section(story, labels, "stop")
    story.append(
        para(text(stop_procedure) if stop_procedure else escape(labels["stop_procedure"]), "body")
    )
    story.append(Spacer(1, 3))
    story.append(kv_table([(fields["keyword"], text(keyword))]))
    if add_sections is not None:
        add_sections(story)

    _section(story, labels, "scenario")
    story.append(kv_table(_scenario_rows(msel, labels)))
    if msel.threat_actors:
        _section(story, labels, "threat_actors")
        story.append(_threat_actors_grid(msel, labels))

    ordered = _ordered(msel)
    for phase in msel.phases:
        story.append(
            para(
                f"{code_ref(phase.code, phase.name)} "
                f"<font color='#5B6270'>{_offset(phase.start_offset)} – "
                f"{_offset(phase.end_offset)}"
                f"{_time_jump(phase.incident_jump_minutes, fields, ' · ')}</font>",
                "h2",
            )
        )
        story.append(
            kv_table(
                [
                    (fields["situation_update"], text(phase.situation_update)),
                    (
                        fields["key_questions"],
                        "<br/>".join(f"• {text(q)}" for q in phase.key_questions) or "—",
                    ),
                ]
            )
        )
        story.append(Spacer(1, 4))
        for inject in [i for i in ordered if i.phase_id == phase.id]:
            when = _when(inject, msel, labels)
            rows = [
                (fields["when"], when),
                (fields["from"], text(actors.get(inject.simulated_actor_id, ""))),
                (fields["to"], join(inject.recipients)),
                *(
                    [(fields["rooms"], _rooms_markup(inject, msel, labels))]
                    if msel.uses_rooms
                    else []
                ),
                (fields["method"], escape(labels["delivery_methods"][inject.delivery_method])),
                (fields["content"], formatted(inject.content)),
                *(
                    [(fields["artifact"], _artifact_markup(inject.artifact, labels))]
                    if inject.artifact
                    else []
                ),
            ]
            if inject.kind == InjectKind.CONTINGENT:
                rows.insert(1, (fields["trigger"], text(inject.trigger_condition)))
                rows.insert(2, (fields["purpose"], text(inject.contingent_purpose)))
            if inject.format == InjectFormat.POLL:
                rows.append((fields["poll"], _poll_team_markup(inject)))
            else:
                rows.append((fields["expected_actions"], _actions_markup(inject, labels)))
            rows.append((fields["facilitator_notes"], text(inject.facilitator_notes)))
            if inject.attack_attribution:
                rows.append((fields["attribution"], _attack_markup(inject, msel, labels)))
            story.append(
                KeepTogether(
                    [
                        para(
                            f"{code_ref(inject.code, inject.title)} <font color='#5B6270'>"
                            f"· {escape(labels['kinds'][inject.kind])}</font>",
                            "head",
                        ),
                        kv_table(rows),
                        Spacer(1, 6),
                    ]
                )
            )


def _sitman_story(story: list, sitman: SitmanExport, labels: dict) -> None:
    fields, table = labels["fields"], labels["table"]
    if sitman.stop_keyword:
        _section(story, labels, "stop")
        story.append(
            para(
                text(sitman.stop_procedure)
                if sitman.stop_procedure
                else escape(labels["stop_procedure"]),
                "body",
            )
        )
        story.append(Spacer(1, 3))
        story.append(kv_table([(fields["keyword"], text(sitman.stop_keyword))]))
    _section(story, labels, "scenario")
    compression = (
        escape(fields["compression_value"].format(span=_span(sitman.time_compression)))
        if sitman.time_compression > 1
        else escape(fields["real_time"])
    )
    story.append(
        kv_table(
            [
                (fields["title"], text(sitman.title)),
                (fields["summary"], formatted(sitman.summary)),
                (
                    fields["start"],
                    _clock(sitman.exercise_start),
                ),
                (
                    fields["duration"],
                    escape(_span(sitman.duration_minutes)) if sitman.duration_minutes else "—",
                ),
                (fields["compression"], compression),
            ]
        )
    )
    session = labels.get("cp_fields")
    if session and sitman.session_date:
        rows = [
            (session["date"], escape(sitman.session_date)),
            (session["start"], escape(sitman.session_start) or _clock(sitman.exercise_start)),
            (session["timezone"], text(sitman.timezone)),
        ]
        if sitman.modality:
            rows.append((session["modality"], escape(labels["modalities"][sitman.modality])))
        if sitman.venue:
            rows.append(
                (session["venue"], text(", ".join(v for v in (sitman.venue, sitman.room) if v)))
            )
        if sitman.meeting_link:
            rows.append((session["link"], text(sitman.meeting_link)))
        story.append(para(escape(labels["cp_sections"]["session"]), "h2"))
        story.append(Spacer(1, 3))
        story.append(kv_table(rows))
    _section(story, labels, "objectives")
    story.append(
        grid(
            [escape(table["objective"])],
            [
                [
                    code_ref_cell(o.code, objective_name(o))
                    + (f"<br/>{text(o.statement)}" if o.title.strip() else "")
                ]
                for o in sitman.objectives
            ]
            or [["—"]],
            [1.0],
        )
    )
    _section(story, labels, "roles")
    story.append(para(join(sitman.areas), "body"))
    if session and sitman.facilitators:
        story.append(Spacer(1, 3))
        story.append(kv_table([(session["facilitators"], join(sitman.facilitators))]))
    _section(story, labels, "phases")
    story.append(
        grid(
            [escape(table["name"]), escape(table["band"])],
            [
                [text(p.name), f"{_offset(p.start_offset)} – {_offset(p.end_offset)}"]
                for p in sitman.phases
            ]
            or [["—", "—"]],
            [0.6, 0.4],
        )
    )
    _section(story, labels, "rules")
    for rule in (*labels["rules"], *labels.get("sitman_rules", ())):
        story.append(para(f"• {escape(rule)}", "body"))


def _cards_story(story: list, cards: InjectCardsExport, labels: dict) -> None:
    fields = labels["fields"]
    for index, card in enumerate(cards.cards):
        if index:
            story.append(Spacer(1, 10))
        when = (
            _offset(card.offset_minutes)
            if card.kind == InjectKind.MANDATORY
            else escape(labels["contingent_when"])
        )
        # A poll goes straight to the Players: no one sends it.
        delivery = (
            []
            if card.poll_question
            else [
                [para(escape(fields["from"]), "label"), para(text(card.sender))],
                [para(escape(fields["to"]), "label"), para(join(card.recipients))],
                [
                    para(escape(fields["method"]), "label"),
                    para(escape(labels["delivery_methods"][card.delivery_method])),
                ],
            ]
        )
        rows = [
            [para(code_ref(card.code, card.title), "head"), ""],
            *delivery,
            [para(escape(fields["when"]), "label"), para(f"{when} · {text(card.phase)}")],
            [para(formatted(card.content), "body"), ""],
        ]
        if card.poll_question:
            rows.append([para(escape(fields["poll_options"]), "label"), para(_poll_markup(card))])
        if card.artifact:
            rows.append(
                [
                    para(escape(fields["artifact"]), "label"),
                    para(_artifact_markup(card.artifact, labels)),
                ]
            )
        if card.attachment_notes:
            rows.append(
                [
                    para(escape(fields["attachments"]), "label"),
                    para("<br/>".join(text(n) for n in card.attachment_notes)),
                ]
            )
        if card.files:
            rows.append(
                [
                    para(escape(fields["files"]), "label"),
                    para(
                        "<br/>".join(
                            f"{text(f.name)} · {_file_size(f.size_bytes)} · "
                            f"SHA-256 {f.sha256[:16]}…"
                            + (f"<br/>{text(f.description)}" if f.description.strip() else "")
                            for f in card.files
                        )
                    ),
                ]
            )
        box = Table(rows, colWidths=[30 * mm, CONTENT_WIDTH - 30 * mm])
        box.setStyle(
            TableStyle(
                [
                    ("SPAN", (0, 0), (1, 0)),
                    ("SPAN", (0, 5), (1, 5)),
                    ("BACKGROUND", (0, 0), (1, 0), BAND),
                    ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                    ("LINEBELOW", (0, 0), (-1, -2), 0.3, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 5), (1, 5), 8),
                    ("BOTTOMPADDING", (0, 5), (1, 5), 10),
                ]
            )
        )
        story.append(KeepTogether([box]))
        for image in card.images:
            # Scaled to the column and at most 90 mm high; a small image keeps
            # its screen size (0.75 pt per pixel), never blown up.
            scale = min(CONTENT_WIDTH / image.width, (90 * mm) / image.height, 0.75)
            flowables = [Spacer(1, 4), Image(image.path, image.width * scale, image.height * scale)]
            if image.caption.strip():
                flowables.append(para(text(image.caption), "small"))
            story.append(KeepTogether(flowables))


def _generated(story: list, labels: dict, locale: str) -> None:
    story.append(Spacer(1, 8))
    story.append(
        para(
            escape(
                labels["generated"].format(
                    date=format_date(
                        datetime.now(UTC), NEEDS_LABELS.get(locale, NEEDS_LABELS["en"])["months"]
                    )
                )
            ),
            "small",
        )
    )


def render_msel_pdf(session: Session, ttx: TTX, kind: ExportKind, locale: str) -> tuple[bytes, str]:
    """The PDF bytes and its file name ({code}_{kind}_v{version}_{TLP}.pdf)."""
    labels = LABELS.get(locale, LABELS["en"])
    msel = _source(session, ttx)
    story: list = []
    _heading(story, labels, kind, ttx, msel)
    _msel_story(story, msel, labels)
    _generated(story, labels, locale)
    title = labels["titles"][kind]
    content = build_pdf(
        story,
        header=f"{ttx.code} · {title} · {labels['version']} {msel.version}",
        title=f"{ttx.code} {title}",
        tlp=msel.needs.tlp,
        labels=labels,
        banner=labels["banner"],
        landscape_pages=True,
    )
    return content, f"{ttx.code}_{kind}_v{msel.version}_{tlp_file_part(msel.needs.tlp)}.pdf"
