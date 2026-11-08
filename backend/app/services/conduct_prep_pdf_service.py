"""The session documents (Creator -> Session plan), one per audience:

- `sitman` -- the Situation Manual Players get before the session, with
  the session's date, place and Facilitators;
- `facilitator-guide` -- the whole MSEL by phase, the stop procedure, the
  session schedule and who evaluates what;
- `inject-cards` -- one card per inject for the Controllers;
- `eeg` -- the definitive EEGs, each observation point with what every
  rating level means;
- `evaluation-plan` -- for the evaluator briefing: assignments, data
  collection, briefing, calendar and the rules for evaluators;
- `feedback-form` -- what every participant fills in after the hot wash.

Content safety stays structural, as in msel_pdf_service: the Players'
documents (SitMan, feedback form) are built from export schemas with no
field for injects, expected actions, notes or triggers. The SitMan does
carry the stop procedure and keyword, which every participant must know.
The MSEL comes from its frozen READY snapshot when there is one; the plan
from its READY snapshot when it is ready, else live with a "not final"
notice. Every page carries the TLP label and the EXERCISE band."""

from datetime import date, timedelta
from html import escape
from typing import Literal

from pydantic import BaseModel
from reportlab.platypus import KeepTogether, PageBreak, Spacer
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import TTX, ConductPrepStatus, RoleEnum, TTXAccess, User
from app.schemas.ttx_conduct_prep import ConductPrepRead
from app.schemas.ttx_evaluation import ExpectedNotificationRead
from app.schemas.ttx_msel import MselRead
from app.schemas.ttx_needs_form import ValidationReport
from app.services.conduct_prep_pdf_labels import LABELS as CP_LABELS
from app.services.eeg_service import due_phases, notification_reference
from app.services.exercise_run_service import DEFAULT_STOP_KEYWORD
from app.services.msel_image_service import msel_image_files
from app.services.msel_pdf_labels import LABELS as MSEL_LABELS
from app.services.msel_pdf_service import (
    _cards_story,
    _clock,
    _facilitator_story,
    _generated,
    _heading,
    _offset,
    _sitman_story,
    _source,
    inject_cards_export,
    sitman_export,
)
from app.services.needs_pdf_labels import LABELS as NEEDS_LABELS
from app.services.needs_pdf_service import evidence_cell, measure_lines
from app.services.objective_text import objective_name
from app.services.pdf_common import (
    build_pdf,
    code_ref,
    format_date,
    grid,
    join,
    kv_table,
    para,
    text,
    tlp_file_part,
)
from app.services.ttx_conduct_prep_service import (
    CALENDAR_FIELDS,
    _objectives,
    find_prep,
    latest_prep_snapshot,
    prep_read,
)
from app.services.ttx_needs_form_service import get_form

ExportKind = Literal[
    "sitman", "facilitator-guide", "inject-cards", "eeg", "evaluation-plan", "feedback-form"
]
LEVELS = ("p", "s", "m", "u")


class FeedbackFormExport(BaseModel):
    """What the participant feedback form prints: the exercise and its
    objectives, nothing of the scenario."""

    objectives: list[tuple[str, str]]
    session_date: str


def _labels(locale: str) -> dict:
    base = MSEL_LABELS.get(locale, MSEL_LABELS["en"])
    extra = CP_LABELS.get(locale, CP_LABELS["en"])
    return {**base, **extra, "titles": {**base["titles"], **extra["titles"]}}


def _prep_source(session: Session, ttx: TTX) -> ConductPrepRead:
    prep = find_prep(session, ttx.id)
    if prep is None:
        raise AppException("CONDUCT_PREP_NOT_FOUND", "Open the conduct prep first.", 404)
    live = prep_read(session, ttx, prep)
    if live.status == ConductPrepStatus.READY:
        snapshot = latest_prep_snapshot(session, ttx.id)
        if snapshot is not None and snapshot.version == live.version:
            empty = ValidationReport(ready=[], approved=[], warnings=[])
            return ConductPrepRead.model_validate({**snapshot.payload, "validation": empty})
    return live


def _stop_keyword(session: Session, ttx: TTX) -> str:
    """The needs analysis' stop keyword, or the one the Playground's REAL
    WORLD button asks for when none was agreed."""
    return get_form(session, ttx.id).stop_exercise_keyword.strip() or DEFAULT_STOP_KEYWORD


def _facilitators(session: Session, ttx: TTX) -> list[str]:
    return list(
        session.exec(
            select(User.full_name)
            .join(TTXAccess, TTXAccess.user_id == User.id)
            .where(
                TTXAccess.ttx_id == ttx.id,
                TTXAccess.role == RoleEnum.PLANNER,
                TTXAccess.facilitates,
            )
            .order_by(User.full_name)
        )
    )


def _section(story: list, labels: dict, key: str) -> None:
    story.append(para(escape(labels["cp_sections"][key]), "h2"))
    story.append(Spacer(1, 3))


def _day(value, months: list[str]) -> str:
    return format_date(value, months) if value else ""


def _deadline(days: int, session_date: date | None, labels: dict, months: list[str]) -> str:
    """A calendar milestone: days after the session, with its date once the
    session has one."""
    calendar = labels["calendar"]
    deadline = calendar["same_day"] if days == 0 else calendar["days_after"].format(days=days)
    if session_date is None:
        return deadline
    return calendar["on_date"].format(
        deadline=deadline, date=format_date(session_date + timedelta(days=days), months)
    )


def _session_rows(prep: ConductPrepRead, labels: dict, months: list[str]) -> list:
    fields = labels["cp_fields"]
    rows = [
        (fields["date"], escape(_day(prep.session_date, months)) or "—"),
        (fields["start"], _clock(prep.session_time)),
        (fields["timezone"], text(prep.timezone)),
    ]
    if prep.modality:
        rows.append((fields["modality"], escape(labels["modalities"][prep.modality])))
    if prep.venue:
        rows.append((fields["venue"], text(", ".join(v for v in (prep.venue, prep.room) if v))))
    if prep.meeting_link:
        rows.append((fields["link"], text(prep.meeting_link)))
    return rows


def _person(prep: ConductPrepRead, user_id) -> str:
    people = {p.user_id: p.full_name for p in prep.context.team_members}
    return people.get(user_id, "")


def _roster(prep: ConductPrepRead, labels: dict) -> list:
    """The evaluators and what each covers (codes are named with titles)."""
    table = labels["cp_table"]
    eeg = {o.id: o for o in prep.eeg}
    rows = [
        [
            text(e.full_name),
            "<br/>".join(
                code_ref(eeg[o].code, objective_name(eeg[o]), 60)
                for o in e.objective_ids
                if o in eeg
            )
            or "—",
            join(e.areas),
        ]
        for e in prep.evaluators
    ]
    return [
        grid(
            [
                escape(h)
                for h in (
                    table["evaluator"],
                    table["objectives"],
                    table["areas"],
                )
            ],
            rows or [["—"] * 3],
            [0.25, 0.5, 0.25],
        )
    ]


def _evaluation_summary(
    story: list, prep: ConductPrepRead, labels: dict, months: list[str]
) -> None:
    fields = labels["cp_fields"]
    lead = prep.context.lead_evaluator
    story.append(
        kv_table(
            [
                (fields["lead_evaluator"], text(lead.full_name if lead else "")),
                (fields["log_keeper"], text(_person(prep, prep.log_keeper_id))),
            ]
        )
    )
    story.append(Spacer(1, 4))
    story += _roster(prep, labels)
    _section(story, labels, "calendar")
    story.append(
        kv_table(
            [
                (
                    labels["calendar"][field],
                    escape(_deadline(getattr(prep, field), prep.session_date, labels, months)),
                )
                for field in CALENDAR_FIELDS
            ]
        )
    )


def _eeg_story(
    story: list,
    prep: ConductPrepRead,
    labels: dict,
    measures: dict,
    needs_labels: dict,
    deadlines: dict | None = None,
) -> None:
    """`measures`: the needs objectives by id, for how each one is judged
    (rule, time box, rating guidance) and the evidence to collect.
    `deadlines`: the MSEL phases each objective is due by the end of."""
    story.append(para(escape(labels["eeg_intro"]), "body"))
    story.append(Spacer(1, 3))
    # The common scale, once; a point prints only the levels it adjusts.
    story.append(
        grid(
            [escape(labels["cp_table"]["level"]), escape(labels["cp_table"]["criterion"])],
            [
                [escape(name), escape(definition)]
                for name, definition in zip(
                    labels["ratings"], labels["level_definitions"], strict=True
                )
            ],
            [0.35, 0.65],
        )
    )
    names = {}
    for evaluator in prep.evaluators:
        for objective_id in evaluator.objective_ids:
            names.setdefault(objective_id, []).append(evaluator.full_name)
    level_names = dict(zip(LEVELS, labels["ratings"], strict=True))
    within = labels["fields"]["within"]
    for index, objective in enumerate(prep.eeg):
        if index:
            story.append(PageBreak())
        assigned = names.get(objective.id)
        story += [
            para(code_ref(objective.code, objective_name(objective)), "h2"),
            # The full statement: it's what the evaluator rates against.
            *([para(text(objective.statement), "body")] if objective.title.strip() else []),
            para(
                escape(
                    labels["evaluated_by"].format(names=", ".join(assigned))
                    if assigned
                    else labels["unassigned"]
                ),
                "small",
            ),
        ]
        measured = measures.get(objective.objective_id)
        if measured is not None and measured.time_box_minutes:
            story.append(
                para(
                    escape(
                        needs_labels["measure"]["time_box"].format(
                            minutes=measured.time_box_minutes
                        )
                    ),
                    "small",
                )
            )
        due = (deadlines or {}).get(str(objective.objective_id), [])
        if due:
            story.append(
                para(
                    escape(needs_labels["measure"]["due"])
                    + " "
                    + ", ".join(
                        f"{code_ref(p.code, p.name)} ({_offset(p.end_offset)})" for p in due
                    ),
                    "small",
                )
            )
        story += [
            Spacer(1, 4),
            para(escape(labels["observation_points"]), "head"),
        ]
        for point in objective.points:
            adjusted = [
                [escape(level_names[level]), text(getattr(point, f"criteria_{level}"))]
                for level in LEVELS
                if getattr(point, f"criteria_{level}").strip()
            ]
            source = ""
            if point.source_inject_code:
                ref = code_ref(point.source_inject_code, point.source_inject_title)
                source = f"<br/><font color='#5B6270'>{ref}"
                if point.expected_within_minutes:
                    source += f" ({escape(within.format(minutes=point.expected_within_minutes))})"
                source += "</font>"
            story.append(
                KeepTogether(
                    [
                        para(f"[ ] {text(point.text)}{source}", "body"),
                        Spacer(1, 2),
                        *(
                            [
                                grid(
                                    [
                                        escape(labels["cp_table"]["level"]),
                                        escape(labels["cp_table"]["criterion"]),
                                    ],
                                    adjusted,
                                    [0.35, 0.65],
                                )
                            ]
                            if adjusted
                            else []
                        ),
                        Spacer(1, 6),
                    ]
                )
            )
        if measured is not None and measured.evidence.strip():
            story += [
                Spacer(1, 2),
                para(escape(needs_labels["table"]["evidence"]), "head"),
                para(evidence_cell(measured, "[ ]"), "body"),
                Spacer(1, 4),
            ]
        if measured is not None:
            story.append(_rating_grid(measured, labels, needs_labels["measure"]))
            story.append(Spacer(1, 2))
            story.append(kv_table([(labels["notes"], "<br/><br/><br/>")]))
        else:
            story.append(
                kv_table(
                    [
                        (labels["table"]["rating"], "P  [ ]     S  [ ]     M  [ ]     U  [ ]"),
                        (labels["notes"], "<br/><br/><br/>"),
                    ]
                )
            )


def _rating_grid(objective, labels: dict, measure: dict):
    """The objective's rating: the common scale's boxes, each beside what
    that outcome means here -- P or S achieved (the rule from its
    conditions, and a note), M partially, U not achieved (blank: the
    common definition, muted)."""
    levels = measure["levels"]
    definitions = labels["level_definitions"]
    muted = "<font color='#5B6270'>{}</font>"

    def meaning(name: str, own: str, fallback: str) -> str:
        body = text(own) if own.strip() else muted.format(escape(fallback))
        return f"<b>{escape(name)}</b><br/>{body}"

    # The rule is measure_lines' first sentence when there are conditions.
    rule = measure_lines(objective, measure)[:1] if objective.success_criterion.strip() else []
    achieved = "<br/>".join(
        [escape(line) for line in rule]
        + ([text(objective.achieved_note)] if objective.achieved_note.strip() else [])
    )
    return grid(
        [escape(labels["table"]["rating"]), escape(labels["cp_table"]["criterion"])],
        [
            [
                "[ ] P&nbsp;&nbsp;&nbsp;[ ] S",
                f"<b>{escape(levels['achieved'])}</b><br/>"
                + (achieved or muted.format(escape(definitions[0]))),
            ],
            ["[ ] M", meaning(levels["partial"], objective.partially_achieved, definitions[2])],
            ["[ ] U", meaning(levels["not"], objective.not_achieved, definitions[3])],
        ],
        [0.22, 0.78],
    )


def _notifications_story(
    story: list, notifications: list[ExpectedNotificationRead], labels: dict, spanish: bool
) -> None:
    """The observers' notification reference: one row per report of every
    regime the objectives cite, with marks to tick and room for notes."""
    copy = labels["notifications"]
    columns = copy["columns"]
    story += [
        PageBreak(),
        para(escape(copy["title"]), "h2"),
        Spacer(1, 3),
        para(escape(copy["intro"]), "body"),
        Spacer(1, 2),
        para(escape(copy["legend"]), "small"),
        Spacer(1, 4),
    ]
    for item in notifications:
        label = item.framework_label_es if spanish else item.framework_label_en
        regime = (
            f"<b>{escape(label)} {escape(item.reference)}</b><br/>"
            f"<font color='#5B6270'>"
            f"{escape(copy['cited_by'].format(codes=', '.join(item.objective_codes)))}</font>"
        )
        rows = []
        for index, m in enumerate(item.milestones):
            report = f"{escape(m.stage_es if spanish else m.stage_en)}<br/>" + (
                f"<font color='#5B6270'>{escape(m.recipient_es if spanish else m.recipient_en)}"
                "</font>"
            )
            rows.append(
                [
                    regime if index == 0 else "",
                    report,
                    escape(m.deadline_es if spanish else m.deadline_en),
                    escape(m.clock_es if spanish else m.clock_en),
                    escape(copy["marks"]),
                ]
            )
        story.append(
            KeepTogether(
                [
                    grid(
                        [escape(columns[key]) for key in columns],
                        rows,
                        [0.19, 0.25, 0.13, 0.2, 0.23],
                    ),
                    Spacer(1, 2),
                    kv_table([(copy["notes"], "<br/><br/>")]),
                    Spacer(1, 8),
                ]
            )
        )


def _evaluation_plan_story(
    story: list, prep: ConductPrepRead, labels: dict, months: list[str]
) -> None:
    fields = labels["cp_fields"]
    _section(story, labels, "session")
    story.append(kv_table(_session_rows(prep, labels, months)))
    _section(story, labels, "evaluators")
    _evaluation_summary(story, prep, labels, months)
    _section(story, labels, "data")
    methods = [labels["methods"][m] for m in prep.data_collection_methods if m != "other"]
    if "other" in prep.data_collection_methods and prep.data_collection_other:
        methods.append(prep.data_collection_other)
    story.append(kv_table([(fields["methods"], join(methods))]))
    _section(story, labels, "briefing")
    story.append(
        kv_table(
            [
                (fields["briefing_date"], escape(_day(prep.briefing_date, months)) or "—"),
                (
                    fields["briefing_covers"],
                    "<br/>".join(
                        f"• {escape(labels['briefing_items'][item])}"
                        for item in prep.briefing_checklist
                    )
                    or "—",
                ),
            ]
        )
    )
    if prep.briefing_notes.strip():
        story.append(Spacer(1, 3))
        story.append(para(text(prep.briefing_notes), "body"))
    _section(story, labels, "non_intervention")
    for rule in labels["non_intervention"]:
        story.append(para(f"• {escape(rule)}", "body"))
    _section(story, labels, "ratings")
    for rating in labels["ratings"]:
        story.append(para(escape(rating), "body"))


def _feedback_story(story: list, form: FeedbackFormExport, labels: dict) -> None:
    fields, table = labels["cp_fields"], labels["cp_table"]
    story.append(para(escape(labels["feedback_intro"]), "body"))
    _section(story, labels, "participant")
    story.append(kv_table([(fields["name"], "<br/>"), (fields["area"], "<br/>")]))
    _section(story, labels, "conduct")
    statements = list(labels["feedback_items"]) + [
        labels["objective_item"].format(objective=f"{code} | {statement}")
        for code, statement in form.objectives
    ]
    story.append(
        grid(
            [escape(table["statement"]), escape(table["score"])],
            [[escape(s), "[ ]  [ ]  [ ]  [ ]  [ ]"] for s in statements],
            [0.7, 0.3],
        )
    )
    for key in ("strengths", "improvements", "plans", "comments"):
        _section(story, labels, key)
        story.append(kv_table([("", "<br/><br/><br/><br/>")]))


def render_conduct_prep_pdf(
    session: Session, ttx: TTX, kind: ExportKind, locale: str
) -> tuple[bytes, str]:
    """The PDF bytes and its file name ({code}_{kind}_v{plan}_{TLP}.pdf)."""
    labels = _labels(locale)
    months = NEEDS_LABELS.get(locale, NEEDS_LABELS["en"])["months"]
    msel: MselRead = _source(session, ttx)
    prep = _prep_source(session, ttx)
    spanish = locale.startswith("es")
    notifications = (
        notification_reference(_objectives(session, get_form(session, ttx.id)))
        if kind in ("eeg", "facilitator-guide")
        else []
    )
    story: list = []
    _heading(story, labels, kind, ttx, msel)
    if prep.status != ConductPrepStatus.READY:
        story.append(para(escape(labels["plan_not_ready"].format(version=prep.version)), "notice"))
        story.append(Spacer(1, 4))

    if kind == "sitman":
        sitman = sitman_export(
            msel,
            exercise_start=prep.session_time,
            session_date=_day(prep.session_date, months),
            timezone=prep.timezone,
            modality=prep.modality.value if prep.modality else None,
            venue=prep.venue,
            room=prep.room,
            meeting_link=prep.meeting_link,
            facilitators=_facilitators(session, ttx),
            stop_procedure=prep.stop_procedure,
            stop_keyword=_stop_keyword(session, ttx),
        )
        _sitman_story(story, sitman, labels)
    elif kind == "facilitator-guide":
        keyword = _stop_keyword(session, ttx)

        def plan_sections(target: list) -> None:
            _section(target, labels, "session")
            target.append(kv_table(_session_rows(prep, labels, months)))
            _section(target, labels, "evaluation")
            _evaluation_summary(target, prep, labels, months)

        _facilitator_story(story, msel, labels, keyword, prep.stop_procedure, plan_sections)
        if notifications:
            _notifications_story(story, notifications, labels, spanish)
    elif kind == "inject-cards":
        _cards_story(story, inject_cards_export(msel, msel_image_files(session, msel.id)), labels)
    elif kind == "eeg":
        needs_labels = NEEDS_LABELS.get(locale, NEEDS_LABELS["en"])
        measures = {o.id: o for o in _objectives(session, get_form(session, ttx.id))}
        _eeg_story(
            story,
            prep,
            labels,
            measures,
            needs_labels,
            due_phases([p.model_dump(mode="json") for p in msel.phases]),
        )
        if notifications:
            _notifications_story(story, notifications, labels, spanish)
    elif kind == "evaluation-plan":
        _evaluation_plan_story(story, prep, labels, months)
    else:
        form = FeedbackFormExport(
            objectives=[(o.code, objective_name(o)) for o in prep.eeg if not o.orphaned],
            session_date=_day(prep.session_date, months),
        )
        if form.session_date:
            story.append(para(escape(form.session_date), "subtitle"))
        _feedback_story(story, form, labels)

    _generated(story, labels, locale)
    title = labels["titles"][kind]
    content = build_pdf(
        story,
        header=(
            f"{ttx.code} · {title} · {labels['plan_version']} {prep.version} · MSEL {msel.version}"
        ),
        title=f"{ttx.code} {title}",
        tlp=msel.needs.tlp,
        labels=labels,
        banner=labels["banner"],
    )
    return content, f"{ttx.code}_{kind}_v{prep.version}_{tlp_file_part(msel.needs.tlp)}.pdf"
