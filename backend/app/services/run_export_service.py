"""The Playground's exports, for the team: the execution log (PDF and CSV,
every event in order) and the draft after-action report (PDF) built from
the session -- ratings, expected actions, injects, the team's notes, the
participants' feedback and the plan's calendar. Never a Player's notes;
TLP-labelled and marked EXERCISE like every exercise document."""

import csv
import io
import uuid
from collections import Counter
from datetime import UTC, datetime
from html import escape
from zoneinfo import ZoneInfo

from reportlab.platypus import Spacer
from sqlmodel import Session, select

from app.models import (
    TTX,
    ConductPrepSnapshot,
    ExerciseRun,
    MselSnapshot,
    RunEvent,
    RunEventType,
    RunNote,
    RunPresence,
    RunRating,
    TTXContextRole,
    User,
)
from app.services.exercise_run_service import (
    decision_log,
    feedback_results,
    played_minutes,
    run_meters,
    run_of,
    started_run,
    summary,
)
from app.services.msel_pdf_labels import LABELS as MSEL_LABELS
from app.services.pdf_common import (
    build_pdf,
    code_ref,
    formatted,
    grid,
    kv_table,
    para,
    tlp_file_part,
)
from app.services.run_pdf_labels import LABELS as RUN_LABELS
from app.services.ttx_needs_form_service import get_form


def _labels(locale: str) -> dict:
    base = MSEL_LABELS.get(locale, MSEL_LABELS["en"])
    extra = RUN_LABELS.get(locale, RUN_LABELS["en"])
    return {**base, **extra, "titles": {**base["titles"], **extra["titles"]}}


def _offset(minutes: int) -> str:
    return f"T+{minutes // 60:02d}:{minutes % 60:02d}"


def _room_mark(room_code: str | None) -> str:
    """ "RM-01 · " before what happened in a room; nothing for the main room
    or without rooms."""
    return f"{room_code} · " if room_code and room_code != "main" else ""


class _Context:
    """What every export reads: the run, its snapshots, who did what."""

    def __init__(self, session: Session, ttx: TTX, locale: str, run_id: uuid.UUID | None = None):
        self.session, self.ttx, self.locale = session, ttx, locale
        self.labels = _labels(locale)
        # The current run, or a previous one named by the caller.
        self.run: ExerciseRun = (
            run_of(session, ttx, run_id) if run_id else started_run(session, ttx)
        )
        self.msel = session.get(MselSnapshot, self.run.msel_snapshot_id).payload
        self.plan = session.get(ConductPrepSnapshot, self.run.plan_snapshot_id).payload
        self.tlp = get_form(session, ttx.id).tlp.value
        try:
            self.zone = ZoneInfo(self.plan.get("timezone") or "UTC")
        except (KeyError, ValueError):
            self.zone = UTC
        self.events = list(
            session.exec(
                select(RunEvent).where(RunEvent.run_id == self.run.id).order_by(RunEvent.seq)
            )
        )
        ids = {e.actor_id for e in self.events}
        self.names = {u.id: u.full_name for u in session.exec(select(User).where(User.id.in_(ids)))}
        self.injects = {i["code"]: i for i in self.msel["injects"]}
        self.actions = {
            a["code"]: (i["code"], a) for i in self.msel["injects"] for a in i["expected_actions"]
        }

    def rows(self) -> list[tuple[str, str, str, str, str]]:
        """(T+, time, event, detail, by) per event, as plain text."""
        events, marks = self.labels["events"], self.labels["marks"]
        out = []
        # What a decision says and what a vote asks, as the log goes.
        decisions: dict[str, str] = {}
        polls: dict[str, dict] = {}
        for event in self.events:
            p, kind = event.payload, event.type.value
            by = self.names.get(event.actor_id, "")
            if event.type in (
                RunEventType.INJECT_RELEASED,
                RunEventType.INJECT_RESENT,
                RunEventType.INJECT_SKIPPED,
            ):
                inject = self.injects.get(p["inject_code"], {})
                detail = f"{p['inject_code']} | {inject.get('title', '')}"
                if p.get("reason"):
                    detail += " — " + self.labels["reason"].format(reason=p["reason"])
            elif event.type == RunEventType.ENDEX:
                detail = f"ENDEX | {p['title']}"
            elif event.type == RunEventType.QUESTIONS_RELEASED:
                detail = f"{_room_mark(p.get('room_code'))}{p['inject_code']}: " + " / ".join(
                    p["questions"]
                )
            elif event.type == RunEventType.QUESTION_COVERED:
                kind = "question_covered" if p["covered"] else "question_uncovered"
                phase = next((x for x in self.msel["phases"] if x["code"] == p["phase_code"]), None)
                questions = phase["key_questions"] if phase else []
                detail = questions[p["position"]] if p["position"] < len(questions) else ""
                detail = _room_mark(p.get("room_code")) + detail
            elif event.type == RunEventType.ACTION_MARKED:
                _, action = self.actions.get(p["action_code"], ("", {}))
                detail = (
                    f"{p['action_code']} | {action.get('description', '')} — "
                    f"{marks.get(p['mark'], p['mark'])}"
                )
                if p.get("note"):
                    detail += f" ({p['note']})"
            elif event.type == RunEventType.PAUSE and p.get("real_world"):
                detail = self.labels["real_world"]
            elif event.type == RunEventType.STOP:
                detail = self.labels["reason"].format(reason=p.get("reason", ""))
            elif event.type == RunEventType.PLAYERS_MOVED:
                rooms = self.labels["rooms"]
                detail = rooms["to_main" if p["to"] == "main" else "to_room"].format(
                    count=len(p["user_ids"])
                )
            elif event.type == RunEventType.PLAYERS_SEATED:
                detail = self.labels["rooms"]["seated"].format(count=len(p["assignments"]))
            elif event.type == RunEventType.MAIN_PROJECTED:
                code = p.get("inject_code")
                detail = (
                    f"{code} | {self.injects.get(code, {}).get('title', '')}"
                    if code
                    else self.labels["rooms"]["nothing"]
                )
            elif event.type in (RunEventType.DECISION_RECORDED, RunEventType.DECISION_EDITED):
                decisions[p["decision_id"]] = p["text"]
                place = p.get("room_code")
                detail = (f"{p['inject_code']} | " if p.get("inject_code") else "") + p["text"]
                if place:
                    detail += f" [{place}]"
            elif event.type == RunEventType.DECISION_DELETED:
                detail = decisions.get(p["decision_id"], "")
            elif event.type == RunEventType.POLL_OPENED:
                polls[p["poll_id"]] = p
                detail = f"{p['inject_code']} | {p['question']}: " + " / ".join(p["options"])
            elif event.type == RunEventType.VOTE_CAST:
                poll = polls.get(p["poll_id"], {})
                options = poll.get("options", [])
                choice = options[p["option"]] if p["option"] < len(options) else ""
                detail = f"{poll.get('question', '')} → {choice}"
                # Votes stay anonymous, in the log too.
                by = "—"
            elif event.type in (RunEventType.POLL_CLOSED, RunEventType.POLL_RESULTS_SHOWN):
                poll = polls.get(p["poll_id"], {})
                detail = poll.get("question", "")
                chosen = p.get("outcome_option")
                if chosen is not None and chosen < len(poll.get("options", [])):
                    detail += f" → {poll['options'][chosen]}"
            else:
                detail = ""
            minutes = int((event.at - self.run.started_at).total_seconds() // 60)
            out.append(
                (
                    _offset(max(0, minutes)),
                    event.at.astimezone(self.zone).strftime("%H:%M"),
                    events.get(kind, kind),
                    detail,
                    by,
                )
            )
        return out

    def pdf(self, kind: str, story: list) -> tuple[bytes, str]:
        title = self.labels["titles"][kind]
        content = build_pdf(
            story,
            header=f"{self.ttx.code} · {title}",
            title=f"{self.ttx.code} {title}",
            tlp=self.tlp,
            labels=self.labels,
            banner=self.labels["banner"],
        )
        return content, f"{self.ttx.code}_{kind}_{tlp_file_part(self.tlp)}.pdf"

    def heading(self, kind: str) -> list:
        return [
            para(escape(self.labels["titles"][kind]), "title"),
            para(escape(f"{self.ttx.code} · {self.ttx.name}"), "subtitle"),
            Spacer(1, 6),
        ]


def render_log_pdf(
    session: Session, ttx: TTX, locale: str, run_id: uuid.UUID | None = None
) -> tuple[bytes, str]:
    ctx = _Context(session, ttx, locale, run_id)
    columns = ctx.labels["columns"]
    story = ctx.heading("log")
    story.append(
        grid(
            [escape(columns[k]) for k in ("t", "clock", "event", "detail", "by")],
            [[escape(cell) for cell in row] for row in ctx.rows()],
            [0.09, 0.08, 0.2, 0.45, 0.18],
        )
    )
    return ctx.pdf("log", story)


def render_log_csv(
    session: Session, ttx: TTX, locale: str, run_id: uuid.UUID | None = None
) -> tuple[bytes, str]:
    """The same rows as the PDF, as UTF-8 CSV with a BOM (opens cleanly in
    spreadsheets)."""
    ctx = _Context(session, ttx, locale, run_id)
    columns = ctx.labels["columns"]
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([columns[k] for k in ("t", "clock", "event", "detail", "by")])
    for row in ctx.rows():
        # A cell starting like a formula is kept as text.
        writer.writerow(
            ["'" + c if c[:1] in ("=", "+", "-", "@") and c[:2] != "T+" else c for c in row]
        )
    return ("﻿" + buffer.getvalue()).encode(), f"{ttx.code}_log_{tlp_file_part(ctx.tlp)}.csv"


def _session_table(ctx: "_Context", story: list) -> None:
    """When the session ran, for how long, who took part, why it stopped."""
    labels, fields, run, ttx = ctx.labels, ctx.labels["fields"], ctx.run, ctx.ttx

    def when(value: datetime | None) -> str:
        return value.astimezone(ctx.zone).strftime("%Y-%m-%d %H:%M") if value else "—"

    present = ctx.session.exec(select(RunPresence).where(RunPresence.ttx_id == ttx.id)).all()
    per_role = Counter(row.role for row in present)
    rows = [
        (fields["exercise"], escape(f"{ttx.code} · {ttx.name}")),
        (fields["started"], escape(when(run.started_at))),
        (fields["ended"], escape(when(run.ended_at))),
        (fields["played"], escape(_offset(played_minutes(run)))),
        (
            fields["participants"],
            escape(
                " · ".join(
                    f"{labels['roles'][role]}: {per_role[role]}"
                    for role in labels["roles"]
                    if per_role.get(role)
                )
                or "—"
            ),
        ),
    ]
    if run.stop_reason:
        rows.append((fields["stopped"], escape(run.stop_reason)))
    story.append(kv_table(rows))


def render_aar_pdf(session: Session, ttx: TTX, locale: str) -> tuple[bytes, str]:
    ctx = _Context(session, ttx, locale)
    labels, sections = ctx.labels, ctx.labels["sections"]
    run = ctx.run
    story = ctx.heading("aar")
    story.append(para(escape(labels["draft"]), "notice"))

    def section(key: str) -> None:
        story.append(para(escape(sections[key]), "h2"))
        story.append(Spacer(1, 3))

    def when(value: datetime | None) -> str:
        return value.astimezone(ctx.zone).strftime("%Y-%m-%d %H:%M") if value else "—"

    # 1. Exercise and session
    section("session")
    _session_table(ctx, story)

    # 2. Objectives: each point's ratings, with why and by whom, and what
    # the Controller saw of its expected action.
    section("objectives")
    ratings = session.exec(select(RunRating).where(RunRating.run_id == run.id)).all()
    raters = {
        u.id: u.full_name
        for u in session.exec(select(User).where(User.id.in_({r.evaluator_id for r in ratings})))
    }
    by_point: dict[str, list[RunRating]] = {}
    for rating in ratings:
        by_point.setdefault(str(rating.point_id), []).append(rating)
    # The latest mark of each expected action.
    marks = {
        event.payload["action_code"]: event.payload["mark"]
        for event in ctx.events
        if event.type == RunEventType.ACTION_MARKED
    }
    point_labels = labels["points"]
    for eeg in ctx.plan["eeg"]:
        story.append(para(code_ref(eeg["code"], eeg.get("title") or eeg["statement"]), "body"))
        point_rows = []
        for point in eeg["points"]:
            given = by_point.get(str(point["id"]), [])
            rated = "<br/>".join(
                escape(
                    f"{_room_mark(r.room_code)}{r.level.value} — {raters.get(r.evaluator_id, '')}"
                )
                + (f": {escape(r.rationale)}" if r.rationale else "")
                for r in given
            ) or escape(labels["no_ratings"])
            seen = marks.get(point.get("source_action_code") or "")
            point_rows.append(
                [
                    escape(point["text"]),
                    rated,
                    escape(labels["marks"].get(seen, "—") if seen else "—"),
                ]
            )
        story.append(
            grid(
                [escape(point_labels[k]) for k in ("point", "ratings", "action")],
                point_rows,
                [0.42, 0.43, 0.15],
            )
        )
        story.append(Spacer(1, 6))

    # 3. Inject chronology
    section("injects")
    totals = summary(session, ttx)
    states = labels["inject_states"]
    story.append(
        grid(
            [escape(labels["columns"]["detail"]), escape(labels["columns"]["event"])],
            [
                [
                    code_ref(i.code, i.title),
                    escape(states[i.state])
                    + (
                        "<br/>" + escape(labels["reason"].format(reason=i.reason))
                        if i.reason
                        else ""
                    ),
                ]
                for i in totals.injects
            ],
            [0.7, 0.3],
        )
    )

    # 4. Decisions of the table, by inject (and room), then its votes.
    section("decisions")
    decided, voted = decision_log(session, run)
    words = labels["decisions"]
    if not decided and not voted:
        story.append(para(escape(labels["none"]), "body"))
    deciders = {
        u.id: u.full_name
        for u in session.exec(select(User).where(User.id.in_({d.author_id for d in decided})))
    }
    for decision in sorted(decided, key=lambda d: (d.inject_code, d.at)):
        inject = ctx.injects.get(decision.inject_code, {})
        who = labels["roles"].get(decision.role, decision.role)
        extra = [when(decision.at), f"{deciders.get(decision.author_id, '')} ({who})"]
        if decision.room_code:
            extra.append(decision.room_code)
        if decision.poll_id:
            extra.append(words["from_vote"])
        story.append(
            para(
                f"{code_ref(decision.inject_code, inject.get('title', ''))}: "
                f"<b>{escape(decision.text)}</b> · {escape(' · '.join(extra))}",
                "body",
            )
        )
    if voted:
        story.append(para(f"<b>{escape(words['polls'])}</b>", "body"))
    for poll in voted:
        title = ctx.injects.get(poll.inject_code, {}).get("title", "")
        tally = {option: 0 for option in range(len(poll.options))}
        for option in poll.votes.values():
            tally[option] = tally.get(option, 0) + 1
        story.append(
            para(
                f"{code_ref(poll.inject_code, title)}: "
                f"<b>{escape(poll.question)}</b> · "
                + escape(words["voters"].format(n=len(poll.votes)))
                + (f" · {escape(poll.room_code)}" if poll.room_code else ""),
                "body",
            )
        )
        story.extend(
            para(
                "• " + escape(f"{text} — " + words["votes"].format(votes=tally[index])),
                "body",
            )
            for index, text in enumerate(poll.options)
        )
        chosen = poll.outcome_option
        if chosen is not None and chosen < len(poll.outcomes) and poll.outcomes[chosen].strip():
            story.append(
                para(
                    escape(
                        words["outcome"].format(
                            option=poll.options[chosen], text=poll.outcomes[chosen].strip()
                        )
                    ),
                    "body",
                )
            )

    groups = run_meters(session, ctx.ttx, run.id)
    if groups:
        story.append(para(f"<b>{escape(words['meters'])}</b>", "body"))
    for group in groups:
        heading = words["meters_decisions"].format(n=group.decisions)
        if group.room_code:
            heading = f"{group.room_code} · {heading}"
        story.append(para(escape(heading), "body"))
        story.extend(
            para(
                "• " + escape(words["meter"].format(name=m.name, total=m.total, most=m.most)),
                "body",
            )
            for m in group.meters
        )

    # 5. The team's notes (never a Player's)
    section("notes")
    notes = session.exec(
        select(RunNote, User)
        .join(User, User.id == RunNote.author_id)
        .where(RunNote.run_id == run.id, RunNote.role != TTXContextRole.PLAYER.value)
        .order_by(RunNote.inject_code, RunNote.updated_at)
    ).all()
    if not notes:
        story.append(para(escape(labels["none"]), "body"))
    for note, author in notes:
        where = _room_mark(note.room_code) + (note.inject_code or labels["general"])
        story.append(
            para(
                f"<b>{escape(where)}</b> · {escape(author.full_name)} "
                f"({escape(labels['roles'].get(note.role, note.role))}): {escape(note.text)}",
                "body",
            )
        )

    # 6. Participant feedback
    section("feedback")
    results = feedback_results(session, ttx, ctx.locale)
    story.append(
        para(
            escape(
                labels["feedback_count"].format(
                    n=results.responses, players=results.players, team=results.team
                )
            ),
            "body",
        )
    )
    if not results.shown:
        story.append(
            para(escape(labels["feedback_hidden"].format(minimum=results.minimum)), "body")
        )
    else:
        story.append(
            kv_table(
                [
                    (
                        escape(s.text),
                        escape(labels["average"].format(average=s.average, n=s.n))
                        if s.average is not None
                        else "—",
                    )
                    for s in results.statements
                ]
            )
        )
        for question in results.open_questions:
            texts = results.answers.get(question.key, [])
            if texts:
                story.append(para(f"<b>{escape(question.text)}</b>", "body"))
                story.extend(para("• " + escape(t), "body") for t in texts)

    # 7. Next steps: the plan's calendar
    section("next")
    story.append(
        kv_table(
            [
                (escape(labels["milestones"][m.key]), escape(m.on.isoformat()))
                for m in totals.milestones
            ]
        )
    )
    return ctx.pdf("aar", story)


def render_report_pdf(session: Session, ttx: TTX, locale: str) -> tuple[bytes, str]:
    """The authors' after-action report and improvement plan, as written
    (DRAFT until FINAL): never the session's raw notes."""
    from app.services.after_action_service import find_report, report_read

    found = find_report(session, ttx.id)
    # The run it was written from, even once a newer one has started.
    ctx = _Context(session, ttx, locale, found.run_id)
    labels = ctx.labels
    report = report_read(session, found, can_edit=False)
    sections, fields = labels["report_sections"], labels["report_fields"]
    story = ctx.heading("report")
    if report.status == "final":
        story.append(
            para(
                escape(
                    labels["report_final"].format(
                        version=report.version,
                        who=report.finalized_by,
                        when=report.finalized_at.astimezone(ctx.zone).strftime("%Y-%m-%d")
                        if report.finalized_at
                        else "",
                    )
                ),
                "subtitle",
            )
        )
    else:
        story.append(para(escape(labels["report_draft"].format(version=report.version)), "notice"))

    def section(key: str) -> None:
        story.append(para(escape(sections[key]), "h2"))
        story.append(Spacer(1, 3))

    section("summary")
    story.append(para(formatted(report.executive_summary), "body"))
    section("session")
    _session_table(ctx, story)
    section("scenario")
    story.append(para(formatted(report.scenario_summary), "body"))

    section("objectives")
    for objective in report.objectives:
        story.append(para(code_ref(objective.objective_code, objective.title), "body"))
        story.append(
            kv_table(
                [
                    (
                        escape(fields["overall"]),
                        escape(labels["levels"][objective.overall.value])
                        if objective.overall
                        else "—",
                    ),
                    (escape(fields["strengths"]), formatted(objective.strengths)),
                    (escape(fields["improvements"]), formatted(objective.improvements)),
                    (escape(fields["analysis"]), formatted(objective.analysis)),
                ]
            )
        )
        story.append(Spacer(1, 6))

    section("plan")
    columns, states = labels["plan_columns"], labels["plan_status"]
    if not report.actions:
        story.append(para(escape(labels["none"]), "body"))
    else:
        story.append(
            grid(
                [
                    escape(columns[k])
                    for k in ("code", "finding", "action", "owner", "due", "status")
                ],
                [
                    [
                        code_ref(a.code, a.objective_code or ""),
                        formatted(a.finding),
                        formatted(a.action)
                        + (
                            f"<br/>{escape(labels['retest'])} "
                            + code_ref(a.retest.ttx_code, a.retest.ttx_name)
                            + (
                                f" · {code_ref(a.retest.objective_code, '')}"
                                if a.retest.objective_code
                                else ""
                            )
                            if a.retest
                            else ""
                        ),
                        escape(" · ".join(x for x in (a.owner, a.owner_area) if x) or "—"),
                        escape(a.due_date.isoformat() if a.due_date else "—"),
                        escape(states[a.status.value])
                        + (f"<br/>{escape(labels['overdue'])}" if a.overdue else ""),
                    ]
                    for a in report.actions
                ],
                [0.1, 0.22, 0.26, 0.17, 0.11, 0.14],
            )
        )

    section("conclusions")
    story.append(para(formatted(report.conclusions), "body"))
    return ctx.pdf("report", story)
