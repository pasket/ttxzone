"""The {placeholders} an exercise still carries (left blank when a scenario
was applied, or typed by hand) and filling them in place.

Unlike applying a scenario, which rewrites the exercise, a fill only
replaces `{name}` inside the texts that hold it: rows keep their ids, the
session plan, approvals' history and files stay. It is still an edit of
the documents it changes, under their own rules: a needs analysis past
DRAFT goes back to DRAFT (its approval covered other text) and so does an
MSEL; both get a new revision, so a page open on them reloads instead of
overwriting. All or nothing: a value that makes a text too long is
reported and nothing changes."""

import copy
import logging
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import (
    TTX,
    Inject,
    InjectExpectedAction,
    MselPhase,
    MselSimulatedActor,
    MselThreatActor,
    NeedsFormStatus,
    TTXExerciseRisk,
    TTXMsel,
    TTXNeed,
    TTXNeedsForm,
    TTXObjective,
    TTXRoom,
    User,
)
from app.models.msel_file import InjectFile
from app.models.msel_image import InjectImage
from app.models.ttx_msel import MselStatus
from app.schemas.scenario import (
    MAX_VARIABLE_USES,
    ScenarioPlaceholder,
    ScenarioVariable,
    ScenarioVariableUse,
    TTXPlaceholders,
)
from app.schemas.ttx_msel import InjectArtifact
from app.services import platform_audit_service, ttx_msel_service, ttx_needs_form_service
from app.services.scenario_document import scenario_path
from app.services.scenario_service import _PLACEHOLDER, _texts, excerpt_around
from app.services.ttx_msel_service import find_msel
from app.services.ttx_needs_form_service import get_form

logger = logging.getLogger(__name__)

# A text with no column length (the documents' long texts).
_LONG_TEXT = 5000
# A list's items, where they aren't the usual 255 characters.
_ITEM_LENGTH = {
    "key_questions": 500,
    "attachment_notes": 500,
    "poll_options": 200,
    "poll_outcomes": 1000,
}

# The free text of each design row, by model: what a scenario writes
# (scenario_service._write_*), and so where its placeholders can be.
TEXT_FIELDS: dict[type, tuple[str, ...]] = {
    TTX: ("name", "description"),
    TTXNeedsForm: (
        "trigger_other",
        "regulatory_framework_other",
        "participating_areas",
        "third_parties",
        "perimeter",
        "out_of_scope",
        "confidentiality_restrictions",
        "budget_and_external_support",
        "stop_exercise_keyword",
    ),
    TTXNeed: ("title", "finding"),
    TTXObjective: (
        "title",
        "statement",
        "success_criterion",
        "achieved_note",
        "partially_achieved",
        "not_achieved",
        "evidence",
    ),
    TTXExerciseRisk: ("risk", "mitigation"),
    TTXMsel: ("title", "summary", "meters"),
    MselPhase: ("name", "headline", "situation_update", "key_questions"),
    Inject: (
        "title",
        "content",
        "trigger_condition",
        "contingent_purpose",
        "recipients",
        "attachment_notes",
        "facilitator_notes",
        "artifact",
        "poll_question",
        "poll_options",
        "poll_outcomes",
    ),
    InjectExpectedAction: ("description", "responsible_role"),
    InjectImage: ("caption",),
    InjectFile: ("description",),
    MselSimulatedActor: ("name", "description"),
    MselThreatActor: ("name", "aliases", "description"),
    TTXRoom: ("name", "description"),
}

_NEEDS = "needs"
_MSEL = "msel"


@dataclass
class _Row:
    """A design row with where it sits (as a scenario document names it),
    the document an edit of it belongs to and how a use of it is quoted."""

    row: Any
    path: tuple
    document: str | None = None
    code: str | None = None
    title: str | None = None


def _rows(session: Session, ttx: TTX, form: TTXNeedsForm, msel: TTXMsel | None) -> list[_Row]:
    out = [_Row(ttx, ("exercise",)), _Row(form, ("needs",), _NEEDS)]

    def coded(model, where, order, path: tuple, document: str | None, name: str) -> list:
        rows = list(session.exec(select(model).where(where).order_by(order)))
        out.extend(
            _Row(row, (*path, i), document, row.code, getattr(row, name) or None)
            for i, row in enumerate(rows)
        )
        return rows

    coded(
        TTXNeed, TTXNeed.form_id == form.id, TTXNeed.position, ("needs", "needs"), _NEEDS, "title"
    )
    coded(
        TTXObjective,
        TTXObjective.form_id == form.id,
        TTXObjective.position,
        ("needs", "objectives"),
        _NEEDS,
        "title",
    )
    risks = session.exec(
        select(TTXExerciseRisk)
        .where(TTXExerciseRisk.form_id == form.id)
        .order_by(TTXExerciseRisk.position)
    )
    out.extend(_Row(row, ("needs", "risks", i), _NEEDS) for i, row in enumerate(risks))
    # The cast and the rooms are the exercise's; with an MSEL, a change to
    # them is an edit of it (see ttx_msel_service).
    shared = _MSEL if msel else None
    coded(
        MselSimulatedActor,
        MselSimulatedActor.ttx_id == ttx.id,
        MselSimulatedActor.position,
        ("cast",),
        shared,
        "name",
    )
    coded(TTXRoom, TTXRoom.ttx_id == ttx.id, TTXRoom.position, ("rooms",), shared, "name")
    if msel is None:
        return out
    out.append(_Row(msel, ("msel",), _MSEL))
    coded(
        MselPhase,
        MselPhase.msel_id == msel.id,
        MselPhase.position,
        ("msel", "phases"),
        _MSEL,
        "name",
    )
    coded(
        MselThreatActor,
        MselThreatActor.msel_id == msel.id,
        MselThreatActor.position,
        ("msel", "threat_actors"),
        _MSEL,
        "name",
    )
    injects = coded(
        Inject, Inject.msel_id == msel.id, Inject.position, ("msel", "injects"), _MSEL, "title"
    )
    index = {inject.id: i for i, inject in enumerate(injects)}
    by_id = {inject.id: inject for inject in injects}
    if not injects:
        return out
    for model, section, order in (
        (InjectExpectedAction, "expected_actions", InjectExpectedAction.position),
        (InjectImage, "images", InjectImage.position),
        (InjectFile, "files", InjectFile.position),
    ):
        seen: dict = {}
        for row in session.exec(
            select(model).where(model.inject_id.in_(list(index))).order_by(order)
        ):
            inject = by_id[row.inject_id]
            n = seen.get(row.inject_id, 0)
            seen[row.inject_id] = n + 1
            out.append(
                _Row(
                    row,
                    ("msel", "injects", index[row.inject_id], section, n),
                    _MSEL,
                    inject.code,
                    inject.title or None,
                )
            )
    return out


def _field_texts(item: _Row):
    """Every text of a row: (field, value as stored, where, text)."""
    for name in TEXT_FIELDS[type(item.row)]:
        value = getattr(item.row, name)
        if isinstance(value, str):
            yield name, value, (*item.path, name), value
        elif value:
            for _, _, text, path in _texts(value, name, (*item.path, name)):
                yield name, value, path, text


def _documents(session: Session, ttx: TTX, *, lock: bool):
    form = get_form(session, ttx.id, lock=lock)
    msel = find_msel(session, ttx.id, lock=lock)
    return form, msel


def scan(session: Session, ttx: TTX) -> TTXPlaceholders:
    """The {placeholders} left in the exercise's texts, in first-use order,
    with where they appear and what its scenario said about them."""
    form, msel = _documents(session, ttx, lock=False)
    found: dict[str, ScenarioVariable] = {}
    documents: set[str] = set()
    for item in _rows(session, ttx, form, msel):
        for _, _, path, text in _field_texts(item):
            for match in _PLACEHOLDER.finditer(text):
                if item.document:
                    documents.add(item.document)
                name = match.group(1)
                variable = found.setdefault(name, ScenarioVariable(name=name, count=0))
                variable.count += 1
                if len(variable.uses) < MAX_VARIABLE_USES:
                    variable.uses.append(
                        ScenarioVariableUse(
                            path=scenario_path(path),
                            code=item.code,
                            title=item.title,
                            excerpt=excerpt_around(text, match.start(), match.end()),
                        )
                    )
    for raw in ttx.scenario_placeholders or []:
        declared = ScenarioPlaceholder.model_validate(raw)
        if declared.name in found:
            found[declared.name].description = declared.description
            found[declared.name].suggested = declared.suggested
    return TTXPlaceholders(
        variables=list(found.values()),
        reopens_needs=_NEEDS in documents and form.status != NeedsFormStatus.DRAFT,
        reopens_msel=_MSEL in documents and msel is not None and msel.status != MselStatus.DRAFT,
    )


def _too_long(path: tuple) -> AppException:
    return AppException(
        "PLACEHOLDER_VALUE_TOO_LONG",
        "With the values filled in, a text gets too long ({path}). Nothing was changed.",
        422,
        log_level=logging.WARNING,
        params={"path": scenario_path(path)},
    )


def _limit(row: Any, name: str, in_list: bool) -> int:
    if in_list:
        return _ITEM_LENGTH.get(name, 255)
    return getattr(type(row).__table__.c[name].type, "length", None) or _LONG_TEXT


def fill(session: Session, ttx: TTX, values: dict[str, str], user: User) -> TTXPlaceholders:
    """Replace each {placeholder} that has a non-blank value throughout the
    exercise; the rest stay. Returns what is still left."""
    filled = {name: value.strip() for name, value in values.items() if value.strip()}
    if not filled:
        return scan(session, ttx)

    written: set[str] = set()

    def value_of(match) -> str:
        name = match.group(1)
        if name not in filled:
            return match.group(0)
        written.add(name)
        return filled[name]

    def replace(text: str) -> str:
        return _PLACEHOLDER.sub(value_of, text)

    ttx = session.exec(select(TTX).where(TTX.id == ttx.id).with_for_update()).one()
    form, msel = _documents(session, ttx, lock=True)
    changed: set[str | None] = set()
    for item in _rows(session, ttx, form, msel):
        for name in TEXT_FIELDS[type(item.row)]:
            value = getattr(item.row, name)
            if isinstance(value, str):
                new = replace(value)
                if new == value:
                    continue
                if len(new) > _limit(item.row, name, False):
                    raise _too_long((*item.path, name))
            elif value:
                # A new object: an in-place change of a JSON or array value
                # isn't seen as one.
                new = copy.deepcopy(value)
                for parent, key, text, path in list(_texts(new, name, (*item.path, name))):
                    parent[key] = replace(text)
                    if len(parent[key]) > _limit(item.row, name, True):
                        raise _too_long(path)
                if new == value:
                    continue
                if name == "artifact":
                    try:
                        InjectArtifact.model_validate(new)
                    except ValidationError:
                        raise _too_long((*item.path, name)) from None
            else:
                continue
            setattr(item.row, name, new)
            session.add(item.row)
            changed.add(item.document)
    if not changed:
        return scan(session, ttx)
    # Each document it changed was edited: back to DRAFT past it, and a new
    # revision so an open page reloads rather than overwrite the fill.
    if _NEEDS in changed:
        ttx_needs_form_service._withdraw_approval(session, form)
        ttx_needs_form_service._touch(form, user)
        session.add(form)
    if _MSEL in changed and msel is not None:
        ttx_msel_service._reopen(msel)
        ttx_msel_service._touch(msel, user)
        session.add(msel)
    session.add(ttx)
    session.flush()
    left = scan(session, ttx)
    names = {variable.name for variable in left.variables}
    ttx.scenario_placeholders = [
        raw for raw in ttx.scenario_placeholders or [] if raw.get("name") in names
    ]
    session.add(ttx)
    # Many texts change at once, and an approval may be withdrawn: the
    # activity log says who did it and which placeholders, never the values
    # (they are the exercise's content). It commits the fill with it.
    platform_audit_service.record_exercise(
        session, user, "exercise.placeholders_filled", ttx, {"placeholders": sorted(written)}
    )
    logger.info("Placeholders %s of TTX %s filled in by user %s.", sorted(written), ttx.id, user.id)
    return left
