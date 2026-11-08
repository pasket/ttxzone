"""Scenarios: an exercise packaged as a ScenarioDocument (export) and a
document landing on an exercise (apply), overwriting its content.

Applying is all or nothing and always checked first:
1. `check_document` finds every problem the document has on its own
   (references between codes, ATT&CK ids in its release, TTX-Zone ids,
   images that don't decode) without touching the database;
2. `apply_document` then clears the exercise and writes the document in
   one transaction. With `dry_run` it rolls the transaction back at the
   end, so a dry run exercises the very same writes -- a database error
   shows up there too -- and changes nothing (no file is written either).

What the exercise keeps: its code, team, invitations and tokens, its
access requests. Everything it designed is replaced: the needs analysis
(back to a DRAFT, approvals and their evidence gone), the MSEL and its
images, the cast, the session plan, its tags (and where they were
applied). People, approvals and dates are never in a document, so they
are left blank to fill in again."""

import base64
import binascii
import hashlib
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import delete
from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.data.actor_catalog import ACTOR_CATALOG_BY_ID
from app.data.attack_catalog import is_live_technique, is_selectable, is_shipped, load_groups
from app.data.tag_catalog import TAG_CATALOG_BY_ID
from app.models import (
    TTX,
    ActorOrigin,
    AttackAttribution,
    ExerciseRun,
    Inject,
    InjectAttackTechnique,
    InjectExpectedAction,
    InjectFormat,
    InjectKind,
    InjectObjective,
    MselPhase,
    MselPhaseObjective,
    MselSimulatedActor,
    MselThreatActor,
    NeedsFormStatus,
    TTXAccess,
    TTXExerciseRisk,
    TTXMsel,
    TTXNeed,
    TTXNeedsForm,
    TTXNeedsFormApproval,
    TTXObjective,
    TTXObjectiveNeed,
    TTXRoom,
    TTXTag,
    TTXTagAssignment,
    User,
)
from app.models.msel_file import InjectFile, MselFile
from app.models.msel_image import InjectImage, MselImage
from app.schemas.scenario import (
    ScenarioActor,
    ScenarioCheck,
    ScenarioCounts,
    ScenarioDocument,
    ScenarioExercise,
    ScenarioExpectedAction,
    ScenarioFile,
    ScenarioImage,
    ScenarioInject,
    ScenarioInjectFile,
    ScenarioInjectImage,
    ScenarioInjectV8,
    ScenarioIssue,
    ScenarioMeter,
    ScenarioMselV8,
    ScenarioNeed,
    ScenarioNeeds,
    ScenarioObjective,
    ScenarioPhaseObjective,
    ScenarioPhaseV2,
    ScenarioRisk,
    ScenarioRoom,
    ScenarioTag,
    ScenarioThreatActor,
    ScenarioVariable,
)
from app.services.image_processing import InvalidImageError, process_attachment_image
from app.services.msel_file_service import ensure_msel_file_dir, file_path, safe_filename
from app.services.msel_image_service import ensure_msel_image_dir, image_path
from app.services.scenario_document import issue_text, scenario_issue, scenario_path
from app.services.ttx_conduct_prep_service import delete_conduct_preps_for_ttx
from app.services.ttx_msel_service import delete_msels_for_ttx, find_msel
from app.services.ttx_needs_form_evidence_service import delete_evidence_for_approvals
from app.services.ttx_needs_form_service import get_form, release_retest_objectives
from app.services.ttx_room_service import list_rooms
from app.services.ttx_tag_service import delete_tags_for_ttx

logger = logging.getLogger(__name__)

_EXTENSIONS = {"image/png": ".png", "image/jpeg": ".jpg"}
# The needs analysis' content fields a document carries, by name on both.
_NEEDS_FIELDS = (
    "tlp",
    "triggers",
    "trigger_other",
    "regulatory_frameworks",
    "regulatory_framework_other",
    "capabilities",
    "levels",
    "participating_areas",
    "third_parties",
    "perimeter",
    "out_of_scope",
    "max_duration_hours",
    "confidentiality_restrictions",
    "budget_and_external_support",
    "stop_exercise_keyword",
)
# What a document never carries: reset to blank on apply.
_NEEDS_PEOPLE_AND_DATES = {
    "design_lead": "",
    "sponsor_name": "",
    "sponsor_role": "",
    "sponsor_motivation": "",
    "findings_closure_commitment": False,
    "findings_owner": "",
    "aar_recipient": None,
    "aar_recipient_other": "",
    "date_window_start": None,
    "date_window_end": None,
    "key_participants_availability": "",
}


def _locale_language(locale: str) -> str:
    return "es" if locale.lower().startswith("es") else "en"


# -- export ----------------------------------------------------------------------


def export_ttx(session: Session, ttx: TTX, locale: str) -> ScenarioDocument:
    """The exercise as a document (see the module docstring for what it
    leaves out)."""
    form = get_form(session, ttx.id)
    needs = list(
        session.exec(select(TTXNeed).where(TTXNeed.form_id == form.id).order_by(TTXNeed.position))
    )
    objectives = list(
        session.exec(
            select(TTXObjective)
            .where(TTXObjective.form_id == form.id)
            .order_by(TTXObjective.position)
        )
    )
    need_code = {n.id: n.code for n in needs}
    objective_code = {o.id: o.code for o in objectives}
    links: dict[uuid.UUID, list[str]] = {}
    if objectives:
        for link in session.exec(
            select(TTXObjectiveNeed).where(TTXObjectiveNeed.objective_id.in_(list(objective_code)))
        ):
            if link.need_id in need_code:
                links.setdefault(link.objective_id, []).append(need_code[link.need_id])
    risks = session.exec(
        select(TTXExerciseRisk)
        .where(TTXExerciseRisk.form_id == form.id)
        .order_by(TTXExerciseRisk.position)
    )
    needs_section = ScenarioNeeds(
        **{name: getattr(form, name) for name in _NEEDS_FIELDS},
        needs=[
            ScenarioNeed(
                code=n.code,
                source=n.source,
                title=n.title,
                finding=n.finding,
                affected_capability=n.affected_capability,
                priority=n.priority,
            )
            for n in needs
        ],
        objectives=[
            ScenarioObjective(
                code=o.code,
                title=o.title,
                statement=o.statement,
                capability=o.capability,
                need_codes=sorted(links.get(o.id, [])),
                success_criterion=o.success_criterion,
                achieve_at_least=o.achieve_at_least,
                time_box_minutes=o.time_box_minutes,
                achieved_note=o.achieved_note,
                partially_achieved=o.partially_achieved,
                not_achieved=o.not_achieved,
                evidence=o.evidence,
                regulatory_requirement_ids=list(o.regulatory_requirement_ids),
            )
            for o in objectives
        ],
        risks=[ScenarioRisk(risk=r.risk, mitigation=r.mitigation) for r in risks],
        next_need_number=form.next_need_number,
        next_objective_number=form.next_objective_number,
    )

    cast_rows = list(
        session.exec(
            select(MselSimulatedActor)
            .where(MselSimulatedActor.ttx_id == ttx.id)
            .order_by(MselSimulatedActor.position)
        )
    )
    actor_code = {a.id: a.code for a in cast_rows}
    cast = [
        ScenarioActor(
            code=a.code,
            name=a.name,
            type=a.type,
            description=a.description,
            channel=a.channel,
            origin=a.origin,
            origin_id=a.origin_id,
            origin_name=a.origin_name,
        )
        for a in cast_rows
    ]

    tag_rows = list(
        session.exec(
            select(TTXTag)
            .where(TTXTag.ttx_id == ttx.id)
            .order_by(TTXTag.created_at, TTXTag.name, TTXTag.id)
        )
    )
    applied = set(
        session.exec(select(TTXTagAssignment.ttx_tag_id).where(TTXTagAssignment.ttx_id == ttx.id))
    )
    tags = [
        ScenarioTag(
            name=t.name,
            color=t.color,
            custom_hex=t.custom_hex,
            origin=t.origin,
            origin_id=t.origin_id,
            origin_name=t.origin_name,
            applied=t.id in applied,
        )
        for t in tag_rows
    ]

    rooms = list_rooms(session, ttx.id)
    room_code = {r.id: r.code for r in rooms}
    msel = find_msel(session, ttx.id)
    msel_section, images, attached = (
        _export_msel(session, msel, objective_code, actor_code, room_code)
        if msel
        else (None, [], [])
    )
    embedded = sum(len(i.data) for i in images) + sum(len(f.data) for f in attached)
    if embedded > settings.SCENARIO_MAX_BYTES:
        raise AppException(
            "SCENARIO_EXPORT_TOO_LARGE",
            "This exercise's images and files add up to more than a scenario file can hold "
            "({max_mb} MB).",
            413,
            log_level=logging.WARNING,
            params={"max_mb": settings.SCENARIO_MAX_BYTES // (1024 * 1024)},
        )
    return ScenarioDocument(
        language=ttx.content_language or _locale_language(locale),
        exported_at=datetime.now(UTC),
        exercise=ScenarioExercise(name=ttx.name, description=ttx.description),
        needs=needs_section,
        msel=msel_section,
        cast=cast,
        next_actor_number=ttx.next_actor_number,
        tags=tags,
        images=images,
        files=attached,
        uses_rooms=ttx.uses_rooms,
        rooms=[ScenarioRoom(code=r.code, name=r.name, description=r.description) for r in rooms],
        next_room_number=ttx.next_room_number,
    )


def _export_msel(
    session: Session,
    msel: TTXMsel,
    objective_code: dict[uuid.UUID, str],
    actor_code: dict[uuid.UUID, str],
    room_code: dict[uuid.UUID, str],
) -> tuple[ScenarioMselV8, list[ScenarioImage], list[ScenarioFile]]:
    phases = list(
        session.exec(
            select(MselPhase).where(MselPhase.msel_id == msel.id).order_by(MselPhase.position)
        )
    )
    phase_code = {p.id: p.code for p in phases}
    phase_objectives: dict[uuid.UUID, list[ScenarioPhaseObjective]] = {}
    if phases:
        for row in session.exec(
            select(MselPhaseObjective).where(MselPhaseObjective.phase_id.in_(list(phase_code)))
        ):
            if row.objective_id in objective_code:
                phase_objectives.setdefault(row.phase_id, []).append(
                    ScenarioPhaseObjective(code=objective_code[row.objective_id], due=row.due)
                )
        # By code: the link table has no order of its own, and the file must
        # come out the same every time.
        for links in phase_objectives.values():
            links.sort(key=lambda link: link.code)
    threats = list(
        session.exec(
            select(MselThreatActor)
            .where(MselThreatActor.msel_id == msel.id)
            .order_by(MselThreatActor.position)
        )
    )
    threat_code = {t.id: t.code for t in threats}
    injects = list(
        session.exec(select(Inject).where(Inject.msel_id == msel.id).order_by(Inject.position))
    )
    inject_ids = [i.id for i in injects]
    inject_code = {i.id: i.code for i in injects}
    objectives_of: dict[uuid.UUID, list[str]] = {}
    techniques_of: dict[uuid.UUID, list[InjectAttackTechnique]] = {}
    actions_of: dict[uuid.UUID, list[InjectExpectedAction]] = {}
    images_of: dict[uuid.UUID, list[InjectImage]] = {}
    files_of: dict[uuid.UUID, list[InjectFile]] = {}
    if inject_ids:
        for row in session.exec(
            select(InjectObjective).where(InjectObjective.inject_id.in_(inject_ids))
        ):
            if row.objective_id in objective_code:
                objectives_of.setdefault(row.inject_id, []).append(objective_code[row.objective_id])
        for row in session.exec(
            select(InjectAttackTechnique)
            .where(InjectAttackTechnique.inject_id.in_(inject_ids))
            .order_by(InjectAttackTechnique.position)
        ):
            techniques_of.setdefault(row.inject_id, []).append(row)
        for row in session.exec(
            select(InjectExpectedAction)
            .where(InjectExpectedAction.inject_id.in_(inject_ids))
            .order_by(InjectExpectedAction.position)
        ):
            actions_of.setdefault(row.inject_id, []).append(row)
        for row in session.exec(
            select(InjectImage)
            .where(InjectImage.inject_id.in_(inject_ids))
            .order_by(InjectImage.position)
        ):
            images_of.setdefault(row.inject_id, []).append(row)
        for row in session.exec(
            select(InjectFile)
            .where(InjectFile.inject_id.in_(inject_ids))
            .order_by(InjectFile.position)
        ):
            files_of.setdefault(row.inject_id, []).append(row)
    action_code = {a.id: a.code for rows in actions_of.values() for a in rows}

    # Only the images some inject shows, each once, under a stable key.
    image_rows = {
        image.id: image
        for image in session.exec(select(MselImage).where(MselImage.msel_id == msel.id))
    }
    image_key: dict[uuid.UUID, str] = {}
    images: list[ScenarioImage] = []
    for inject in injects:
        for link in images_of.get(inject.id, []):
            image = image_rows.get(link.image_id)
            if image is None or image.id in image_key or not image_path(image).is_file():
                continue
            image_key[image.id] = f"IMG-{len(image_key) + 1:02d}"
            images.append(
                ScenarioImage(
                    key=image_key[image.id],
                    content_type=image.content_type,
                    data=base64.b64encode(image_path(image).read_bytes()).decode("ascii"),
                )
            )

    # Likewise the files some inject hands out.
    file_rows = {f.id: f for f in session.exec(select(MselFile).where(MselFile.msel_id == msel.id))}
    file_key: dict[uuid.UUID, str] = {}
    attached: list[ScenarioFile] = []
    for inject in injects:
        for link in files_of.get(inject.id, []):
            row = file_rows.get(link.file_id)
            if row is None or row.id in file_key or not file_path(row).is_file():
                continue
            file_key[row.id] = f"FILE-{len(file_key) + 1:02d}"
            attached.append(
                ScenarioFile(
                    key=file_key[row.id],
                    name=row.original_name,
                    sha256=row.sha256,
                    data=base64.b64encode(file_path(row).read_bytes()).decode("ascii"),
                )
            )

    def inject_section(inject: Inject) -> ScenarioInjectV8:
        own = set(objectives_of.get(inject.id, []))
        return ScenarioInjectV8(
            code=inject.code,
            phase_code=phase_code.get(inject.phase_id) if inject.phase_id else None,
            kind=inject.kind,
            title=inject.title,
            content=inject.content,
            offset_minutes=inject.offset_minutes,
            trigger_condition=inject.trigger_condition,
            contingent_purpose=inject.contingent_purpose,
            fires_at_minute=inject.fires_at_minute,
            branch_from_code=inject_code.get(inject.branch_from_id)
            if inject.branch_from_id
            else None,
            branch_action_code=action_code.get(inject.branch_action_id)
            if inject.branch_action_id
            else None,
            rejoin_code=inject_code.get(inject.rejoin_inject_id)
            if inject.rejoin_inject_id
            else None,
            sender_code=actor_code.get(inject.simulated_actor_id)
            if inject.simulated_actor_id
            else None,
            attack_attribution=inject.attack_attribution,
            threat_actor_code=threat_code.get(inject.threat_actor_id)
            if inject.threat_actor_id
            else None,
            recipients=list(inject.recipients),
            room_codes=[room_code[r] for r in inject.room_ids if r in room_code],
            delivery_method=inject.delivery_method,
            attachment_notes=list(inject.attachment_notes),
            attack_techniques=[
                {"domain": t.domain, "tactic_id": t.tactic_id, "technique_id": t.technique_id}
                for t in techniques_of.get(inject.id, [])
            ],
            facilitator_notes=inject.facilitator_notes,
            artifact=inject.artifact,
            format=inject.format,
            poll_question=inject.poll_question,
            poll_options=list(inject.poll_options),
            poll_outcomes=list(inject.poll_outcomes),
            poll_impacts=list(inject.poll_impacts),
            objective_codes=sorted(own),
            expected_actions=[
                ScenarioExpectedAction(
                    code=a.code,
                    description=a.description,
                    responsible_role=a.responsible_role,
                    expected_within_minutes=a.expected_within_minutes,
                    objective_codes=[
                        objective_code[o]
                        for o in a.objective_ids
                        if o in objective_code and objective_code[o] in own
                    ],
                )
                for a in actions_of.get(inject.id, [])
            ],
            images=[
                ScenarioInjectImage(image=image_key[link.image_id], caption=link.caption)
                for link in images_of.get(inject.id, [])
                if link.image_id in image_key
            ],
            files=[
                ScenarioInjectFile(file=file_key[link.file_id], description=link.description)
                for link in files_of.get(inject.id, [])
                if link.file_id in file_key
            ],
            origin=inject.origin,
            origin_id=inject.origin_id,
            origin_name=inject.origin_name,
        )

    section = ScenarioMselV8(
        title=msel.title,
        summary=msel.summary,
        attack_version=msel.attack_version,
        duration_minutes=msel.duration_minutes,
        time_compression=msel.time_compression,
        meters=[ScenarioMeter(**meter) for meter in msel.meters if meter["name"].strip()],
        phases=[
            ScenarioPhaseV2(
                code=p.code,
                name=p.name,
                headline=p.headline,
                start_offset=p.start_offset,
                end_offset=p.end_offset,
                incident_jump_minutes=p.incident_jump_minutes,
                situation_update=p.situation_update,
                key_questions=list(p.key_questions),
                objectives=phase_objectives.get(p.id, []),
            )
            for p in phases
        ],
        threat_actors=[
            ScenarioThreatActor(
                code=t.code,
                name=t.name,
                mitre_group_id=t.mitre_group_id,
                aliases=list(t.aliases),
                description=t.description,
                techniques=t.techniques,
                origin=t.origin,
                origin_id=t.origin_id,
                origin_name=t.origin_name,
            )
            for t in threats
        ],
        injects=[inject_section(i) for i in injects],
        next_phase_number=msel.next_phase_number,
        next_inject_number=msel.next_inject_number,
        next_threat_actor_number=msel.next_threat_actor_number,
    )
    return section, images, attached


# -- checks -------------------------------------------------------------------------


def counts(doc: ScenarioDocument) -> ScenarioCounts:
    return ScenarioCounts(
        needs=len(doc.needs.needs),
        objectives=len(doc.needs.objectives),
        phases=len(doc.msel.phases) if doc.msel else 0,
        injects=len(doc.msel.injects) if doc.msel else 0,
        actors=len(doc.cast),
        threat_actors=len(doc.msel.threat_actors) if doc.msel else 0,
        tags=len(doc.tags),
        images=len(doc.images),
        files=len(doc.files),
    )


def ttx_counts(session: Session, ttx: TTX) -> ScenarioCounts:
    """What the exercise holds today (what an apply would replace)."""

    def count(model, *where) -> int:
        return session.exec(select(func.count()).select_from(model).where(*where)).one()

    form = get_form(session, ttx.id)
    msel = find_msel(session, ttx.id)
    return ScenarioCounts(
        needs=count(TTXNeed, TTXNeed.form_id == form.id),
        objectives=count(TTXObjective, TTXObjective.form_id == form.id),
        phases=count(MselPhase, MselPhase.msel_id == msel.id) if msel else 0,
        injects=count(Inject, Inject.ttx_id == ttx.id),
        actors=count(MselSimulatedActor, MselSimulatedActor.ttx_id == ttx.id),
        threat_actors=count(MselThreatActor, MselThreatActor.msel_id == msel.id) if msel else 0,
        tags=count(TTXTag, TTXTag.ttx_id == ttx.id),
        images=count(MselImage, MselImage.msel_id == msel.id) if msel else 0,
        files=count(MselFile, MselFile.msel_id == msel.id) if msel else 0,
    )


@dataclass
class _Checked:
    """A document that passed its checks, with what the apply needs."""

    errors: list[ScenarioIssue] = field(default_factory=list)
    warnings: list[ScenarioIssue] = field(default_factory=list)
    # image key -> (bytes, content type, width, height), re-encoded
    images: dict[str, tuple[bytes, str, int, int]] = field(default_factory=dict)
    # file key -> its bytes (SHA-256 checked)
    files: dict[str, bytes] = field(default_factory=dict)
    # cast/tag positions whose TTX-Zone origin this build doesn't know
    unknown_actor_origins: set[int] = field(default_factory=set)
    unknown_tag_origins: set[int] = field(default_factory=set)


def _duplicates(codes: list[str]) -> set[str]:
    seen: set[str] = set()
    return {c for c in codes if c in seen or seen.add(c)}  # type: ignore[func-returns-value]


def localize_check(check: ScenarioCheck, locale: str) -> ScenarioCheck:
    """The report with each issue's message in `locale` (what goes out)."""
    for issue in (*check.errors, *check.warnings):
        issue.message, issue.params = issue_text(issue, locale), None
    return check


def check_document(doc: ScenarioDocument) -> _Checked:
    """Every problem the document has on its own -- no database."""
    out = _Checked()

    def error(path: str, code: str, message: str, **params: str | int) -> None:
        out.errors.append(scenario_issue(path, code, message, **params))

    def warning(path: str, code: str, message: str, **params: str | int) -> None:
        out.warnings.append(scenario_issue(path, code, message, **params))

    def unique(path: str, codes: list[str]) -> set[str]:
        for dup in sorted(_duplicates(codes)):
            error(path, "SCENARIO_DUPLICATE_CODE", "{code} appears more than once.", code=dup)
        return set(codes)

    needs = unique("needs.needs", [n.code for n in doc.needs.needs])
    objectives = unique("needs.objectives", [o.code for o in doc.needs.objectives])
    for i, objective in enumerate(doc.needs.objectives):
        for code in objective.need_codes:
            if code not in needs:
                error(
                    f"needs.objectives[{i}].need_codes",
                    "SCENARIO_UNKNOWN_REFERENCE",
                    "{row} names {value}, which isn't a need of the scenario.",
                    row=objective.code,
                    value=code,
                )
    cast = unique("cast", [a.code for a in doc.cast])
    for i, actor in enumerate(doc.cast):
        if actor.origin == ActorOrigin.SYSTEM and actor.origin_id not in ACTOR_CATALOG_BY_ID:
            out.unknown_actor_origins.add(i)
            warning(
                f"cast[{i}].origin_id",
                "SCENARIO_UNKNOWN_SYSTEM_ACTOR",
                "{actor} was copied from a TTX-Zone actor this version doesn't have; "
                "it's kept as the exercise's own.",
                actor=actor.code,
            )
    for i, tag in enumerate(doc.tags):
        if tag.origin == ActorOrigin.SYSTEM and tag.origin_id not in TAG_CATALOG_BY_ID:
            out.unknown_tag_origins.add(i)
            warning(
                f"tags[{i}].origin_id",
                "SCENARIO_UNKNOWN_SYSTEM_TAG",
                "The tag {tag} was copied from a TTX-Zone tag this version doesn't have; "
                "it's kept as the exercise's own.",
                tag=tag.name,
            )

    image_keys = unique("images", [image.key for image in doc.images])
    total = 0
    for i, image in enumerate(doc.images):
        try:
            raw = base64.b64decode(image.data, validate=True)
        except (binascii.Error, ValueError):
            error(
                f"images[{i}].data",
                "SCENARIO_BAD_IMAGE",
                "{image} isn't valid base64.",
                image=image.key,
            )
            continue
        total += len(raw)
        if len(raw) > settings.MSEL_IMAGE_MAX_BYTES:
            error(f"images[{i}]", "SCENARIO_BAD_IMAGE", "{image} is too large.", image=image.key)
            continue
        try:
            out.images[image.key] = process_attachment_image(raw)
        except InvalidImageError:
            error(
                f"images[{i}]",
                "SCENARIO_BAD_IMAGE",
                "{image} isn't a PNG or JPEG image.",
                image=image.key,
            )
    if len(doc.images) > settings.MSEL_IMAGE_MAX_PER_MSEL:
        error("images", "SCENARIO_LIMIT", "Too many images for one MSEL.")

    file_keys = unique("files", [f.key for f in doc.files])
    for i, item in enumerate(doc.files):
        try:
            raw = base64.b64decode(item.data, validate=True)
        except (binascii.Error, ValueError):
            error(
                f"files[{i}].data", "SCENARIO_BAD_FILE", "{file} isn't valid base64.", file=item.key
            )
            continue
        if not raw or len(raw) > settings.MSEL_FILE_MAX_BYTES:
            error(
                f"files[{i}]", "SCENARIO_BAD_FILE", "{file} is empty or too large.", file=item.key
            )
            continue
        if hashlib.sha256(raw).hexdigest() != item.sha256:
            error(
                f"files[{i}].sha256",
                "SCENARIO_BAD_FILE",
                "{file} doesn't match its SHA-256: the file was altered or cut short.",
                file=item.key,
            )
            continue
        out.files[item.key] = raw
    if len(doc.files) > settings.MSEL_FILE_MAX_PER_MSEL:
        error("files", "SCENARIO_LIMIT", "Too many files for one MSEL.")

    msel = doc.msel
    if msel is None:
        if doc.images:
            warning("images", "SCENARIO_UNUSED_IMAGES", "Images without an MSEL are left out.")
        if doc.files:
            warning("files", "SCENARIO_UNUSED_FILES", "Files without an MSEL are left out.")
        return out
    version = msel.attack_version
    attack_ok = is_shipped(version)
    if not attack_ok:
        error(
            "msel.attack_version",
            "SCENARIO_ATTACK_VERSION",
            "The scenario uses ATT&CK v{version}, which this TTX-Zone doesn't have.",
            version=version,
        )
    rooms = unique("rooms", [r.code for r in doc.rooms])
    phases = unique("msel.phases", [p.code for p in msel.phases])
    threats = unique("msel.threat_actors", [t.code for t in msel.threat_actors])
    injects = unique("msel.injects", [i.code for i in msel.injects])
    actions_by_inject = {i.code: {a.code for a in i.expected_actions} for i in msel.injects}
    unique(
        "msel.injects.expected_actions",
        [a.code for i in msel.injects for a in i.expected_actions],
    )
    for i, phase in enumerate(msel.phases):
        if phase.end_offset < phase.start_offset:
            error(
                f"msel.phases[{i}]",
                "SCENARIO_INVALID",
                "{phase} ends before it starts.",
                phase=phase.code,
            )
        for ref in phase.objectives:
            if ref.code not in objectives:
                error(
                    f"msel.phases[{i}].objectives",
                    "SCENARIO_UNKNOWN_REFERENCE",
                    "{row} names {value}, which isn't an objective of the scenario.",
                    row=phase.code,
                    value=ref.code,
                )
    for i, threat in enumerate(msel.threat_actors):
        if not attack_ok:
            break
        if threat.mitre_group_id:
            group = load_groups(version).get(threat.mitre_group_id)
            if group is None or group.deprecated:
                error(
                    f"msel.threat_actors[{i}].mitre_group_id",
                    "SCENARIO_UNKNOWN_ATTACK",
                    "{group} isn't a group of ATT&CK v{version}.",
                    group=threat.mitre_group_id,
                    version=version,
                )
        for t in threat.techniques:
            if not is_live_technique(version, *t.key()):
                error(
                    f"msel.threat_actors[{i}].techniques",
                    "SCENARIO_UNKNOWN_ATTACK",
                    "{technique} isn't a technique of ATT&CK v{version}.",
                    technique=t.technique_id,
                    version=version,
                )
    for i, inject in enumerate(msel.injects):
        path = f"msel.injects[{i}]"

        # Whole messages, not a noun put into one: each is translated as written.
        def ref(
            name: str,
            value: str | None,
            known: set[str],
            message: str,
            path: str = path,
            inject: ScenarioInject = inject,
        ) -> None:
            if value is not None and value not in known:
                error(
                    f"{path}.{name}",
                    "SCENARIO_UNKNOWN_REFERENCE",
                    message,
                    row=inject.code,
                    value=value,
                )

        ref(
            "phase_code",
            inject.phase_code,
            phases,
            "{row} names {value}, which isn't a phase of the scenario.",
        )
        for code in inject.room_codes:
            ref(
                "room_codes",
                code,
                rooms,
                "{row} names {value}, which isn't a room of the scenario.",
            )
        ref(
            "sender_code",
            inject.sender_code,
            cast,
            "{row} names {value}, which isn't a simulated actor of the scenario.",
        )
        ref(
            "threat_actor_code",
            inject.threat_actor_code,
            threats,
            "{row} names {value}, which isn't a threat actor of the scenario.",
        )
        ref(
            "branch_from_code",
            inject.branch_from_code,
            injects,
            "{row} names {value}, which isn't an inject of the scenario.",
        )
        ref(
            "rejoin_code",
            inject.rejoin_code,
            injects,
            "{row} names {value}, which isn't an inject of the scenario.",
        )
        if inject.branch_action_code is not None:
            owner = inject.branch_from_code
            known = actions_by_inject.get(owner or "", set())
            ref(
                "branch_action_code",
                inject.branch_action_code,
                known,
                "{row} names {value}, which isn't an action of its branch.",
            )
        for code in inject.objective_codes:
            ref(
                "objective_codes",
                code,
                objectives,
                "{row} names {value}, which isn't an objective of the scenario.",
            )
        for a, action in enumerate(inject.expected_actions):
            for code in action.objective_codes:
                if code not in objectives:
                    error(
                        f"{path}.expected_actions[{a}].objective_codes",
                        "SCENARIO_UNKNOWN_REFERENCE",
                        "{row} names {value}, which isn't an objective of the scenario.",
                        row=action.code,
                        value=code,
                    )
        for link in inject.images:
            ref(
                "images",
                link.image,
                image_keys,
                "{row} names {value}, which isn't an image of the scenario.",
            )
        for link in inject.files:
            ref(
                "files",
                link.file,
                file_keys,
                "{row} names {value}, which isn't a file of the scenario.",
            )
        if attack_ok:
            for t in inject.attack_techniques:
                if not is_selectable(version, t.domain, t.tactic_id, t.technique_id):
                    error(
                        f"{path}.attack_techniques",
                        "SCENARIO_UNKNOWN_ATTACK",
                        "{technique} isn't a technique of {tactic} in ATT&CK v{version}.",
                        technique=t.technique_id,
                        tactic=t.tactic_id,
                        version=version,
                    )
    return out


# -- placeholders --------------------------------------------------------------------

_PLACEHOLDER = re.compile(r"\{(\w+)\}")
# Data, not prose: never scanned for placeholders nor filled.
_NOT_TEXT = {
    "format",
    "format_version",
    "language",
    "exported_at",
    "attack_version",
    "code",
    "phase_code",
    "room_codes",
    "need_codes",
    "objective_codes",
    "sender_code",
    "threat_actor_code",
    "branch_from_code",
    "branch_action_code",
    "rejoin_code",
    "origin",
    "origin_id",
    "mitre_group_id",
    "techniques",
    "attack_techniques",
    "regulatory_requirement_ids",
    "regulatory_frameworks",
    "triggers",
    "capabilities",
    "levels",
    "tlp",
    "source",
    "priority",
    "affected_capability",
    "capability",
    "kind",
    "type",
    "channel",
    "delivery_method",
    "attack_attribution",
    "color",
    "custom_hex",
    "images",
    "image",
    "files",
    "file",
    "key",
}


def _texts(value, key: str | None = None):
    """Every free-text string of a dumped document, with its parent and key
    (to write a replacement back)."""
    if key in _NOT_TEXT:
        return
    if isinstance(value, dict):
        for k, v in value.items():
            if isinstance(v, str) and k not in _NOT_TEXT:
                yield value, k, v
            else:
                yield from _texts(v, k)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            if isinstance(v, str):
                yield value, i, v
            else:
                yield from _texts(v, key)


def document_variables(doc: ScenarioDocument) -> list[ScenarioVariable]:
    """The {placeholders} the scenario's text uses, in first-use order."""
    found: dict[str, int] = {}
    for _, _, text in _texts(doc.model_dump(mode="json")):
        for name in _PLACEHOLDER.findall(text):
            found[name] = found.get(name, 0) + 1
    return [ScenarioVariable(name=name, count=count) for name, count in found.items()]


def fill_variables(
    doc: ScenarioDocument, values: dict[str, str]
) -> tuple[ScenarioDocument, list[ScenarioIssue]]:
    """Replace each {placeholder} that has a non-blank value; the rest stay.
    A value that makes a field too long is reported, never truncated."""
    filled = {name: value.strip() for name, value in values.items() if value.strip()}
    if not filled:
        return doc, []
    data = doc.model_dump(mode="json")
    for parent, key, text in list(_texts(data)):
        parent[key] = _PLACEHOLDER.sub(lambda m: filled.get(m.group(1), m.group(0)), text)
    try:
        return ScenarioDocument.model_validate(data), []
    except ValidationError as exc:
        return doc, [
            ScenarioIssue(
                path=scenario_path(error["loc"]),
                code="SCENARIO_INVALID",
                message="With the values filled in: {detail}",
                params={"detail": error["msg"]},
            )
            for error in exc.errors()[:50]
        ]


# -- apply --------------------------------------------------------------------------


def _number(code: str) -> int:
    match = re.search(r"(\d+)$", code)
    return int(match.group(1)) if match else 0


def _next(counter: int, codes: list[str]) -> int:
    """A counter past every code in use (a hand-edited file may lag)."""
    return max([counter, *(_number(c) + 1 for c in codes)])


def _clear(session: Session, ttx: TTX, form: TTXNeedsForm) -> None:
    """Everything the exercise designed, children first (no FK cascades).
    The needs form row stays (one per exercise, created with it)."""
    delete_conduct_preps_for_ttx(session, [ttx.id])
    delete_msels_for_ttx(session, [ttx.id])
    objective_ids = list(
        session.exec(select(TTXObjective.id).where(TTXObjective.form_id == form.id))
    )
    if objective_ids:
        session.execute(
            delete(TTXObjectiveNeed).where(TTXObjectiveNeed.objective_id.in_(objective_ids))
        )
    release_retest_objectives(session, objective_ids)
    session.execute(delete(TTXObjective).where(TTXObjective.form_id == form.id))
    session.execute(delete(TTXNeed).where(TTXNeed.form_id == form.id))
    session.execute(delete(TTXExerciseRisk).where(TTXExerciseRisk.form_id == form.id))
    approval_ids = list(
        session.exec(select(TTXNeedsFormApproval.id).where(TTXNeedsFormApproval.form_id == form.id))
    )
    delete_evidence_for_approvals(session, approval_ids)
    session.execute(delete(TTXNeedsFormApproval).where(TTXNeedsFormApproval.form_id == form.id))
    delete_tags_for_ttx(session, [ttx.id])
    session.flush()


def _write_needs(session: Session, form: TTXNeedsForm, doc: ScenarioDocument, user: User):
    section = doc.needs
    form.status = NeedsFormStatus.DRAFT
    form.version = 1
    form.revision += 1
    form.document_date = date.today()
    for name, value in _NEEDS_PEOPLE_AND_DATES.items():
        setattr(form, name, value)
    for name in _NEEDS_FIELDS:
        value = getattr(section, name)
        setattr(form, name, [str(v) for v in value] if isinstance(value, list) else value)
    form.next_need_number = _next(section.next_need_number, [n.code for n in section.needs])
    form.next_objective_number = _next(
        section.next_objective_number, [o.code for o in section.objectives]
    )
    form.updated_at = datetime.now(UTC)
    form.updated_by_id = user.id
    session.add(form)

    need_id: dict[str, uuid.UUID] = {}
    for position, item in enumerate(section.needs):
        need = TTXNeed(
            form_id=form.id,
            code=item.code,
            position=position,
            source=item.source,
            title=item.title,
            finding=item.finding,
            affected_capability=item.affected_capability,
            priority=item.priority,
        )
        session.add(need)
        need_id[item.code] = need.id
    objective_id: dict[str, uuid.UUID] = {}
    for position, item in enumerate(section.objectives):
        objective = TTXObjective(
            form_id=form.id,
            code=item.code,
            position=position,
            title=item.title,
            statement=item.statement,
            capability=item.capability,
            success_criterion=item.success_criterion,
            achieve_at_least=item.achieve_at_least,
            time_box_minutes=item.time_box_minutes,
            achieved_note=item.achieved_note,
            partially_achieved=item.partially_achieved,
            not_achieved=item.not_achieved,
            evidence=item.evidence,
            regulatory_requirement_ids=item.regulatory_requirement_ids,
        )
        session.add(objective)
        objective_id[item.code] = objective.id
    for position, item in enumerate(section.risks):
        session.add(
            TTXExerciseRisk(
                form_id=form.id, position=position, risk=item.risk, mitigation=item.mitigation
            )
        )
    session.flush()
    session.add_all(
        TTXObjectiveNeed(objective_id=objective_id[o.code], need_id=need_id[code])
        for o in section.objectives
        for code in dict.fromkeys(o.need_codes)
    )
    return objective_id


def _origin(item, unknown: bool) -> tuple:
    if unknown or item.origin is None or item.origin == ActorOrigin.EXERCISE:
        return None, None, None
    return item.origin, item.origin_id, item.origin_name


def _write_cast(session: Session, ttx: TTX, doc: ScenarioDocument, checked: _Checked):
    actor_id: dict[str, uuid.UUID] = {}
    for position, item in enumerate(doc.cast):
        origin, origin_id, origin_name = _origin(item, position in checked.unknown_actor_origins)
        actor = MselSimulatedActor(
            ttx_id=ttx.id,
            code=item.code,
            position=position,
            name=item.name,
            type=item.type,
            description=item.description,
            channel=item.channel.value if item.channel else None,
            origin=origin or ActorOrigin.EXERCISE,
            origin_id=origin_id,
            origin_name=origin_name,
        )
        session.add(actor)
        actor_id[item.code] = actor.id
    ttx.next_actor_number = _next(doc.next_actor_number, [a.code for a in doc.cast])
    session.add(ttx)
    return actor_id


def _write_tags(session: Session, ttx: TTX, doc: ScenarioDocument, checked: _Checked) -> None:
    for position, item in enumerate(doc.tags):
        origin, origin_id, origin_name = _origin(item, position in checked.unknown_tag_origins)
        tag = TTXTag(
            ttx_id=ttx.id,
            name=item.name,
            color=item.color,
            custom_hex=item.custom_hex,
            origin=origin,
            origin_id=origin_id,
            origin_name=(origin_name or "")[:64] or None,
        )
        session.add(tag)
        if item.applied:
            session.flush()
            session.add(TTXTagAssignment(ttx_tag_id=tag.id, ttx_id=ttx.id))


def _write_rooms(session: Session, ttx: TTX, doc: ScenarioDocument) -> dict[str, uuid.UUID]:
    """The document's rooms, matched by code: a room the exercise already has
    keeps its Players (renamed as the document says), one it doesn't is
    added, one the document lacks goes (its Players left without a room).
    Returns each code's room id."""
    existing = {r.code: r for r in list_rooms(session, ttx.id)}
    wanted = {r.code for r in doc.rooms}
    gone = [r.id for code, r in existing.items() if code not in wanted]
    if gone:
        for access in session.exec(select(TTXAccess).where(TTXAccess.room_id.in_(gone))):
            access.room_id = None
            session.add(access)
        session.flush()
        session.execute(delete(TTXRoom).where(TTXRoom.id.in_(gone)))
    ids: dict[str, uuid.UUID] = {}
    for position, item in enumerate(doc.rooms):
        room = existing.get(item.code) or TTXRoom(ttx_id=ttx.id, code=item.code, name=item.name)
        room.name, room.description, room.position = item.name, item.description, position
        session.add(room)
        ids[item.code] = room.id
    ttx.uses_rooms = doc.uses_rooms
    # Codes are never reused, the exercise's own included.
    ttx.next_room_number = _next(
        max(ttx.next_room_number, doc.next_room_number), [*existing, *wanted]
    )
    return ids


def _write_msel(
    session: Session,
    ttx: TTX,
    doc: ScenarioDocument,
    section: ScenarioMselV8,
    checked: _Checked,
    objective_id: dict[str, uuid.UUID],
    actor_id: dict[str, uuid.UUID],
    room_id: dict[str, uuid.UUID],
    user: User,
    files: list[tuple[Path, bytes]],
    revision: int,
) -> None:
    msel = TTXMsel(
        ttx_id=ttx.id,
        revision=revision,
        needs_form_version=1,
        title=section.title,
        summary=section.summary,
        attack_version=section.attack_version,
        duration_minutes=section.duration_minutes,
        time_compression=section.time_compression,
        meters=[meter.model_dump() for meter in section.meters],
        next_phase_number=_next(section.next_phase_number, [p.code for p in section.phases]),
        next_inject_number=_next(section.next_inject_number, [i.code for i in section.injects]),
        next_threat_actor_number=_next(
            section.next_threat_actor_number, [t.code for t in section.threat_actors]
        ),
        updated_by_id=user.id,
    )
    session.add(msel)
    session.flush()

    phase_id: dict[str, uuid.UUID] = {}
    for position, item in enumerate(section.phases):
        phase = MselPhase(
            msel_id=msel.id,
            code=item.code,
            position=position,
            name=item.name,
            headline=item.headline,
            start_offset=item.start_offset,
            end_offset=item.end_offset,
            incident_jump_minutes=item.incident_jump_minutes,
            situation_update=item.situation_update,
            key_questions=item.key_questions,
        )
        session.add(phase)
        phase_id[item.code] = phase.id
    threat_id: dict[str, uuid.UUID] = {}
    for position, item in enumerate(section.threat_actors):
        origin, origin_id, origin_name = _origin(item, False)
        threat = MselThreatActor(
            msel_id=msel.id,
            code=item.code,
            position=position,
            name=item.name,
            mitre_group_id=item.mitre_group_id,
            aliases=list(dict.fromkeys(a.strip() for a in item.aliases if a.strip())),
            description=item.description,
            techniques=[t.model_dump() for t in {t.key(): t for t in item.techniques}.values()],
            origin=origin or ActorOrigin.EXERCISE,
            origin_id=origin_id,
            origin_name=origin_name,
        )
        session.add(threat)
        threat_id[item.code] = threat.id
    image_id: dict[str, uuid.UUID] = {}
    for item in doc.images:
        data, content_type, width, height = checked.images[item.key]
        image = MselImage(
            msel_id=msel.id,
            stored_name=f"{uuid.uuid4().hex}{_EXTENSIONS[content_type]}",
            content_type=content_type,
            width=width,
            height=height,
            size_bytes=len(data),
            uploaded_by_id=user.id,
        )
        session.add(image)
        image_id[item.key] = image.id
        files.append((image_path(image), data))
    file_id: dict[str, uuid.UUID] = {}
    for item in doc.files:
        data = checked.files[item.key]
        row = MselFile(
            msel_id=msel.id,
            stored_name=uuid.uuid4().hex,
            original_name=safe_filename(item.name),
            size_bytes=len(data),
            sha256=item.sha256,
            uploaded_by_id=user.id,
        )
        session.add(row)
        file_id[item.key] = row.id
        files.append((file_path(row), data))
    session.flush()
    session.add_all(
        MselPhaseObjective(phase_id=phase_id[p.code], objective_id=objective_id[o.code], due=o.due)
        for p in section.phases
        for o in {o.code: o for o in p.objectives}.values()
    )

    inject_rows: dict[str, Inject] = {}
    for position, item in enumerate(section.injects):
        contingent = item.kind == InjectKind.CONTINGENT
        attribution = item.attack_attribution
        inject = Inject(
            ttx_id=ttx.id,
            msel_id=msel.id,
            phase_id=phase_id.get(item.phase_code) if item.phase_code else None,
            code=item.code,
            position=position,
            kind=item.kind,
            title=item.title,
            content=item.content,
            offset_minutes=item.offset_minutes,
            trigger_condition=item.trigger_condition,
            contingent_purpose=item.contingent_purpose,
            fires_at_minute=item.fires_at_minute if contingent else None,
            simulated_actor_id=actor_id.get(item.sender_code) if item.sender_code else None,
            attack_attribution=attribution,
            threat_actor_id=threat_id.get(item.threat_actor_code)
            if attribution == AttackAttribution.THREAT_ACTOR and item.threat_actor_code
            else None,
            recipients=list(dict.fromkeys(item.recipients)),
            room_ids=[room_id[c] for c in dict.fromkeys(item.room_codes) if c in room_id],
            delivery_method=item.delivery_method,
            attachment_notes=item.attachment_notes,
            facilitator_notes=item.facilitator_notes,
            artifact=item.artifact.model_dump() if item.artifact else None,
            format=item.format,
            poll_question=item.poll_question,
            poll_options=item.poll_options,
            poll_outcomes=item.poll_outcomes,
            poll_impacts=item.poll_impacts,
            origin=item.origin,
            origin_id=item.origin_id if item.origin else None,
            origin_name=item.origin_name if item.origin else None,
            created_by_id=user.id,
        )
        session.add(inject)
        inject_rows[item.code] = inject
    session.flush()

    action_id: dict[str, uuid.UUID] = {}
    for item in section.injects:
        inject = inject_rows[item.code]
        own = (
            list(dict.fromkeys(item.objective_codes)) if item.format == InjectFormat.INJECT else []
        )
        session.add_all(
            InjectObjective(inject_id=inject.id, objective_id=objective_id[code]) for code in own
        )
        if item.attack_attribution is not None:
            refs = {(t.domain, t.tactic_id, t.technique_id): t for t in item.attack_techniques}
            session.add_all(
                InjectAttackTechnique(
                    inject_id=inject.id,
                    position=position,
                    domain=t.domain,
                    tactic_id=t.tactic_id,
                    technique_id=t.technique_id,
                )
                for position, t in enumerate(refs.values())
            )
        for position, action in enumerate(item.expected_actions):
            row = InjectExpectedAction(
                inject_id=inject.id,
                code=action.code,
                position=position,
                description=action.description,
                responsible_role=action.responsible_role,
                expected_within_minutes=action.expected_within_minutes,
                objective_ids=[objective_id[c] for c in action.objective_codes if c in own],
            )
            session.add(row)
            action_id[action.code] = row.id
        seen: set[str] = set()
        for position, link in enumerate(item.images):
            if link.image in seen:
                continue
            seen.add(link.image)
            session.add(
                InjectImage(
                    inject_id=inject.id,
                    image_id=image_id[link.image],
                    position=position,
                    caption=link.caption,
                )
            )
        seen = set()
        for position, link in enumerate(item.files):
            if link.file in seen:
                continue
            seen.add(link.file)
            session.add(
                InjectFile(
                    inject_id=inject.id,
                    file_id=file_id[link.file],
                    position=position,
                    description=link.description,
                )
            )
    session.flush()

    # Branches point at other injects and their actions: a second pass.
    for item in section.injects:
        if item.kind != InjectKind.CONTINGENT:
            continue
        inject = inject_rows[item.code]
        if item.branch_from_code:
            inject.branch_from_id = inject_rows[item.branch_from_code].id
        if item.branch_action_code:
            inject.branch_action_id = action_id[item.branch_action_code]
        if item.rejoin_code:
            inject.rejoin_inject_id = inject_rows[item.rejoin_code].id
        session.add(inject)
    session.flush()


def has_runs(session: Session, ttx: TTX) -> bool:
    """Played: a run, live or archived, holds snapshots of its design."""
    return (
        session.exec(select(ExerciseRun.id).where(ExerciseRun.ttx_id == ttx.id)).first() is not None
    )


def apply_document(
    session: Session,
    ttx: TTX,
    doc: ScenarioDocument,
    user: User,
    *,
    dry_run: bool,
    origin: tuple[str, str, str] | None = None,
    variables: dict[str, str] | None = None,
) -> ScenarioCheck:
    """Overwrite the exercise with the document -- or, with `dry_run`, do
    every write and roll it all back. Never partial: errors leave the
    exercise as it was. `origin` (level, id, name) records the library
    scenario it came from; `variables` fill its {placeholders} first."""
    placeholders = document_variables(doc)
    doc, fill_errors = fill_variables(doc, variables or {})
    checked = check_document(doc)
    checked.errors = fill_errors + checked.errors
    # Every run, live or archived, plays snapshots hanging off the MSEL and
    # the plan this would delete: a played exercise keeps its design.
    if has_runs(session, ttx):
        checked.errors.insert(
            0,
            ScenarioIssue(
                path="exercise",
                code="SCENARIO_EXERCISE_PLAYED",
                message="This exercise has a session, live or archived, that keeps "
                "the design it ran: apply the scenario to a new exercise.",
            ),
        )
    report = ScenarioCheck(
        ok=not checked.errors,
        errors=checked.errors,
        variables=placeholders,
        warnings=checked.warnings,
        name=doc.exercise.name,
        language=doc.language,
        format_version=doc.format_version,
        counts=counts(doc),
        replaces=ttx_counts(session, ttx),
    )
    if checked.errors:
        return report

    files: list[tuple[Path, bytes]] = []
    try:
        ttx = session.exec(select(TTX).where(TTX.id == ttx.id).with_for_update()).one()
        form = get_form(session, ttx.id, lock=True)
        previous_msel = find_msel(session, ttx.id)
        msel_revision = previous_msel.revision + 1 if previous_msel else 0
        _clear(session, ttx, form)
        ttx.name = doc.exercise.name
        ttx.description = doc.exercise.description
        # The scenario's content brings its language.
        ttx.content_language = doc.language
        ttx.scenario_origin, ttx.scenario_origin_id, ttx.scenario_origin_name = origin or (
            None,
            None,
            None,
        )
        objective_id = _write_needs(session, form, doc, user)
        actor_id = _write_cast(session, ttx, doc, checked)
        _write_tags(session, ttx, doc, checked)
        room_id = _write_rooms(session, ttx, doc)
        session.flush()
        if doc.msel is not None:
            _write_msel(
                session,
                ttx,
                doc,
                doc.msel,
                checked,
                objective_id,
                actor_id,
                room_id,
                user,
                files,
                msel_revision,
            )
        session.add(ttx)
        session.flush()
    except Exception:
        session.rollback()
        logger.exception("Applying a scenario to TTX %s failed.", ttx.id)
        report.ok = False
        report.errors = [
            ScenarioIssue(
                path="data",
                code="SCENARIO_APPLY_FAILED",
                message="The scenario couldn't be written to this exercise.",
            )
        ]
        return report

    if dry_run:
        session.rollback()
        return report

    written: list[Path] = []
    try:
        if files:
            ensure_msel_image_dir()
            ensure_msel_file_dir()
        for path, data in files:
            path.write_bytes(data)
            written.append(path)
        session.commit()
    except Exception:
        session.rollback()
        for path in written:
            path.unlink(missing_ok=True)
        raise
    logger.info("Scenario %r applied to TTX %s by user %s.", doc.exercise.name, ttx.id, user.id)
    return report
