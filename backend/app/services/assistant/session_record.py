"""What a session recorded, as the AI assistant reads it to help write the
after-action report (docs/features/ai-assistant.md#after-action-report).

It reads the report's own run, with the app's readers: what the "From the
session" panel and the session's exports show the report's authors. The
feedback keeps its minimum of answers, and a Player's notes stay out.
People aren't named, only their role: a report is about capabilities, not
about who did what.

Every item carries the reference a proposal cites as its evidence."""

from collections import Counter
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.models import (
    TTX,
    AfterActionReport,
    ConductPrepSnapshot,
    ExerciseRun,
    MselSnapshot,
    RunNote,
    RunRating,
    TTXContextRole,
)
from app.services.exercise_run_service import feedback_results, run_log, run_meters

SECTIONS = (
    "injects",
    "expected_actions",
    "decisions",
    "polls",
    "meters",
    "ratings",
    "notes",
    "feedback",
)
_LABEL_CHARS = 120


def _minute(run: ExerciseRun, at: datetime) -> int:
    return max(0, int((at - run.started_at).total_seconds() // 60))


def _cut(text: str, limit: int = _LABEL_CHARS) -> str:
    return text if len(text) <= limit else text[:limit].rstrip() + "…"


def session_record(
    session: Session, ttx: TTX, report: AfterActionReport, language: str
) -> dict[str, Any]:
    run = session.get(ExerciseRun, report.run_id)
    msel = session.get(MselSnapshot, run.msel_snapshot_id).payload
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    log = run_log(session, run)
    injects = {inject["code"]: inject for inject in msel["injects"]}

    played = [
        {
            "code": code,
            "title": injects.get(code, {}).get("title", ""),
            "minute": _minute(run, at),
            "reason": reason,
        }
        for code, (at, reason) in log.released.items()
    ]
    skipped = [
        {"code": code, "title": injects.get(code, {}).get("title", ""), "skipped": reason}
        for code, reason in log.skipped.items()
    ]
    expected = []
    for inject in msel["injects"]:
        if inject["code"] not in log.released:
            continue
        for action in inject.get("expected_actions", []):
            mark = log.marks.get(action["code"])
            expected.append(
                {
                    "code": action["code"],
                    "inject_code": inject["code"],
                    "description": action["description"],
                    "mark": mark[0].value if mark else None,
                    "note": mark[1] if mark else "",
                }
            )
    polls = []
    for poll in log.polls.values():
        tally = Counter(poll.votes.values())
        chosen = poll.outcome_option
        polls.append(
            {
                "id": poll.id,
                "question": poll.question,
                "inject_code": poll.inject_code,
                "room_code": poll.room_code,
                "options": [
                    {"text": text, "votes": tally[index]} for index, text in enumerate(poll.options)
                ],
                "settled_on": poll.options[chosen] if chosen is not None else None,
                "outcome": (
                    poll.outcomes[chosen]
                    if chosen is not None and chosen < len(poll.outcomes)
                    else None
                ),
            }
        )
    by_point: dict[str, list[RunRating]] = {}
    for rating in session.exec(select(RunRating).where(RunRating.run_id == run.id)):
        by_point.setdefault(str(rating.point_id), []).append(rating)
    ratings = [
        {
            "point_id": str(point["id"]),
            "objective_code": eeg["code"],
            "point": point["text"],
            "level": rating.level.value,
            "rationale": rating.rationale,
            "inject_code": rating.inject_code,
            "room_code": rating.room_code,
        }
        for eeg in plan["eeg"]
        for point in eeg["points"]
        for rating in by_point.get(str(point["id"]), [])
    ]
    notes = [
        {
            "id": str(note.id),
            "role": note.role,
            "inject_code": note.inject_code,
            "room_code": note.room_code,
            "text": note.text,
        }
        for note in session.exec(
            select(RunNote)
            .where(RunNote.run_id == run.id, RunNote.role != TTXContextRole.PLAYER.value)
            .order_by(RunNote.inject_code, RunNote.updated_at)
        )
        if note.text.strip()
    ]
    feedback = feedback_results(session, ttx, language, run.id)
    return {
        "run": {
            "number": run.number,
            "status": run.status.value,
            "started_at": run.started_at.isoformat(),
        },
        "injects": played + skipped,
        "expected_actions": expected,
        "decisions": [
            {
                "id": decision.id,
                "text": decision.text,
                "inject_code": decision.inject_code,
                "room_code": decision.room_code,
                "role": decision.role,
            }
            for decision in log.decisions.values()
        ],
        "polls": polls,
        "meters": [group.model_dump(mode="json") for group in run_meters(session, ttx, run.id)],
        "ratings": ratings,
        "notes": notes,
        "feedback": {
            "responses": feedback.responses,
            "shown": feedback.shown,
            "minimum": feedback.minimum,
            "statements": [
                {"key": s.key, "text": s.text, "average": s.average} for s in feedback.statements
            ],
            "open_questions": [
                {"key": q.key, "text": q.text, "answers": feedback.answers.get(q.key, [])}
                for q in feedback.open_questions
            ],
        },
    }


def evidence_index(record: dict[str, Any]) -> dict[str, dict[str, str]]:
    """What a proposal may cite, by kind: reference -> how the page names
    it. Feedback under its minimum isn't shown, so it can't be cited."""
    feedback = record["feedback"]
    cited = feedback["statements"] + feedback["open_questions"] if feedback["shown"] else []
    return {
        "inject": {i["code"]: i["title"] for i in record["injects"]},
        "action": {a["code"]: _cut(a["description"]) for a in record["expected_actions"]},
        "decision": {d["id"]: _cut(d["text"]) for d in record["decisions"]},
        "poll": {p["id"]: _cut(p["question"]) for p in record["polls"]},
        "rating": {
            r["point_id"]: f"{r['objective_code']}: {_cut(r['point'])}" for r in record["ratings"]
        },
        "note": {n["id"]: _cut(n["text"]) for n in record["notes"]},
        "feedback": {item["key"]: _cut(item["text"]) for item in cited},
    }
