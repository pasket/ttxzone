"""MSEL (Creator -> MSEL): the Master Scenario Events List of an exercise,
built from the approved objectives of its needs analysis.

Same shape as the needs form (ttx_needs_form_service), on purpose:
- one MSEL per TTX, created lazily the first time it's opened with an
  approved needs form, seeded with neutral simulated actors;
- the whole MSEL is saved at once (full replace, keyed by id; new rows are
  referenced by a payload `key`), under an optimistic `revision` lock;
- the backend is the authority on the rules: saving rejects only what can
  never be stored, everything else is the validation report (rules
  M01-M21), enforced on status transitions and available as a dry run;
- any edit past DRAFT sends the MSEL back to DRAFT (from READY it opens
  version N+1); becoming READY freezes a snapshot.

It is editable only while the needs analysis is APPROVED. When that form
goes back to DRAFT the MSEL turns read-only, and once the form is approved
again with another version the MSEL must acknowledge it (M02).
"""

import logging
import re
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from types import SimpleNamespace

from sqlalchemy import delete, update
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.data.actor_catalog import ACTOR_CATALOG, ACTOR_CATALOG_BY_ID
from app.data.attack_catalog import (
    ATTACK_VERSIONS,
    LATEST_ATTACK_VERSION,
    is_live_technique,
    is_selectable,
    load_groups,
)
from app.data.attack_catalog import names as attack_names
from app.data.inject_catalog import catalog_inject
from app.models import (
    TTX,
    ActorOrigin,
    AttackAttribution,
    ExerciseRun,
    Inject,
    InjectAttackTechnique,
    InjectExpectedAction,
    InjectFile,
    InjectFormat,
    InjectImage,
    InjectKind,
    InjectObjective,
    InjectReviewStatus,
    MselFile,
    MselImage,
    MselPhase,
    MselPhaseObjective,
    MselSimulatedActor,
    MselSnapshot,
    MselStatus,
    MselThreatActor,
    NeedsFormStatus,
    TTXMsel,
    TTXNeedsForm,
    TTXObjective,
    User,
)
from app.schemas.threat_actor_library import ThreatActorTechnique
from app.schemas.ttx_msel import (
    MAX_ACTORS,
    MAX_INJECTS,
    MAX_THREAT_ACTORS,
    ActorRead,
    AttackRef,
    AttackRefRead,
    AttackReplacement,
    ExpectedActionRead,
    FrozenVersionRead,
    InjectFileRead,
    InjectImageRead,
    InjectRead,
    MeterRead,
    MselRead,
    MselRoomRead,
    MselSaveRequest,
    NeedsContext,
    NeedsObjectiveSummary,
    PhaseRead,
    ThreatActorRead,
    refs,
)
from app.schemas.ttx_needs_form import ValidationIssue, ValidationReport
from app.services.attack_conversion import ConversionReport, convert_profile, convert_refs
from app.services.code_renumber import (
    code_number,
    code_rewriter,
    next_number,
    out_of_order,
    planned_codes,
    rewrite_fields,
)
from app.services.library_usage_service import ensure_not_disabled
from app.services.msel_file_service import (
    delete_files_for_msels,
    drop_unused_files,
    files_by_id,
)
from app.services.msel_image_service import (
    delete_images_for_msels,
    drop_unused_images,
    ensure_msel_image_dir,
    image_path,
    images_by_id,
    stage_catalog_images,
)
from app.services.threat_actor_library_service import technique_read
from app.services.ttx_needs_form_service import get_form
from app.services.ttx_room_service import list_rooms

logger = logging.getLogger(__name__)

# Tabs of the MSEL page -- a ValidationIssue's `section` (the page orders
# the tabs: Scenario, Threat actors, Phases, Injects, Coverage, Review --
# Review holds the load by recipient and the needs-version check). Section 4 was the timeline tab,
# whose issues (bursts, storyline branches) belong to Injects; it is the
# threat actors' now.
SCENARIO, PHASES, INJECTS, THREAT_ACTORS, COVERAGE, REVIEW = 1, 2, 3, 4, 5, 6

MIN_PHASES = 2
PHASE_GAP_MINUTES = 10
BURST_WINDOW_MINUTES, BURST_MAX = 5, 3
OVERLOAD_WINDOW_MINUTES, OVERLOAD_MAX = 10, 3
MIN_ACTIONS_PER_OBJECTIVE = 2

# Expected actions that can't be observed (M13), per supported locale:
# internal verbs an evaluator can't see happen -- an action should be
# something said, decided or recorded in the room. Matched as whole words
# or phrases, case-insensitively; a warning only. Mirrored by the
# frontend's VAGUE_ACTION_WORDS (lib/msel.ts), which quotes the match.
VAGUE_ACTION_WORDS: dict[str, tuple[str, ...]] = {
    "en": ("manage", "assess", "check", "analyse the situation", "analyze the situation"),
    "es": ("gestionar", "valorar", "comprobar", "analizar la situación"),
}
_VAGUE_ACTION = re.compile(
    r"\b(" + "|".join(re.escape(w) for ws in VAGUE_ACTION_WORDS.values() for w in ws) + r")\b",
    re.IGNORECASE,
)

DEFAULT_SESSION_MINUTES = 180
DEFAULT_TIME_COMPRESSION = 60  # one session minute = one hour of incident


def _reject(
    code: str, message: str, status_code: int = 422, params: dict | None = None
) -> AppException:
    return AppException(code, message, status_code, log_level=logging.WARNING, params=params)


def _not_approved(ttx: TTX) -> AppException:
    return AppException(
        "NEEDS_FORM_NOT_APPROVED",
        "The MSEL can be edited only while the needs analysis is approved.",
        409,
        ttx_id=str(ttx.id),
        log_level=logging.WARNING,
    )


# -- reads ----------------------------------------------------------------


def find_msel(session: Session, ttx_id: uuid.UUID, *, lock: bool = False) -> TTXMsel | None:
    query = select(TTXMsel).where(TTXMsel.ttx_id == ttx_id)
    if lock:
        query = query.with_for_update()
    return session.exec(query).first()


def msel_statuses(session: Session, ttx_ids: list[uuid.UUID]) -> dict[uuid.UUID, MselStatus]:
    """MSEL status per exercise in one query (TTX lists); absent = no MSEL yet."""
    if not ttx_ids:
        return {}
    rows = session.exec(select(TTXMsel.ttx_id, TTXMsel.status).where(TTXMsel.ttx_id.in_(ttx_ids)))
    return dict(rows.all())


def open_msel(session: Session, ttx: TTX, user: User, locale: str) -> TTXMsel:
    """The exercise's MSEL, created on first use -- which needs an approved
    needs analysis (the design gate). The form row is locked while
    creating, so two first opens at once can't both create one."""
    msel = find_msel(session, ttx.id)
    if msel is not None:
        return msel
    form = get_form(session, ttx.id, lock=True)
    msel = find_msel(session, ttx.id)
    if msel is not None:
        return msel
    if form.status != NeedsFormStatus.APPROVED:
        raise AppException(
            "NEEDS_FORM_NOT_APPROVED",
            "Approve the exercise's needs analysis before writing its MSEL.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.INFO,
        )
    # Start from the most common tabletop: a 3-hour session (or the needs
    # form's maximum, if shorter) where each session minute is an hour of
    # incident -- enough to cover the first days of a crisis.
    max_minutes = form.max_duration_hours * 60 if form.max_duration_hours else None
    msel = TTXMsel(
        ttx_id=ttx.id,
        needs_form_version=form.version,
        updated_by_id=user.id,
        duration_minutes=min(DEFAULT_SESSION_MINUTES, max_minutes or DEFAULT_SESSION_MINUTES),
        time_compression=DEFAULT_TIME_COMPRESSION,
    )
    # Without ORM relationships the unit of work doesn't order inserts by
    # foreign key, so each level is flushed before the rows that point at it.
    session.add(msel)
    session.flush()
    # The cast (the exercise's, maybe already seeded from Templates) gets
    # the actors of the regulations the needs analysis names, if missing.
    ensure_cast(session, ttx, locale, form.regulatory_frameworks)
    session.add(msel)
    session.commit()
    session.refresh(msel)
    logger.info("MSEL created for TTX %s by user %s.", ttx.id, user.id)
    return msel


def _children(session: Session, msel: TTXMsel):
    actors = list(
        session.exec(
            select(MselSimulatedActor)
            .where(MselSimulatedActor.ttx_id == msel.ttx_id)
            .order_by(MselSimulatedActor.position)
        )
    )
    phases = list(
        session.exec(
            select(MselPhase).where(MselPhase.msel_id == msel.id).order_by(MselPhase.position)
        )
    )
    injects = list(
        session.exec(select(Inject).where(Inject.msel_id == msel.id).order_by(Inject.position))
    )
    phase_objectives: dict[uuid.UUID, list[MselPhaseObjective]] = {p.id: [] for p in phases}
    if phases:
        for link in session.exec(
            select(MselPhaseObjective).where(
                MselPhaseObjective.phase_id.in_(list(phase_objectives))
            )
        ):
            phase_objectives[link.phase_id].append(link)
    inject_objectives: dict[uuid.UUID, list[uuid.UUID]] = {i.id: [] for i in injects}
    actions: dict[uuid.UUID, list[InjectExpectedAction]] = {i.id: [] for i in injects}
    if injects:
        ids = list(inject_objectives)
        for link in session.exec(select(InjectObjective).where(InjectObjective.inject_id.in_(ids))):
            inject_objectives[link.inject_id].append(link.objective_id)
        for action in session.exec(
            select(InjectExpectedAction)
            .where(InjectExpectedAction.inject_id.in_(ids))
            .order_by(InjectExpectedAction.position)
        ):
            actions[action.inject_id].append(action)
    return actors, phases, injects, phase_objectives, inject_objectives, actions


def _technique_rows(
    session: Session, inject_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[InjectAttackTechnique]]:
    per_inject: dict[uuid.UUID, list[InjectAttackTechnique]] = {i: [] for i in inject_ids}
    if inject_ids:
        for row in session.exec(
            select(InjectAttackTechnique)
            .where(InjectAttackTechnique.inject_id.in_(inject_ids))
            .order_by(InjectAttackTechnique.position)
        ):
            per_inject[row.inject_id].append(row)
    return per_inject


def _image_rows(session: Session, inject_ids: list[uuid.UUID]) -> dict[uuid.UUID, list]:
    """Each inject's images, in order, with their captions."""
    per_inject: dict[uuid.UUID, list[InjectImageRead]] = {i: [] for i in inject_ids}
    if inject_ids:
        for link, image in session.exec(
            select(InjectImage, MselImage)
            .join(MselImage, MselImage.id == InjectImage.image_id)
            .where(InjectImage.inject_id.in_(inject_ids))
            .order_by(InjectImage.position)
        ):
            per_inject[link.inject_id].append(
                InjectImageRead(
                    id=image.id, caption=link.caption, width=image.width, height=image.height
                )
            )
    return per_inject


def _file_rows(session: Session, inject_ids: list[uuid.UUID]) -> dict[uuid.UUID, list]:
    """Each inject's files, in order, with their descriptions."""
    per_inject: dict[uuid.UUID, list[InjectFileRead]] = {i: [] for i in inject_ids}
    if inject_ids:
        for link, file in session.exec(
            select(InjectFile, MselFile)
            .join(MselFile, MselFile.id == InjectFile.file_id)
            .where(InjectFile.inject_id.in_(inject_ids))
            .order_by(InjectFile.position)
        ):
            per_inject[link.inject_id].append(
                InjectFileRead(
                    id=file.id,
                    name=file.original_name,
                    size_bytes=file.size_bytes,
                    sha256=file.sha256,
                    description=link.description,
                )
            )
    return per_inject


def _threat_actors(session: Session, msel: TTXMsel) -> list[MselThreatActor]:
    return list(
        session.exec(
            select(MselThreatActor)
            .where(MselThreatActor.msel_id == msel.id)
            .order_by(MselThreatActor.position)
        )
    )


def threat_actor_read(actor: MselThreatActor, version: str) -> ThreatActorRead:
    return ThreatActorRead(
        id=actor.id,
        code=actor.code,
        name=actor.name,
        mitre_group_id=actor.mitre_group_id,
        aliases=actor.aliases,
        description=actor.description,
        techniques=[
            technique_read(version, t["domain"], t["technique_id"]) for t in actor.techniques
        ],
        origin=actor.origin,
        origin_id=actor.origin_id,
        origin_name=actor.origin_name,
        modified_at=actor.modified_at,
    )


def _check_threat_actor(version: str, item) -> None:
    """A scenario's threat actor may name a live MITRE group of the MSEL's
    release, and live techniques of it."""
    group = load_groups(version).get(item.mitre_group_id) if item.mitre_group_id else None
    if item.mitre_group_id and (group is None or group.deprecated):
        raise _reject(
            "UNKNOWN_ATTACK_GROUP",
            "{group} isn't a group of ATT&CK v{version}.",
            params={"group": item.mitre_group_id, "version": version},
        )
    unknown = [t.technique_id for t in item.techniques if not is_live_technique(version, *t.key())]
    if unknown:
        raise _reject(
            "UNKNOWN_ATTACK_TECHNIQUE",
            "Not a technique of ATT&CK v{version}: {techniques}.",
            params={"version": version, "techniques": ", ".join(unknown)},
        )


def _threat_actor_content(actor: MselThreatActor) -> tuple:
    """What the planning team edits of a threat actor -- what makes a copy
    differ from its original."""
    return (
        actor.name,
        actor.mitre_group_id,
        tuple(actor.aliases),
        actor.description,
        tuple((t["domain"], t["technique_id"]) for t in actor.techniques),
    )


def _write_threat_actor(actor: MselThreatActor, item) -> None:
    actor.name = item.name.strip()
    actor.mitre_group_id = item.mitre_group_id
    actor.aliases = list(dict.fromkeys(a.strip() for a in item.aliases if a.strip()))
    actor.description = item.description
    actor.techniques = [t.model_dump() for t in item.techniques]
    actor.origin = item.origin or ActorOrigin.EXERCISE
    copied = actor.origin != ActorOrigin.EXERCISE
    actor.origin_id = item.origin_id if copied else None
    actor.origin_name = item.origin_name if copied else None


def _new_threat_actor(msel: TTXMsel) -> MselThreatActor:
    actor = MselThreatActor(msel_id=msel.id, code=f"THR-{msel.next_threat_actor_number:02d}")
    msel.next_threat_actor_number += 1
    return actor


def _ref_read(version: str, row) -> AttackRefRead:
    tactic_name, technique_name = attack_names(version, row.domain, row.tactic_id, row.technique_id)
    return AttackRefRead(
        domain=row.domain,
        tactic_id=row.tactic_id,
        technique_id=row.technique_id,
        tactic_name=tactic_name,
        technique_name=technique_name,
    )


def _check_attack_refs(version: str, refs: list[AttackRef]) -> None:
    unknown = [
        r.technique_id
        for r in refs
        if not is_selectable(version, r.domain, r.tactic_id, r.technique_id)
    ]
    if unknown:
        raise _reject(
            "UNKNOWN_ATTACK_TECHNIQUE",
            "Not a technique of that tactic in ATT&CK v{version}: {techniques}.",
            params={"version": version, "techniques": ", ".join(unknown)},
        )


def actor_read(actor: MselSimulatedActor) -> ActorRead:
    return ActorRead(
        id=actor.id,
        code=actor.code,
        name=actor.name,
        type=actor.type,
        description=actor.description,
        channel=actor.channel,
        origin=actor.origin,
        origin_id=actor.origin_id,
        origin_name=actor.origin_name,
        played_by=actor.played_by,
    )


def _check_origin(origin: ActorOrigin | None, origin_id: str | None) -> None:
    """A copy of a TTX-Zone actor must name one that exists; other origins
    are informational (the original may since have been deleted)."""
    if origin == ActorOrigin.SYSTEM and origin_id not in ACTOR_CATALOG_BY_ID:
        raise _reject("UNKNOWN_SYSTEM_ACTOR", "That TTX-Zone actor doesn't exist.")


def _write_actor(actor: MselSimulatedActor, item) -> None:
    _check_origin(item.origin, item.origin_id)
    actor.name = item.name
    actor.type = item.type
    actor.description = item.description
    actor.channel = item.channel.value if item.channel else None
    actor.origin = item.origin or ActorOrigin.EXERCISE
    actor.origin_id = item.origin_id if item.origin else None
    actor.origin_name = item.origin_name if item.origin else None
    actor.played_by = item.played_by


def _needs_context(session: Session, form: TTXNeedsForm) -> NeedsContext:
    objectives = session.exec(
        select(TTXObjective).where(TTXObjective.form_id == form.id).order_by(TTXObjective.position)
    ).all()
    return NeedsContext(
        status=form.status,
        version=form.version,
        tlp=form.tlp,
        participating_areas=form.participating_areas,
        third_parties=form.third_parties,
        max_duration_hours=form.max_duration_hours,
        objectives=[
            NeedsObjectiveSummary(
                id=o.id, code=o.code, title=o.title, statement=o.statement, capability=o.capability
            )
            for o in objectives
        ],
    )


def msel_read(session: Session, ttx: TTX, msel: TTXMsel) -> MselRead:
    form = get_form(session, ttx.id)
    context = _needs_context(session, form)
    actors, phases, injects, phase_objectives, inject_objectives, actions = _children(session, msel)
    inject_techniques = _technique_rows(session, [i.id for i in injects])
    inject_images = _image_rows(session, [i.id for i in injects])
    inject_files = _file_rows(session, [i.id for i in injects])
    threat_actors = _threat_actors(session, msel)
    phase_reads = [
        PhaseRead(
            id=p.id,
            code=p.code,
            name=p.name,
            headline=p.headline,
            start_offset=p.start_offset,
            end_offset=p.end_offset,
            incident_jump_minutes=p.incident_jump_minutes,
            situation_update=p.situation_update,
            key_questions=p.key_questions,
            objective_ids=[link.objective_id for link in phase_objectives[p.id]],
            due_objective_ids=[link.objective_id for link in phase_objectives[p.id] if link.due],
        )
        for p in phases
    ]
    inject_reads = [
        InjectRead(
            id=i.id,
            code=i.code,
            phase_id=i.phase_id,
            kind=i.kind,
            title=i.title,
            content=i.content,
            offset_minutes=i.offset_minutes,
            trigger_condition=i.trigger_condition,
            contingent_purpose=i.contingent_purpose,
            fires_at_minute=i.fires_at_minute,
            format=i.format,
            poll_question=i.poll_question,
            poll_options=i.poll_options,
            poll_outcomes=i.poll_outcomes,
            poll_impacts=i.poll_impacts,
            branch_from_id=i.branch_from_id,
            branch_action_id=i.branch_action_id,
            rejoin_inject_id=i.rejoin_inject_id,
            simulated_actor_id=i.simulated_actor_id,
            attack_attribution=i.attack_attribution,
            threat_actor_id=i.threat_actor_id,
            recipients=i.recipients,
            room_ids=i.room_ids,
            delivery_method=i.delivery_method,
            attachment_notes=i.attachment_notes,
            attack_techniques=[
                _ref_read(msel.attack_version, row) for row in inject_techniques[i.id]
            ],
            facilitator_notes=i.facilitator_notes,
            artifact=i.artifact,
            review_status=i.review_status,
            validated_by=i.validated_by,
            validated_by_id=i.validated_by_id,
            origin=i.origin,
            origin_id=i.origin_id,
            origin_name=i.origin_name,
            objective_ids=inject_objectives[i.id],
            expected_actions=[
                ExpectedActionRead(
                    id=a.id,
                    code=a.code,
                    description=a.description,
                    responsible_role=a.responsible_role,
                    expected_within_minutes=a.expected_within_minutes,
                    objective_ids=[o for o in a.objective_ids if o in inject_objectives[i.id]],
                )
                for a in actions[i.id]
            ],
            images=inject_images[i.id],
            files=inject_files[i.id],
        )
        for i in injects
    ]
    threat_actor_reads = [threat_actor_read(a, msel.attack_version) for a in threat_actors]
    # What the exercise exercises of ATT&CK: every technique its injects use.
    used = {ref.key(): ref for inject in inject_reads for ref in inject.attack_techniques}
    rooms = [MselRoomRead(id=r.id, code=r.code, name=r.name) for r in list_rooms(session, ttx.id)]
    scenario = _scenario_view(msel, [_threat_actor_view(t) for t in threat_actor_reads])
    _rooms_view(scenario, ttx, rooms)
    report = validation_report(
        scenario,
        context,
        [_phase_view(p) for p in phase_reads],
        [_inject_view(i) for i in inject_reads],
    )
    return MselRead(
        id=msel.id,
        ttx_id=ttx.id,
        exercise_code=ttx.code,
        status=msel.status,
        version=msel.version,
        revision=msel.revision,
        needs_form_version=msel.needs_form_version,
        # Archived: read-only (every write is refused).
        editable=form.status == NeedsFormStatus.APPROVED and ttx.archived_at is None,
        needs=context,
        title=msel.title,
        summary=msel.summary,
        attack_version=msel.attack_version,
        threat_actors=threat_actor_reads,
        attack_techniques=list(used.values()),
        exercise_start=msel.exercise_start,
        incident_start=msel.incident_start,
        incident_date=msel.incident_date,
        duration_minutes=msel.duration_minutes,
        time_compression=msel.time_compression,
        meters=[MeterRead(**meter) for meter in msel.meters],
        actors=[actor_read(a) for a in actors],
        phases=phase_reads,
        injects=inject_reads,
        uses_rooms=ttx.uses_rooms,
        rooms=rooms,
        updated_at=msel.updated_at,
        ready_by=msel.ready_by,
        ready_by_id=msel.ready_by_id,
        ready_at=msel.ready_at,
        validation=report,
        renumberable=renumberable(session, msel),
        frozen_versions=frozen_versions(session, msel) if msel.status == MselStatus.DRAFT else [],
    )


# -- validation (M01-M24) -------------------------------------------------
#
# The rules run on plain views, built either from the saved MSEL (via its
# read model) or from an unsaved payload (dry run), with every row's `id`
# being what the report should name it by: the row id once saved, the
# payload key before.


def _scenario_view(source, threat_actors: list):
    return SimpleNamespace(
        title=source.title,
        summary=source.summary,
        duration_minutes=source.duration_minutes,
        threat_actors=threat_actors,
        # (key, name), from a row's dicts or a payload's models.
        meters=[
            (m["key"], m["name"]) if isinstance(m, dict) else (m.key, m.name) for m in source.meters
        ],
        needs_form_version=getattr(source, "needs_form_version", None),
    )


def _rooms_view(scenario: SimpleNamespace, ttx: TTX, rooms: list) -> None:
    scenario.uses_rooms = ttx.uses_rooms
    scenario.rooms = [SimpleNamespace(id=str(r.id), code=r.code) for r in rooms]


def _threat_actor_view(actor, view_id: str | None = None) -> SimpleNamespace:
    """`view_id`: how the report names an unsaved one (its payload key)."""
    return SimpleNamespace(
        id=view_id or str(actor.id),
        name=actor.name,
        techniques={(t.domain, t.technique_id) for t in actor.techniques},
    )


def _phase_view(phase: PhaseRead) -> SimpleNamespace:
    return SimpleNamespace(
        id=str(phase.id),
        name=phase.name,
        start_offset=phase.start_offset,
        end_offset=phase.end_offset,
        objective_ids=[str(o) for o in phase.objective_ids],
    )


def _inject_view(inject: InjectRead) -> SimpleNamespace:
    return SimpleNamespace(
        id=str(inject.id),
        phase_id=str(inject.phase_id) if inject.phase_id else None,
        kind=inject.kind,
        title=inject.title,
        content=inject.content,
        offset_minutes=inject.offset_minutes,
        trigger_condition=inject.trigger_condition,
        contingent_purpose=inject.contingent_purpose,
        fires_at_minute=inject.fires_at_minute,
        format=inject.format,
        poll_question=inject.poll_question,
        poll_options=inject.poll_options,
        poll_outcomes=inject.poll_outcomes,
        poll_impacts=inject.poll_impacts,
        branch_from=str(inject.branch_from_id) if inject.branch_from_id else None,
        branch_action=str(inject.branch_action_id) if inject.branch_action_id else None,
        rejoin=str(inject.rejoin_inject_id) if inject.rejoin_inject_id else None,
        has_actor=inject.simulated_actor_id is not None,
        recipients=list(inject.recipients),
        room_ids=[str(r) for r in inject.room_ids],
        attack_attribution=inject.attack_attribution,
        threat_actor=str(inject.threat_actor_id) if inject.threat_actor_id else None,
        attack_techniques=[ref.key() for ref in inject.attack_techniques],
        review_status=inject.review_status,
        validated_by=inject.validated_by,
        validated_by_id=inject.validated_by_id,
        objective_ids=[str(o) for o in inject.objective_ids],
        actions=[
            SimpleNamespace(
                id=str(a.id),
                description=a.description,
                responsible_role=a.responsible_role,
                expected_within_minutes=a.expected_within_minutes,
                objective_ids=[str(o) for o in a.objective_ids or []],
            )
            for a in inject.expected_actions
        ],
    )


def _delivered_at(inject, phase_by_id: dict) -> int | None:
    """Session minute an inject reaches the players: a mandatory one's
    time; a contingent one's check minute in its phase (None if unset)."""
    if inject.kind == InjectKind.MANDATORY:
        return inject.offset_minutes
    phase = phase_by_id.get(inject.phase_id)
    if phase is None or inject.fires_at_minute is None:
        return None
    return phase.start_offset + inject.fires_at_minute


def validation_report(
    scenario, context: NeedsContext, phases: list, injects: list
) -> ValidationReport:
    """`ready` blocks DRAFT -> IN_REVIEW; `approved` (M12) additionally
    blocks IN_REVIEW -> READY; `warnings` never block."""
    ready: list[ValidationIssue] = []
    approved: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []

    def issue(target: list, code: str, section: int, field=None, item_id=None) -> None:
        target.append(ValidationIssue(code=code, section=section, field=field, item_id=item_id))

    def blank(value: str) -> bool:
        return not value.strip()

    # Required fields.
    for field in ("title", "summary"):
        if blank(getattr(scenario, field)):
            issue(ready, "MSEL_INCOMPLETE", SCENARIO, field)
    if scenario.duration_minutes is None:
        issue(ready, "MSEL_INCOMPLETE", SCENARIO, "duration_minutes")
    elif context.max_duration_hours and scenario.duration_minutes > context.max_duration_hours * 60:
        issue(ready, "DURATION_EXCEEDS_LIMIT", SCENARIO, "duration_minutes")

    # M02 -- the needs analysis was approved again with another version.
    if (
        scenario.needs_form_version is not None
        and context.status == NeedsFormStatus.APPROVED
        and context.version != scenario.needs_form_version
    ):
        issue(ready, "NEEDS_VERSION_CHANGED", REVIEW, "needs_form_version")

    # The scenario's threat actors: named (M21 below: attributed to).
    for actor in scenario.threat_actors:
        if blank(actor.name):
            issue(ready, "MSEL_INCOMPLETE", THREAT_ACTORS, "threat_actor_name", actor.id)

    if len(phases) < MIN_PHASES:
        issue(ready, "PHASES_REQUIRED", PHASES, "phases")
    duration = scenario.duration_minutes
    for phase in phases:
        if blank(phase.name):
            issue(ready, "MSEL_INCOMPLETE", PHASES, "name", phase.id)
        if phase.end_offset <= phase.start_offset:
            issue(ready, "PHASE_RANGE_INVALID", PHASES, "end_offset", phase.id)
        elif duration is not None and phase.end_offset > duration:
            issue(ready, "PHASE_AFTER_END", PHASES, "end_offset", phase.id)

    # M06 -- phases don't overlap nor leave session time between them
    # (warnings): the session never pauses, so a gap belongs in the scenario
    # (a phase's time jump; the Phases tab converts it).
    ordered = sorted(phases, key=lambda p: (p.start_offset, p.end_offset))
    for previous, current in zip(ordered, ordered[1:], strict=False):
        if current.start_offset < previous.end_offset:
            issue(warnings, "PHASES_OVERLAP", PHASES, "start_offset", current.id)
        elif current.start_offset > previous.end_offset:
            issue(warnings, "PHASE_GAP", PHASES, "start_offset", current.id)
    # ...and cover the session from T+0 to its end: a stretch no phase
    # holds has no situation update nor key questions to run on.
    if ordered and duration is not None:
        if ordered[0].start_offset > PHASE_GAP_MINUTES:
            issue(warnings, "SESSION_START_UNCOVERED", PHASES, "start_offset", ordered[0].id)
        last = max(ordered, key=lambda p: p.end_offset)
        if duration - last.end_offset > PHASE_GAP_MINUTES:
            issue(warnings, "SESSION_END_UNCOVERED", PHASES, "end_offset", last.id)

    if not injects:
        issue(ready, "MSEL_INCOMPLETE", INJECTS, "injects")
    phase_by_id = {p.id: p for p in phases}
    # Recipients and responsibles: the participating areas and the (optional)
    # third parties taking part.
    areas = set(context.participating_areas) | set(context.third_parties)
    threat_actors = {t.id: t for t in scenario.threat_actors}
    for inject in injects:
        poll = inject.format == InjectFormat.POLL
        if blank(inject.title):
            issue(ready, "MSEL_INCOMPLETE", INJECTS, "title", inject.id)
        # A poll goes straight to the Players: its context is optional, and
        # no one sends it.
        if not poll:
            if blank(inject.content):
                issue(ready, "MSEL_INCOMPLETE", INJECTS, "content", inject.id)
            if not inject.has_actor:
                issue(ready, "MSEL_INCOMPLETE", INJECTS, "actor_key", inject.id)
            if not inject.recipients:
                issue(ready, "MSEL_INCOMPLETE", INJECTS, "recipients", inject.id)
        # M27 -- a poll asks something, with at least two different options.
        else:
            options = [o.strip().casefold() for o in inject.poll_options]
            if blank(inject.poll_question):
                issue(ready, "POLL_INCOMPLETE", INJECTS, "poll_question", inject.id)
            if len(options) < 2 or not all(options) or len(set(options)) < len(options):
                issue(ready, "POLL_INCOMPLETE", INJECTS, "poll_options", inject.id)
        # M01 -- every inject of the inject format evaluates an objective
        # through expected actions (a discussion one or a poll needs neither).
        evaluated = inject.format == InjectFormat.INJECT
        if evaluated and not inject.objective_ids:
            issue(ready, "INJECT_WITHOUT_OBJECTIVE", INJECTS, "objective_ids", inject.id)
        if evaluated and not inject.actions:
            issue(ready, "INJECT_WITHOUT_EXPECTED_ACTION", INJECTS, "expected_actions", inject.id)
        if any(blank(a.description) for a in inject.actions):
            issue(ready, "MSEL_INCOMPLETE", INJECTS, "expected_actions", inject.id)
        # M05 -- a mandatory inject sits inside its phase and the session.
        if inject.kind == InjectKind.MANDATORY:
            phase = phase_by_id.get(inject.phase_id)
            if inject.offset_minutes is None:
                issue(ready, "INJECT_OFFSET_REQUIRED", INJECTS, "offset_minutes", inject.id)
            elif duration is not None and inject.offset_minutes > duration:
                issue(ready, "INJECT_AFTER_END", INJECTS, "offset_minutes", inject.id)
            elif phase is not None and not (
                phase.start_offset <= inject.offset_minutes <= phase.end_offset
            ):
                issue(ready, "INJECT_OUTSIDE_PHASE", INJECTS, "offset_minutes", inject.id)
        else:
            # M08 -- a contingent inject says when it fires and why.
            for field in ("trigger_condition", "contingent_purpose"):
                if blank(getattr(inject, field)):
                    issue(ready, "CONTINGENT_INCOMPLETE", INJECTS, field, inject.id)
            # M22 -- ...and is checked while its phase runs.
            phase = phase_by_id.get(inject.phase_id)
            if (
                phase is not None
                and inject.fires_at_minute is not None
                and inject.fires_at_minute > phase.end_offset - phase.start_offset
            ):
                issue(ready, "CHECK_AFTER_PHASE_END", INJECTS, "fires_at_minute", inject.id)
        # M23 -- an expected action fits in what's left of its phase from the
        # moment the inject is delivered (warning).
        start = _delivered_at(inject, phase_by_id)
        phase = phase_by_id.get(inject.phase_id)
        if (
            start is not None
            and phase is not None
            and any(
                a.expected_within_minutes is not None
                and start + a.expected_within_minutes > phase.end_offset
                for a in inject.actions
            )
        ):
            issue(warnings, "ACTION_PAST_PHASE_END", INJECTS, "expected_actions", inject.id)
        # M09 -- recipients and responsible roles are areas in scope.
        if any(r not in areas for r in inject.recipients):
            issue(ready, "RECIPIENT_NOT_IN_SCOPE", INJECTS, "recipients", inject.id)
        if any(a.responsible_role and a.responsible_role not in areas for a in inject.actions):
            issue(ready, "RESPONSIBLE_NOT_IN_SCOPE", INJECTS, "expected_actions", inject.id)
        # M18-M20 -- ATT&CK attribution (warnings): an attribution names
        # techniques; a threat actor's is one of the scenario's; and its
        # techniques are in that actor's profile (when it has one --
        # MITRE only records documented uses, so it's a warning).
        # A threat actor's activity names its techniques; noise may or may
        # not (another attack, a false positive...) -- optional there.
        if (
            inject.attack_attribution == AttackAttribution.THREAT_ACTOR
            and not inject.attack_techniques
        ):
            issue(
                warnings, "ATTRIBUTION_WITHOUT_TECHNIQUE", INJECTS, "attack_techniques", inject.id
            )
        if inject.attack_attribution == AttackAttribution.THREAT_ACTOR:
            actor = threat_actors.get(inject.threat_actor)
            if actor is None:
                issue(warnings, "ATTRIBUTION_WITHOUT_ACTOR", INJECTS, "threat_actor_key", inject.id)
            elif actor.techniques and any(
                (domain, technique) not in actor.techniques
                for domain, _, technique in inject.attack_techniques
            ):
                issue(
                    warnings, "TECHNIQUE_OFF_ACTOR_PROFILE", INJECTS, "attack_techniques", inject.id
                )
        # M12 -- every mandatory inject reviewed before the MSEL is ready.
        # The status is what counts: saving it validated always stamps who
        # validated it (_stamp_validation).
        if (
            inject.kind == InjectKind.MANDATORY
            and inject.review_status != InjectReviewStatus.VALIDATED
        ):
            issue(approved, "INJECT_NOT_VALIDATED", INJECTS, "review_status", inject.id)
        # M13 -- expected actions an evaluator can't observe (warning).
        if any(_VAGUE_ACTION.search(a.description) for a in inject.actions):
            issue(warnings, "VAGUE_EXPECTED_ACTION", INJECTS, "expected_actions", inject.id)
        # M28 -- a poll where only some options say what follows (warning):
        # the table may land on one that says nothing.
        written = [bool(o.strip()) for o in inject.poll_outcomes]
        if any(written) and not all(written):
            issue(warnings, "POLL_OUTCOME_MISSING", INJECTS, "poll_outcomes", inject.id)
        # M24 -- an action of an evaluated inject that no EEG lists (warning):
        # it evidences none of the inject's objectives.
        if inject.objective_ids and any(not a.objective_ids for a in inject.actions):
            issue(warnings, "ACTION_WITHOUT_OBJECTIVE", INJECTS, "expected_actions", inject.id)

    # M29 / M30 -- the impact meters: each named, and moved by some poll.
    names = [name.strip().casefold() for _, name in scenario.meters]
    moved = {key for inject in injects for row in inject.poll_impacts for key in row}
    for key, name in scenario.meters:
        if blank(name) or names.count(name.strip().casefold()) > 1:
            issue(ready, "METER_INCOMPLETE", SCENARIO, "meters")
        elif key not in moved:
            issue(warnings, "METER_UNUSED", SCENARIO, "meters")

    # M03 / M04 -- coverage of the needs analysis' objectives.
    mandatory = [i for i in injects if i.kind == InjectKind.MANDATORY]
    for objective in context.objectives:
        key = str(objective.id)
        # Only the inject format carries an objective, so they never cover one.
        if not any(key in i.objective_ids for i in mandatory):
            issue(ready, "OBJECTIVE_NOT_COVERED", COVERAGE, "objectives", key)
            continue
        actions = sum(
            1
            for i in injects
            if key in i.objective_ids
            for a in i.actions
            if key in a.objective_ids
        )
        if actions < MIN_ACTIONS_PER_OBJECTIVE:
            issue(warnings, "OBJECTIVE_FEW_ACTIONS", COVERAGE, "objectives", key)

    # M21 -- a threat actor of the scenario shows in some inject (warning).
    attributed = {i.threat_actor for i in injects if i.threat_actor}
    for actor in scenario.threat_actors:
        if actor.id not in attributed:
            issue(
                warnings, "THREAT_ACTOR_WITHOUT_INJECTS", THREAT_ACTORS, "threat_actors", actor.id
            )

    # M07 -- every phase has a mandatory inject (warning). Contingent ones
    # are the facilitator's plan B, recommended in the Injects tab's help
    # but never asked for: a short phase may need none (user's call).
    for phase in phases:
        kinds = {i.kind for i in injects if i.phase_id == phase.id}
        if InjectKind.MANDATORY not in kinds:
            issue(warnings, "PHASE_WITHOUT_MANDATORY", PHASES, "injects", phase.id)

    # M10 -- bursts on the timeline, overload per recipient (warnings).
    timed = sorted(
        (i for i in mandatory if i.offset_minutes is not None), key=lambda i: i.offset_minutes
    )
    reported_until = -1
    for index, inject in enumerate(timed):
        window = [
            other
            for other in timed[index:]
            if other.offset_minutes < inject.offset_minutes + BURST_WINDOW_MINUTES
        ]
        if len(window) > BURST_MAX and inject.offset_minutes > reported_until:
            issue(warnings, "INJECT_BURST", INJECTS, "offset_minutes", inject.id)
            reported_until = window[-1].offset_minutes
    by_recipient: dict[str, list[int]] = defaultdict(list)
    for inject in timed:
        for recipient in inject.recipients:
            by_recipient[recipient].append(inject.offset_minutes)
    for recipient, offsets in by_recipient.items():
        if any(
            sum(1 for o in offsets[i:] if o < start + OVERLOAD_WINDOW_MINUTES) > OVERLOAD_MAX
            for i, start in enumerate(offsets)
        ):
            issue(warnings, "RECIPIENT_OVERLOAD", REVIEW, "recipients", recipient)

    # M14-M17 -- the storyline map: where each contingent inject branches
    # off and comes back. A contingent inject branches off an inject of its
    # own phase (mandatory or contingent -- several may hang from one) and,
    # if it comes back, comes back later on the storyline: blocking. Saying
    # where it comes back is only a warning.
    by_id = {i.id: i for i in injects}

    def fork_time(inject) -> int | None:
        """When the storyline reaches the point a branch hangs from: its
        mandatory ancestor's time (contingent parents are followed up)."""
        seen = {inject.id}
        parent = by_id.get(inject.branch_from)
        while parent is not None and parent.kind == InjectKind.CONTINGENT:
            if parent.id in seen:
                return None
            seen.add(parent.id)
            parent = by_id.get(parent.branch_from)
        return parent.offset_minutes if parent is not None else None

    def in_cycle(inject) -> bool:
        seen = {inject.id}
        parent = by_id.get(inject.branch_from)
        while parent is not None and parent.kind == InjectKind.CONTINGENT:
            if parent.id in seen:
                return True
            seen.add(parent.id)
            parent = by_id.get(parent.branch_from)
        return False

    for inject in injects:
        if inject.kind != InjectKind.CONTINGENT:
            continue
        # M14 -- a contingent inject hangs from a point of the storyline.
        if inject.branch_from is None:
            issue(ready, "BRANCH_NOT_ANCHORED", INJECTS, "branch_from_key", inject.id)
            continue
        # M15 -- branches don't hang from each other in a loop.
        if in_cycle(inject):
            issue(ready, "BRANCH_CYCLE", INJECTS, "branch_from_key", inject.id)
            continue
        # ...from an inject of the same phase.
        parent = by_id.get(inject.branch_from)
        if parent is not None and parent.phase_id != inject.phase_id:
            issue(ready, "BRANCH_FROM_OTHER_PHASE", INJECTS, "branch_from_key", inject.id)
        # M16 -- a branch says where the storyline resumes.
        if inject.rejoin is None:
            issue(warnings, "BRANCH_WITHOUT_REJOIN", INJECTS, "rejoin_key", inject.id)
            continue
        # M17 -- ...at a mandatory inject later than the point it left.
        target = by_id.get(inject.rejoin)
        start = fork_time(inject)
        if (
            target is None
            or target.kind != InjectKind.MANDATORY
            or (
                start is not None
                and target.offset_minutes is not None
                and target.offset_minutes <= start
            )
        ):
            issue(ready, "BRANCH_REJOIN_INVALID", INJECTS, "rejoin_key", inject.id)

    # M25 -- played in rooms, the exercise has some (blocking); M26 -- each
    # room gets an inject, one for all rooms counting (warning).
    if getattr(scenario, "uses_rooms", False):
        if not scenario.rooms:
            issue(ready, "ROOMS_MISSING", INJECTS, "rooms")
        elif not any(not i.room_ids for i in injects):
            targeted = {r for i in injects for r in i.room_ids}
            for room in scenario.rooms:
                if room.id not in targeted:
                    issue(warnings, "ROOM_WITHOUT_INJECTS", INJECTS, "rooms", room.id)

    return ValidationReport(ready=ready, approved=approved, warnings=warnings)


def draft_report(
    session: Session, ttx: TTX, payload: MselSaveRequest, scope: dict | None = None
) -> ValidationReport:
    """The report this MSEL *would* have with this payload, saving nothing.
    What would make the save itself fail (links to objectives that aren't
    in the needs analysis) is reported as an issue instead of a 422.
    `scope` stands in for the needs analysis' participating areas, third
    parties and duration limit (the AI assistant measures a proposed scope)."""
    msel = find_msel(session, ttx.id)
    if msel is None:
        raise AppException("MSEL_NOT_FOUND", "Open the MSEL first.", 404)
    _check_attack_refs(
        msel.attack_version, [r for i in payload.injects for r in i.attack_techniques]
    )
    for item in payload.threat_actors:
        _check_threat_actor(msel.attack_version, item)
    context = _needs_context(session, get_form(session, ttx.id))
    if scope:
        fields = ("participating_areas", "third_parties", "max_duration_hours")
        context = context.model_copy(update={f: scope[f] for f in fields if f in scope})
    threat_ids = {
        ref: (str(t.id) if t.id else t.key) for t in payload.threat_actors for ref in refs(t)
    }
    known = {str(o.id) for o in context.objectives}
    phase_ids = {p.key: (str(p.id) if p.id else p.key) for p in payload.phases}
    phases = [
        SimpleNamespace(
            id=phase_ids[p.key],
            name=p.name,
            start_offset=p.start_offset,
            end_offset=p.end_offset,
            objective_ids=[str(o) for o in p.objective_ids],
        )
        for p in payload.phases
    ]
    blockers: list[ValidationIssue] = []
    for phase in phases:
        if any(o not in known for o in phase.objective_ids):
            blockers.append(
                ValidationIssue(
                    code="UNKNOWN_OBJECTIVE",
                    section=PHASES,
                    field="objective_ids",
                    item_id=phase.id,
                )
            )
    # A payload's rows name each other by key or id; the report names them
    # by id when saved, by key otherwise.
    view_ids = {
        ref: (str(item.id) if item.id else (item.key or f"inject-{index}"))
        for index, item in enumerate(payload.injects)
        for ref in refs(item)
    }
    action_ids = {
        ref: (str(action.id) if action.id else ref)
        for item in payload.injects
        for action in item.expected_actions
        for ref in refs(action)
    }
    injects = []
    for index, item in enumerate(payload.injects):
        key = str(item.id) if item.id else (item.key or f"inject-{index}")
        contingent = item.kind == InjectKind.CONTINGENT
        view = SimpleNamespace(
            id=key,
            phase_id=phase_ids.get(item.phase_key),
            kind=item.kind,
            title=item.title,
            content=item.content,
            offset_minutes=item.offset_minutes,
            trigger_condition=item.trigger_condition,
            contingent_purpose=item.contingent_purpose,
            fires_at_minute=item.fires_at_minute,
            format=item.format,
            poll_question=item.poll_question,
            poll_options=item.poll_options,
            poll_outcomes=item.poll_outcomes,
            poll_impacts=item.poll_impacts,
            branch_from=view_ids.get(item.branch_from_key or "") if contingent else None,
            branch_action=action_ids.get(item.branch_action_key or "") if contingent else None,
            rejoin=view_ids.get(item.rejoin_key or "") if contingent else None,
            has_actor=item.actor_key is not None,
            recipients=list(item.recipients),
            room_ids=[str(r) for r in item.room_ids],
            attack_attribution=item.attack_attribution,
            threat_actor=threat_ids.get(item.threat_actor_key or ""),
            attack_techniques=[ref.key() for ref in item.attack_techniques],
            review_status=item.review_status,
            validated_by=item.validated_by,
            objective_ids=[str(o) for o in item.objective_ids],
            actions=[
                SimpleNamespace(
                    id=action_ids.get(a.key or "", str(a.id) if a.id else None),
                    description=a.description,
                    responsible_role=a.responsible_role,
                    expected_within_minutes=a.expected_within_minutes,
                    objective_ids=[str(o) for o in a.objective_ids or []],
                )
                for a in item.expected_actions
            ],
        )
        if any(o not in known for o in view.objective_ids):
            blockers.append(
                ValidationIssue(
                    code="UNKNOWN_OBJECTIVE", section=INJECTS, field="objective_ids", item_id=key
                )
            )
        injects.append(view)
    scenario = _scenario_view(
        payload,
        [_threat_actor_view(t, str(t.id) if t.id else t.key) for t in payload.threat_actors],
    )
    scenario.needs_form_version = msel.needs_form_version
    _rooms_view(scenario, ttx, list_rooms(session, ttx.id))
    report = validation_report(scenario, context, phases, injects)
    report.ready = blockers + report.ready
    return report


# -- writes ---------------------------------------------------------------


def _reopen(msel: TTXMsel) -> None:
    """Any edit of an MSEL past DRAFT sends it back to DRAFT; leaving READY
    opens a new version (its snapshot stays as history)."""
    if msel.status == MselStatus.READY:
        msel.version += 1
    msel.status = MselStatus.DRAFT
    msel.ready_by = ""
    msel.ready_by_id = None
    msel.ready_at = None


def _touch(msel: TTXMsel, user: User) -> None:
    msel.revision += 1
    msel.updated_at = datetime.now(UTC)
    msel.updated_by_id = user.id


def editable_msel(session: Session, ttx: TTX) -> TTXMsel:
    """The MSEL, if it can be edited now (its needs analysis is approved)."""
    msel, _ = _editable(session, ttx, lock=False)
    return msel


def _editable(session: Session, ttx: TTX, *, lock: bool = True) -> tuple[TTXMsel, TTXNeedsForm]:
    msel = find_msel(session, ttx.id, lock=lock)
    if msel is None:
        raise AppException("MSEL_NOT_FOUND", "Open the MSEL first.", 404)
    form = get_form(session, ttx.id)
    if form.status != NeedsFormStatus.APPROVED:
        raise _not_approved(ttx)
    return msel, form


SCALAR_FIELDS = (
    "title",
    "summary",
    "exercise_start",
    "incident_start",
    "incident_date",
    "duration_minutes",
    "time_compression",
)


def _stamp_validation(inject: Inject, item, user: User) -> None:
    """Who validated an inject is never taken from the client. Marking it
    validated stamps the saving user; a validation already stored is kept
    while the client still names the same validator, and taken over by the
    saving user otherwise (an override -- the client sends its own id).
    Back to draft clears it."""
    if item.review_status != InjectReviewStatus.VALIDATED:
        inject.review_status = item.review_status
        inject.validated_by = ""
        inject.validated_by_id = None
        return
    kept = (
        inject.review_status == InjectReviewStatus.VALIDATED
        and inject.validated_by.strip() != ""
        and item.validated_by_id == inject.validated_by_id
    )
    inject.review_status = InjectReviewStatus.VALIDATED
    if not kept:
        inject.validated_by = user.full_name
        inject.validated_by_id = user.id


# An inject is INJ-NN, a discussion one DSC-NN, a poll POL-NN: one number
# series for all, so switching the format keeps the number and only moves
# the prefix.
FORMAT_PREFIXES = {
    InjectFormat.INJECT: "INJ",
    InjectFormat.DISCUSSION: "DSC",
    InjectFormat.POLL: "POL",
}
INJECT_PREFIXES = tuple(FORMAT_PREFIXES.values())


def _inject_prefix(inject: Inject) -> str:
    return FORMAT_PREFIXES[inject.format]


def _inject_code(format: InjectFormat, number: int) -> str:
    return f"{FORMAT_PREFIXES[format]}-{number:02d}"


def _recoded(code: str, format: InjectFormat) -> str:
    """The code an inject takes in this format (a code of another shape, if
    any is left, stays)."""
    number = code_number(code, INJECT_PREFIXES)
    return code if number is None else _inject_code(format, number)


def save_msel(session: Session, ttx: TTX, payload: MselSaveRequest, user: User) -> TTXMsel:
    msel, form = _editable(session, ttx)
    if payload.revision != msel.revision:
        raise _reject(
            "MSEL_STALE",
            "Someone else saved this MSEL since you opened it. Reload to see their changes.",
            409,
        )

    _check_attack_refs(
        msel.attack_version, [r for i in payload.injects for r in i.attack_techniques]
    )
    for item in payload.threat_actors:
        _check_threat_actor(msel.attack_version, item)
    known_objectives = set(
        session.exec(select(TTXObjective.id).where(TTXObjective.form_id == form.id))
    )
    for item in (*payload.phases, *payload.injects):
        if any(o not in known_objectives for o in item.objective_ids):
            raise _reject(
                "UNKNOWN_OBJECTIVE", "A row links an objective that isn't in the needs analysis."
            )
    known_images = set(images_by_id(session, msel.id))
    if any(i.image_id not in known_images for item in payload.injects for i in item.images):
        raise _reject("UNKNOWN_IMAGE", "An inject shows an image that isn't in this MSEL.")
    known_files = set(files_by_id(session, msel.id))
    if any(f.file_id not in known_files for item in payload.injects for f in item.files):
        raise _reject("UNKNOWN_FILE", "An inject hands out a file that isn't in this MSEL.")
    known_rooms = {r.id for r in list_rooms(session, ttx.id)}
    if any(r not in known_rooms for item in payload.injects for r in item.room_ids):
        raise _reject("UNKNOWN_ROOM", "An inject is aimed at a room that isn't on this exercise.")

    actors, phases, injects, _, _, actions = _children(session, msel)
    existing_threats = {t.id: t for t in _threat_actors(session, msel)}
    existing_actors = {a.id: a for a in actors}
    existing_phases = {p.id: p for p in phases}
    existing_injects = {i.id: i for i in injects}
    existing_actions = {a.id: a for rows in actions.values() for a in rows}
    for item_id, known in (
        *((a.id, existing_actors) for a in payload.actors if a.id),
        *((t.id, existing_threats) for t in payload.threat_actors if t.id),
        *((p.id, existing_phases) for p in payload.phases if p.id),
        *((i.id, existing_injects) for i in payload.injects if i.id),
    ):
        if item_id not in known:
            raise _reject("MSEL_ROW_NOT_FOUND", "A row in this save doesn't belong to the MSEL.")
    for item in payload.injects:
        for action in item.expected_actions:
            if action.id and (
                action.id not in existing_actions
                or existing_actions[action.id].inject_id != item.id
            ):
                raise _reject(
                    "MSEL_ROW_NOT_FOUND", "An expected action doesn't belong to its inject."
                )

    _reopen(msel)
    for field in SCALAR_FIELDS:
        setattr(msel, field, getattr(payload, field))
    msel.meters = [meter.model_dump() for meter in payload.meters]

    # Branch references between injects go first: they are all rewritten
    # below, once every inject and action of the payload exists.
    for inject in existing_injects.values():
        inject.branch_from_id = inject.branch_action_id = inject.rejoin_inject_id = None
        session.add(inject)
    session.flush()

    # Links go first: they are all rewritten below, and rows about to be
    # deleted can't still be referenced.
    links: list = []
    if existing_phases:
        session.execute(
            delete(MselPhaseObjective).where(MselPhaseObjective.phase_id.in_(list(existing_phases)))
        )
    if existing_injects:
        session.execute(
            delete(InjectObjective).where(InjectObjective.inject_id.in_(list(existing_injects)))
        )
        session.execute(
            delete(InjectImage).where(InjectImage.inject_id.in_(list(existing_injects)))
        )
        session.execute(delete(InjectFile).where(InjectFile.inject_id.in_(list(existing_injects))))
        session.execute(
            delete(InjectAttackTechnique).where(
                InjectAttackTechnique.inject_id.in_(list(existing_injects))
            )
        )

    threat_ids: dict[str, uuid.UUID] = {}
    for position, item in enumerate(payload.threat_actors):
        threat = existing_threats[item.id] if item.id else _new_threat_actor(msel)
        threat.position = position
        before = _threat_actor_content(threat) if item.id else None
        _write_threat_actor(threat, item)
        # A whole-MSEL save rewrites every row: only a real change counts.
        if before is not None and before != _threat_actor_content(threat):
            threat.modified_at = datetime.now(UTC)
        session.add(threat)
        threat_ids.update(dict.fromkeys(refs(item), threat.id))

    actor_ids: dict[str, uuid.UUID] = {}
    for position, item in enumerate(payload.actors):
        if item.id:
            actor = existing_actors[item.id]
        else:
            actor = _new_cast_row(ttx)
        actor.position = position
        _write_actor(actor, item)
        session.add(actor)
        actor_ids[item.key] = actor.id

    phase_ids: dict[str, uuid.UUID] = {}
    for position, item in enumerate(payload.phases):
        if item.id:
            phase = existing_phases[item.id]
        else:
            phase = MselPhase(msel_id=msel.id, code=f"PH-{msel.next_phase_number:02d}")
            msel.next_phase_number += 1
        phase.position = position
        phase.name = item.name
        phase.headline = item.headline
        phase.start_offset = item.start_offset
        phase.end_offset = item.end_offset
        phase.incident_jump_minutes = item.incident_jump_minutes
        phase.situation_update = item.situation_update
        phase.key_questions = item.key_questions
        session.add(phase)
        phase_ids[item.key] = phase.id
        links.extend(
            MselPhaseObjective(phase_id=phase.id, objective_id=o, due=o in item.due_objective_ids)
            for o in item.objective_ids
        )
    session.flush()  # injects point at these actors, threat actors and phases

    kept_actions: set[uuid.UUID] = set()
    pending_actions: list[InjectExpectedAction] = []
    written: list[tuple] = []  # (payload item, inject row)
    recoded: dict[str, str] = {}  # an inject whose scoring changed: old -> new code
    action_rows: dict[str, uuid.UUID] = {}  # an action's key or id -> its row
    for position, item in enumerate(payload.injects):
        if item.id:
            inject = existing_injects[item.id]
        else:
            inject = Inject(
                ttx_id=ttx.id, msel_id=msel.id, created_by_id=user.id, title="", content=""
            )
        if not item.id:
            # One series for every inject, never reused; the kind can change
            # without touching it.
            inject.code = _inject_code(item.format, msel.next_inject_number)
            msel.next_inject_number += 1
        elif (code := _recoded(inject.code, item.format)) != inject.code:
            # Format switched: same number, the other prefix.
            recoded[inject.code] = code
            inject.code = code
        inject.position = position
        inject.phase_id = phase_ids[item.phase_key]
        inject.kind = item.kind
        inject.title = item.title
        inject.content = item.content
        inject.offset_minutes = item.offset_minutes
        inject.trigger_condition = item.trigger_condition
        inject.contingent_purpose = item.contingent_purpose
        inject.fires_at_minute = item.fires_at_minute
        inject.format = item.format
        inject.poll_question = item.poll_question
        inject.poll_options = item.poll_options
        inject.poll_outcomes = item.poll_outcomes
        inject.poll_impacts = item.poll_impacts
        inject.simulated_actor_id = actor_ids[item.actor_key] if item.actor_key else None
        inject.attack_attribution = item.attack_attribution
        inject.threat_actor_id = threat_ids.get(item.threat_actor_key or "")
        inject.recipients = item.recipients
        inject.room_ids = item.room_ids
        inject.delivery_method = item.delivery_method
        inject.attachment_notes = item.attachment_notes
        inject.facilitator_notes = item.facilitator_notes
        inject.artifact = item.artifact.model_dump() if item.artifact else None
        _stamp_validation(inject, item, user)
        session.add(inject)
        links.extend(
            InjectObjective(inject_id=inject.id, objective_id=o) for o in item.objective_ids
        )
        links.extend(
            InjectAttackTechnique(inject_id=inject.id, position=p, **ref.model_dump())
            for p, ref in enumerate(item.attack_techniques)
        )
        links.extend(
            InjectImage(
                inject_id=inject.id, image_id=image.image_id, position=p, caption=image.caption
            )
            for p, image in enumerate(item.images)
        )
        links.extend(
            InjectFile(
                inject_id=inject.id, file_id=file.file_id, position=p, description=file.description
            )
            for p, file in enumerate(item.files)
        )
        # An action's code labels its place in the inject; its id is the
        # stable reference (the conduct log will point at it).
        for action_position, action_item in enumerate(item.expected_actions):
            if action_item.id:
                action = existing_actions[action_item.id]
                kept_actions.add(action.id)
            else:
                action = InjectExpectedAction(inject_id=inject.id, code="")
            action.position = action_position
            action.code = f"{inject.code}-A{action_position + 1}"
            action.description = action_item.description
            action.responsible_role = action_item.responsible_role
            action.expected_within_minutes = action_item.expected_within_minutes
            action.objective_ids = list(action_item.objective_ids or [])
            pending_actions.append(action)
            action_rows.update(dict.fromkeys(refs(action_item), action.id))
        written.append((item, inject))

    session.flush()  # actions point at these injects
    session.add_all(pending_actions)
    session.flush()
    # The storyline map's branches -- contingent injects only.
    inject_rows = {ref: inject.id for item, inject in written for ref in refs(item)}
    for item, inject in written:
        if item.kind != InjectKind.CONTINGENT:
            continue
        inject.branch_from_id = inject_rows.get(item.branch_from_key or "")
        inject.branch_action_id = (
            action_rows.get(item.branch_action_key or "") if inject.branch_from_id else None
        )
        inject.rejoin_inject_id = inject_rows.get(item.rejoin_key or "")
        session.add(inject)
    session.flush()
    kept_injects = {i.id for i in payload.injects if i.id}
    for gone in set(existing_actions) - kept_actions:
        session.delete(existing_actions[gone])
    session.flush()
    for gone in set(existing_injects) - kept_injects:
        session.delete(existing_injects[gone])
    session.flush()
    for gone in set(existing_phases) - {p.id for p in payload.phases if p.id}:
        session.delete(existing_phases[gone])
    for gone in set(existing_actors) - {a.id for a in payload.actors if a.id}:
        session.delete(existing_actors[gone])
    for gone in set(existing_threats) - {t.id for t in payload.threat_actors if t.id}:
        session.delete(existing_threats[gone])
    session.flush()
    session.add_all(links)
    session.flush()
    drop_unused_images(session, msel.id)
    drop_unused_files(session, msel.id)
    if recoded:
        _rewrite_codes(session, msel, code_rewriter(recoded))

    _touch(msel, user)
    session.add(msel)
    session.commit()
    session.refresh(msel)
    logger.info("MSEL of TTX %s saved by user %s (revision %s).", ttx.id, user.id, msel.revision)
    return msel


def transition(session: Session, ttx: TTX, to: MselStatus, user: User) -> TTXMsel:
    msel, _ = _editable(session, ttx)
    current = msel.status
    if to == MselStatus.DRAFT:
        if current == MselStatus.DRAFT:
            return msel
        _reopen(msel)
    else:
        allowed_from = {
            MselStatus.IN_REVIEW: MselStatus.DRAFT,
            MselStatus.READY: MselStatus.IN_REVIEW,
        }[to]
        if current != allowed_from:
            raise _reject(
                "INVALID_TRANSITION",
                "A {current} MSEL can't move to {to}.",
                409,
                params={"current": current.value, "to": to.value},
            )
        report = msel_read(session, ttx, msel).validation
        blocking = report.ready + (report.approved if to == MselStatus.READY else [])
        if blocking:
            logger.warning(
                "MSEL of TTX %s can't move to %s: %s.",
                ttx.id,
                to.value,
                ", ".join(sorted({issue.code for issue in blocking})),
            )
            raise AppException(
                "MSEL_INVALID",
                "The MSEL doesn't meet the rules for this step yet. Check the validation summary.",
                409,
                log_level=logging.INFO,
            )
        msel.status = to
        if to == MselStatus.READY:
            msel.ready_by = user.full_name
            msel.ready_by_id = user.id
            msel.ready_at = datetime.now(UTC)

    _touch(msel, user)
    session.add(msel)
    if msel.status == MselStatus.READY:
        session.flush()
        snapshot = msel_read(session, ttx, msel).model_dump(
            mode="json", exclude={"validation", "frozen_versions"}
        )
        session.add(
            MselSnapshot(
                msel_id=msel.id, version=msel.version, payload=snapshot, created_by_id=user.id
            )
        )
    session.commit()
    session.refresh(msel)
    logger.info(
        "MSEL of TTX %s moved from %s to %s by user %s (version %s).",
        ttx.id,
        current.value,
        msel.status.value,
        user.id,
        msel.version,
    )
    return msel


def acknowledge_needs_version(session: Session, ttx: TTX, user: User) -> TTXMsel:
    """The planners reviewed the MSEL against the needs analysis' new
    version (M02). Like an edit, it sends a reviewed MSEL back to DRAFT:
    the objectives it was checked against changed."""
    msel, form = _editable(session, ttx)
    if msel.needs_form_version == form.version:
        return msel
    _reopen(msel)
    msel.needs_form_version = form.version
    _touch(msel, user)
    session.add(msel)
    session.commit()
    session.refresh(msel)
    logger.info(
        "MSEL of TTX %s acknowledged needs-analysis version %s (user %s).",
        ttx.id,
        form.version,
        user.id,
    )
    return msel


def upgrade_attack(
    session: Session, ttx: TTX, user: User, to_version: str = LATEST_ATTACK_VERSION
) -> tuple[TTXMsel, list[AttackReplacement], list[str]]:
    """Move the MSEL to a newer ATT&CK release: revoked techniques (and
    groups) become MITRE's replacement, deprecated or vanished ones are
    removed -- a threat actor whose group is gone stays, as an unknown actor
    with its name (all reported). Like an edit, a reviewed MSEL goes back to
    DRAFT; a READY one opens a new version, its snapshot keeping the old
    release."""
    msel, _ = _editable(session, ttx)
    if to_version not in ATTACK_VERSIONS:
        raise _reject(
            "UNKNOWN_ATTACK_VERSION",
            "No ATT&CK v{version} in this build.",
            params={"version": to_version},
        )
    if ATTACK_VERSIONS.index(to_version) <= ATTACK_VERSIONS.index(msel.attack_version):
        raise _reject(
            "ATTACK_VERSION_NOT_NEWER",
            "The MSEL already uses ATT&CK v{version}.",
            409,
            params={"version": msel.attack_version},
        )
    inject_ids = list(session.exec(select(Inject.id).where(Inject.msel_id == msel.id)))
    inject_rows = _technique_rows(session, inject_ids)

    report = ConversionReport()
    new_injects = {
        inject_id: convert_refs(
            [(r.domain, r.tactic_id, r.technique_id) for r in rows], to_version, report
        )
        for inject_id, rows in inject_rows.items()
    }
    for actor in _threat_actors(session, msel):
        before = _threat_actor_content(actor)
        actor.mitre_group_id, kept = convert_profile(
            actor.mitre_group_id,
            [(t["domain"], t["technique_id"]) for t in actor.techniques],
            to_version,
            report,
        )
        actor.techniques = [{"domain": d, "technique_id": t} for d, t in kept]
        if before != _threat_actor_content(actor):
            actor.modified_at = datetime.now(UTC)
        session.add(actor)
    if inject_ids:
        session.execute(
            delete(InjectAttackTechnique).where(InjectAttackTechnique.inject_id.in_(inject_ids))
        )
    session.add_all(
        InjectAttackTechnique(
            inject_id=inject_id, position=p, domain=d, tactic_id=ta, technique_id=te
        )
        for inject_id, triples in new_injects.items()
        for p, (d, ta, te) in enumerate(triples)
    )
    previous = msel.attack_version
    msel.attack_version = to_version
    _reopen(msel)
    _touch(msel, user)
    session.add(msel)
    session.commit()
    session.refresh(msel)
    logger.info(
        "MSEL of TTX %s upgraded from ATT&CK v%s to v%s by user %s.",
        ttx.id,
        previous,
        to_version,
        user.id,
    )
    conversion = report.read()
    return msel, conversion.replaced, conversion.removed


# -- renumbering codes -----------------------------------------------------

RENUMBER_PREFIXES = {"phases": "PH", "injects": _inject_prefix, "threat_actors": "THR"}
# What a kind's codes may start with, to read their numbers.
_CODE_PREFIXES = {"phases": "PH", "injects": INJECT_PREFIXES, "threat_actors": "THR"}
_COUNTERS = {
    "phases": "next_phase_number",
    "injects": "next_inject_number",
    "threat_actors": "next_threat_actor_number",
}
# Where the MSEL's free text can name a code.
_TEXT_FIELDS = (
    (TTXMsel, ("title", "summary")),
    (MselPhase, ("name", "headline", "situation_update", "key_questions")),
    (
        Inject,
        (
            "title",
            "content",
            "trigger_condition",
            "contingent_purpose",
            "attachment_notes",
            "facilitator_notes",
        ),
    ),
    (InjectExpectedAction, ("description",)),
    (MselSimulatedActor, ("description",)),
    (MselThreatActor, ("description",)),
)


def _text_rows(msel, actors, phases, injects, actions, threats) -> dict[type, list]:
    return {
        TTXMsel: [msel],
        MselPhase: phases,
        Inject: injects,
        InjectExpectedAction: actions,
        MselSimulatedActor: actors,
        MselThreatActor: threats,
    }


def _rewrite_codes(session: Session, msel: TTXMsel, rewrite) -> None:
    """Rewrites the codes named in the MSEL's free text ("see INJ-04")."""
    actors, phases, injects, _, _, actions = _children(session, msel)
    every_action = [a for group in actions.values() for a in group]
    rows = _text_rows(msel, actors, phases, injects, every_action, _threat_actors(session, msel))
    for model, fields in _TEXT_FIELDS:
        rewrite_fields(rows[model], fields, rewrite)
    for group in rows.values():
        session.add_all(group)


def _can_renumber(msel: TTXMsel) -> bool:
    """Only a draft: IN_REVIEW and READY are being checked or played."""
    return msel.status == MselStatus.DRAFT


def frozen_versions(session: Session, msel: TTXMsel) -> list[FrozenVersionRead]:
    """The versions frozen when the MSEL became READY, oldest first, with
    the sessions played from each. They keep the codes they were frozen
    with: renumbering the draft breaks the match with them."""
    snapshots = list(
        session.exec(
            select(MselSnapshot)
            .where(MselSnapshot.msel_id == msel.id)
            .order_by(MselSnapshot.version, MselSnapshot.created_at)
        )
    )
    if not snapshots:
        return []
    played: dict[uuid.UUID, int] = defaultdict(int)
    for snapshot_id in session.exec(
        select(ExerciseRun.msel_snapshot_id).where(
            ExerciseRun.msel_snapshot_id.in_([s.id for s in snapshots])
        )
    ):
        played[snapshot_id] += 1
    return [
        FrozenVersionRead(
            version=snapshot.version,
            ready_at=snapshot.payload.get("ready_at") or snapshot.created_at,
            ready_by=snapshot.payload.get("ready_by") or "",
            sessions=played[snapshot.id],
        )
        for snapshot in snapshots
    ]


def _in_order(kind: str, phases: list[MselPhase], injects: list[Inject], threats: list) -> list:
    """The order codes follow: phases by start in the session, injects as
    the storyline reads them, threat actors as listed."""
    if kind == "phases":
        return sorted(phases, key=lambda p: (p.start_offset, p.position))
    if kind == "injects":
        return _storyline_order(injects)
    return threats


def _storyline_order(injects: list[Inject]) -> list[Inject]:
    """Injects as the storyline reads them: mandatory ones by T+, each
    followed by the contingent injects that branch off it (theirs after
    them, depth first); then the untimed mandatory ones and whatever hangs
    from nothing on the map. Siblings keep the order they were created in
    (their current numbers: the counter never goes back)."""

    def created(inject: Inject) -> tuple:
        number = code_number(inject.code, INJECT_PREFIXES)
        return (number is None, number or 0, inject.position)

    children: dict[uuid.UUID, list[Inject]] = {}
    for inject in injects:
        if inject.kind == InjectKind.CONTINGENT and inject.branch_from_id:
            children.setdefault(inject.branch_from_id, []).append(inject)
    for group in children.values():
        group.sort(key=created)

    ordered: list[Inject] = []
    seen: set[uuid.UUID] = set()

    def walk(inject: Inject) -> None:
        # Iterative, and a loop of branches visits each inject once.
        stack = [inject]
        while stack:
            current = stack.pop()
            if current.id in seen:
                continue
            seen.add(current.id)
            ordered.append(current)
            stack.extend(reversed(children.get(current.id, [])))

    mandatory = [i for i in injects if i.kind != InjectKind.CONTINGENT]
    timed = sorted(
        (i for i in mandatory if i.offset_minutes is not None),
        key=lambda i: (i.offset_minutes, *created(i)),
    )
    untimed = sorted((i for i in mandatory if i.offset_minutes is None), key=created)
    for inject in [*timed, *untimed, *sorted(injects, key=created)]:
        walk(inject)
    return ordered


def renumberable(session: Session, msel: TTXMsel) -> list[str]:
    """The kinds whose codes don't follow their order yet -- and can."""
    if not _can_renumber(msel):
        return []
    _, phases, injects, *_ = _children(session, msel)
    threats = _threat_actors(session, msel)
    return [
        kind
        for kind, prefix in RENUMBER_PREFIXES.items()
        if out_of_order(_in_order(kind, phases, injects, threats), prefix)
    ]


def renumber(
    session: Session,
    ttx: TTX,
    kind: str,
    codes: dict[uuid.UUID, str] | None,
    user: User,
    confirm_frozen: bool = False,
) -> tuple[TTXMsel, dict[uuid.UUID, str]]:
    """Renumber one kind of row in order (or put `codes` back, to undo) and
    rewrite the codes in the MSEL's free text. Returns the previous codes.
    A draft that was READY before needs `confirm_frozen`: its frozen
    versions (and the sessions, EEGs and PDFs made from them) keep the old
    codes, which stop matching the draft's."""
    msel, _ = _editable(session, ttx)
    if not _can_renumber(msel):
        raise _reject(
            "MSEL_RENUMBER_NOT_ALLOWED",
            "Codes can only be renumbered while the MSEL is a draft.",
            409,
        )
    frozen = frozen_versions(session, msel)
    if frozen and not confirm_frozen:
        raise _reject(
            "MSEL_RENUMBER_CONFIRM",
            "The MSEL has frozen versions that keep the current codes: confirm to renumber.",
            409,
            params={"versions": len(frozen)},
        )
    actors, phases, injects, _, _, actions = _children(session, msel)
    threats = _threat_actors(session, msel)
    prefix = RENUMBER_PREFIXES[kind]
    rows = _in_order(kind, phases, injects, threats)
    previous = {row.id: row.code for row in rows}
    planned = planned_codes(rows, prefix, codes, "MSEL_RENUMBER_INVALID")
    mapping = {
        previous[row_id]: code for row_id, code in planned.items() if previous[row_id] != code
    }

    rewrite = code_rewriter(mapping)
    every_action = [a for group in actions.values() for a in group]
    by_model = _text_rows(msel, actors, phases, injects, every_action, threats)
    for model, fields in _TEXT_FIELDS:
        rewrite_fields(by_model[model], fields, rewrite)
    for row in rows:
        row.code = planned[row.id]
    if kind == "injects":
        for action in every_action:
            action.code = rewrite(action.code)
    counter = _COUNTERS[kind]
    setattr(
        msel,
        counter,
        next_number(planned.values(), _CODE_PREFIXES[kind], codes is None, getattr(msel, counter)),
    )
    for group in by_model.values():
        session.add_all(group)
    _touch(msel, user)
    session.commit()
    session.refresh(msel)
    logger.info(
        "MSEL %s: %s renumbered by user %s (%d frozen versions keep the old codes)",
        msel.id,
        kind,
        user.id,
        len(frozen),
    )
    return msel, previous


# -- the exercise's cast ---------------------------------------------------
#
# Simulated actors belong to the exercise, not to its MSEL: Library ->
# Simulated actors manages them at any time (before the needs analysis is
# approved, while the MSEL is read-only, with no MSEL at all); the MSEL's
# injects pick their sender from them. When the MSEL exists, a change to
# its cast is an edit of it (revision bump -- so a page open on the MSEL
# gets MSEL_STALE instead of overwriting it -- and back to DRAFT past it).


def _new_cast_row(ttx: TTX) -> MselSimulatedActor:
    actor = MselSimulatedActor(ttx_id=ttx.id, code=f"ACT-{ttx.next_actor_number:02d}")
    ttx.next_actor_number += 1
    return actor


def ensure_cast(
    session: Session, ttx: TTX, locale: str, frameworks: list[str] | tuple[str, ...] = ()
) -> bool:
    """Seed the cast once with TTX-Zone's default actors (never again, even
    if they're later removed), and add the actors of `frameworks` that
    aren't in it yet. No commit; True when something was added."""
    ttx = session.exec(select(TTX).where(TTX.id == ttx.id).with_for_update()).one()
    existing = list(
        session.exec(select(MselSimulatedActor).where(MselSimulatedActor.ttx_id == ttx.id))
    )
    copied = {a.origin_id for a in existing if a.origin == ActorOrigin.SYSTEM}
    never_seeded = ttx.next_actor_number == 1
    wanted = [
        seed
        for seed in ACTOR_CATALOG
        if (seed.default and never_seeded) or set(seed.frameworks) & set(frameworks)
    ]
    position = len(existing)
    added = False
    for seed in wanted:
        if seed.id in copied:
            continue
        actor = _new_cast_row(ttx)
        actor.position = position
        actor.name = seed.name(locale)
        actor.type = seed.type
        actor.description = seed.description(locale)
        actor.channel = seed.channel.value
        actor.origin = ActorOrigin.SYSTEM
        actor.origin_id = seed.id
        actor.origin_name = seed.name(locale)
        session.add(actor)
        position += 1
        added = True
    if added:
        session.add(ttx)
    return added


def list_cast(session: Session, ttx: TTX, locale: str) -> list[tuple[MselSimulatedActor, bool]]:
    """The exercise's cast (seeded on first use) and, per actor, whether an
    inject sends it."""
    if ensure_cast(session, ttx, locale):
        session.commit()
    actors = list(
        session.exec(
            select(MselSimulatedActor)
            .where(MselSimulatedActor.ttx_id == ttx.id)
            .order_by(MselSimulatedActor.position)
        )
    )
    senders = set(
        session.exec(
            select(Inject.simulated_actor_id).where(
                Inject.simulated_actor_id.in_([a.id for a in actors])
            )
        )
    )
    return [(actor, actor.id in senders) for actor in actors]


def _cast_row(session: Session, ttx: TTX, actor_id: uuid.UUID) -> MselSimulatedActor:
    actor = session.get(MselSimulatedActor, actor_id)
    if actor is None or actor.ttx_id != ttx.id:
        raise AppException("ACTOR_NOT_FOUND", "That actor isn't in this exercise's cast.", 404)
    return actor


def _commit_cast_edit(session: Session, ttx: TTX, user: User) -> None:
    msel = find_msel(session, ttx.id, lock=True)
    if msel is not None:
        _reopen(msel)
        _touch(msel, user)
        session.add(msel)
    session.commit()


def add_exercise_actor(session: Session, ttx: TTX, item, user: User) -> MselSimulatedActor:
    ensure_not_disabled(session, "actor", ttx.organization_id, item.origin, item.origin_id)
    position = len(
        list(session.exec(select(MselSimulatedActor.id).where(MselSimulatedActor.ttx_id == ttx.id)))
    )
    actor = _new_cast_row(ttx)
    actor.position = position
    _write_actor(actor, item)
    session.add(actor)
    session.add(ttx)
    _commit_cast_edit(session, ttx, user)
    session.refresh(actor)
    logger.info("Actor %s added to the cast of TTX %s by user %s.", actor.id, ttx.id, user.id)
    return actor


def update_exercise_actor(
    session: Session, ttx: TTX, actor_id: uuid.UUID, item, user: User
) -> MselSimulatedActor:
    actor = _cast_row(session, ttx, actor_id)
    _write_actor(actor, item)
    session.add(actor)
    _commit_cast_edit(session, ttx, user)
    session.refresh(actor)
    return actor


def remove_exercise_actor(session: Session, ttx: TTX, actor_id: uuid.UUID, user: User) -> None:
    actor = _cast_row(session, ttx, actor_id)
    used = session.exec(select(Inject.id).where(Inject.simulated_actor_id == actor.id)).first()
    if used is not None:
        raise _reject(
            "ACTOR_IN_USE", "An inject is sent by this actor. Change its sender first.", 409
        )
    session.delete(actor)
    _commit_cast_edit(session, ttx, user)
    logger.info("Actor %s removed from the cast of TTX %s by user %s.", actor_id, ttx.id, user.id)


# -- single injects (Library -> Injects) -----------------------------------
#
# The inject library adds a copy to the MSEL, or removes one, without the
# whole-MSEL save: like a cast edit, each is an edit of the MSEL (revision
# bump, back to DRAFT). They need an editable MSEL, and keep within the
# limits the whole-MSEL save enforces, so the next autosave still passes.


def _resolve_sender(session: Session, ttx: TTX, payload) -> MselSimulatedActor | None:
    """The cast actor that sends a copied inject: the one named by id, or
    the one the template's sender already is in the cast (same TTX-Zone
    actor, or same name), or a copy added now."""
    if payload.actor_id:
        return _cast_row(session, ttx, payload.actor_id)
    sender = payload.sender
    if sender is None:
        return None
    cast = list(session.exec(select(MselSimulatedActor).where(MselSimulatedActor.ttx_id == ttx.id)))
    for actor in cast:
        same_system = (
            sender.origin == ActorOrigin.SYSTEM
            and actor.origin == ActorOrigin.SYSTEM
            and actor.origin_id == sender.origin_id
        )
        if same_system or actor.name.strip().casefold() == sender.name.strip().casefold():
            return actor
    if len(cast) >= MAX_ACTORS:
        raise _reject("CAST_FULL", "The exercise's cast is full. Remove an actor first.", 409)
    _check_origin(sender.origin, sender.origin_id)
    actor = _new_cast_row(ttx)
    actor.position = len(cast)
    actor.name = sender.name.strip()
    actor.type = sender.type
    actor.description = sender.description
    actor.channel = sender.channel.value if sender.channel else None
    actor.origin = sender.origin or ActorOrigin.EXERCISE
    actor.origin_id = sender.origin_id if sender.origin else None
    actor.origin_name = sender.name.strip() if sender.origin else None
    session.add(actor)
    session.add(ttx)
    session.flush()  # the inject points at it
    return actor


def add_exercise_inject(
    session: Session, ttx: TTX, payload, user: User
) -> tuple[TTXMsel, ConversionReport]:
    ensure_not_disabled(session, "inject", ttx.organization_id, payload.origin, payload.origin_id)
    msel, form = _editable(session, ttx)
    phase = session.get(MselPhase, payload.phase_id)
    if phase is None or phase.msel_id != msel.id:
        raise _reject("MSEL_ROW_NOT_FOUND", "That phase isn't in this MSEL.", 404)
    known_objectives = set(
        session.exec(select(TTXObjective.id).where(TTXObjective.form_id == form.id))
    )
    if any(o not in known_objectives for o in payload.objective_ids):
        raise _reject("UNKNOWN_OBJECTIVE", "An objective isn't in the needs analysis.")
    existing = list(session.exec(select(Inject.id).where(Inject.msel_id == msel.id)))
    if len(existing) >= MAX_INJECTS:
        raise _reject(
            "MSEL_FULL",
            "An MSEL holds at most {limit} injects.",
            409,
            params={"limit": MAX_INJECTS},
        )
    actor = _resolve_sender(session, ttx, payload)

    inject = Inject(
        ttx_id=ttx.id,
        msel_id=msel.id,
        created_by_id=user.id,
        position=len(existing),
        phase_id=phase.id,
        kind=payload.kind,
        format=payload.format,
        poll_question=payload.poll_question,
        poll_options=payload.poll_options,
        poll_outcomes=payload.poll_outcomes,
        title=payload.title.strip(),
        content=payload.content,
        offset_minutes=payload.offset_minutes if payload.kind == InjectKind.MANDATORY else None,
        trigger_condition=payload.trigger_condition,
        contingent_purpose=payload.contingent_purpose,
        simulated_actor_id=actor.id if actor else None,
        recipients=payload.recipients,
        **_copy_attribution(session, msel, payload),
        delivery_method=payload.delivery_method,
        attachment_notes=payload.attachment_notes,
        facilitator_notes=payload.facilitator_notes,
        origin=payload.origin,
        origin_id=payload.origin_id if payload.origin else None,
        origin_name=payload.origin_name if payload.origin else None,
    )
    inject.code = _inject_code(inject.format, msel.next_inject_number)
    msel.next_inject_number += 1
    session.add(inject)
    session.flush()  # links and actions point at it

    session.add_all(
        InjectObjective(inject_id=inject.id, objective_id=o) for o in payload.objective_ids
    )
    # A template may come from another ATT&CK release than the MSEL's: its
    # techniques are moved onto the MSEL's (reported), never refused.
    report = ConversionReport()
    triples = convert_refs(
        list(dict.fromkeys(ref.key() for ref in payload.attack_techniques)),
        msel.attack_version,
        report,
    )
    session.add_all(
        InjectAttackTechnique(
            inject_id=inject.id, position=p, domain=d, tactic_id=ta, technique_id=te
        )
        for p, (d, ta, te) in enumerate(triples)
    )
    session.add_all(
        InjectExpectedAction(
            inject_id=inject.id,
            code=f"{inject.code}-A{position + 1}",
            position=position,
            description=item.description,
            responsible_role=item.responsible_role,
            expected_within_minutes=item.expected_within_minutes,
            objective_ids=list(payload.objective_ids),
        )
        for position, item in enumerate(payload.expected_actions)
    )
    # A TTX-Zone inject's illustrations come along, in the copy's language.
    staged = []
    template = catalog_inject(payload.origin_id) if payload.origin == ActorOrigin.SYSTEM else None
    if template and template.images:
        language = payload.language or ttx.content_language or "en"
        staged = stage_catalog_images(
            session, msel, [image.path(language) for image in template.images], user.id
        )
        session.flush()
        session.add_all(
            InjectImage(
                inject_id=inject.id,
                image_id=image.id,
                position=position,
                caption=(caption.es if language == "es" else caption.en),
            )
            for position, ((image, _), caption) in enumerate(
                zip(staged, (i.caption for i in template.images), strict=False)
            )
        )
    _reopen(msel)
    _touch(msel, user)
    session.add(msel)
    written = []
    try:
        if staged:
            ensure_msel_image_dir()
        for image, data in staged:
            image_path(image).write_bytes(data)
            written.append(image_path(image))
        session.commit()
    except Exception:
        session.rollback()
        for path in written:
            path.unlink(missing_ok=True)
        raise
    session.refresh(msel)
    logger.info(
        "Inject %s (%s) added to the MSEL of TTX %s by user %s.",
        inject.id,
        inject.origin_id or "new",
        ttx.id,
        user.id,
    )
    return msel, report


def _copy_attribution(session: Session, msel: TTXMsel, payload) -> dict:
    """Whose activity a copied inject's techniques are: as the copy says,
    or -- a template carries techniques but no attribution -- the
    scenario's first threat actor (none yet: attributed to no one, and the
    report says so)."""
    if not payload.attack_techniques:
        return {"attack_attribution": None, "threat_actor_id": None}
    attribution = payload.attack_attribution or AttackAttribution.THREAT_ACTOR
    if attribution == AttackAttribution.NOISE:
        return {"attack_attribution": attribution, "threat_actor_id": None}
    actors = _threat_actors(session, msel)
    actor = next((a for a in actors if a.id == payload.threat_actor_id), None)
    if payload.threat_actor_id and actor is None:
        raise _reject("MSEL_ROW_NOT_FOUND", "That threat actor isn't in this scenario.", 404)
    if actor is None and payload.attack_attribution is None and actors:
        actor = actors[0]
    return {"attack_attribution": attribution, "threat_actor_id": actor.id if actor else None}


# -- single threat actors (Library -> Threat actors) ----------------------------


def add_exercise_threat_actor(
    session: Session, ttx: TTX, item, user: User
) -> tuple[MselThreatActor, ConversionReport]:
    """A copy of a library threat actor added to the scenario, moved onto
    the MSEL's ATT&CK release (it may come from another): a group that
    release doesn't have leaves an unknown actor with its name, all
    reported."""
    ensure_not_disabled(session, "threat_actor", ttx.organization_id, item.origin, item.origin_id)
    msel, _ = _editable(session, ttx)
    existing = _threat_actors(session, msel)
    if len(existing) >= MAX_THREAT_ACTORS:
        raise _reject(
            "THREAT_ACTORS_FULL",
            "A scenario has at most {limit} threat actors.",
            409,
            params={"limit": MAX_THREAT_ACTORS},
        )
    report = ConversionReport()
    group_id, pairs = convert_profile(
        item.mitre_group_id,
        [t.key() for t in item.techniques],
        msel.attack_version,
        report,
    )
    actor = _new_threat_actor(msel)
    actor.position = len(existing)
    _write_threat_actor(
        actor,
        item.model_copy(
            update={
                "mitre_group_id": group_id,
                "techniques": [ThreatActorTechnique(domain=d, technique_id=t) for d, t in pairs],
            }
        ),
    )
    session.add(actor)
    _reopen(msel)
    _touch(msel, user)
    session.add(msel)
    session.commit()
    session.refresh(actor)
    logger.info(
        "Threat actor %s added to the MSEL of TTX %s by user %s.", actor.id, ttx.id, user.id
    )
    return actor, report


def remove_exercise_threat_actor(
    session: Session, ttx: TTX, actor_id: uuid.UUID, user: User
) -> None:
    """Its injects keep their attribution to a threat actor, now to none
    (the report points them out)."""
    msel, _ = _editable(session, ttx)
    actor = session.get(MselThreatActor, actor_id)
    if actor is None or actor.msel_id != msel.id:
        raise _reject("MSEL_ROW_NOT_FOUND", "That threat actor isn't in this scenario.", 404)
    session.execute(
        update(Inject).where(Inject.threat_actor_id == actor.id).values(threat_actor_id=None)
    )
    session.delete(actor)
    _reopen(msel)
    _touch(msel, user)
    session.add(msel)
    session.commit()
    logger.info(
        "Threat actor %s removed from the MSEL of TTX %s by user %s.", actor_id, ttx.id, user.id
    )


def remove_exercise_inject(session: Session, ttx: TTX, inject_id: uuid.UUID, user: User) -> None:
    msel, _ = _editable(session, ttx)
    inject = session.get(Inject, inject_id)
    if inject is None or inject.msel_id != msel.id:
        raise _reject("MSEL_ROW_NOT_FOUND", "That inject isn't in this MSEL.", 404)
    # Branches that hang from it or come back to it lose that end (the
    # report then points them out); nothing else points at an inject.
    action_ids = select(InjectExpectedAction.id).where(InjectExpectedAction.inject_id == inject.id)
    session.execute(
        update(Inject)
        .where(Inject.branch_from_id == inject.id)
        .values(branch_from_id=None, branch_action_id=None)
    )
    session.execute(
        update(Inject).where(Inject.branch_action_id.in_(action_ids)).values(branch_action_id=None)
    )
    session.execute(
        update(Inject).where(Inject.rejoin_inject_id == inject.id).values(rejoin_inject_id=None)
    )
    session.execute(delete(InjectExpectedAction).where(InjectExpectedAction.inject_id == inject.id))
    session.execute(delete(InjectObjective).where(InjectObjective.inject_id == inject.id))
    session.execute(delete(InjectImage).where(InjectImage.inject_id == inject.id))
    session.execute(delete(InjectFile).where(InjectFile.inject_id == inject.id))
    session.execute(
        delete(InjectAttackTechnique).where(InjectAttackTechnique.inject_id == inject.id)
    )
    session.delete(inject)
    _reopen(msel)
    _touch(msel, user)
    session.add(msel)
    session.commit()
    logger.info("Inject %s removed from the MSEL of TTX %s by user %s.", inject_id, ttx.id, user.id)


def latest_snapshot(session: Session, ttx_id: uuid.UUID) -> MselSnapshot | None:
    return session.exec(
        select(MselSnapshot)
        .join(TTXMsel, TTXMsel.id == MselSnapshot.msel_id)
        .where(TTXMsel.ttx_id == ttx_id)
        .order_by(MselSnapshot.version.desc(), MselSnapshot.created_at.desc())
    ).first()


def delete_msels_for_ttx(session: Session, ttx_ids: list[uuid.UUID]) -> None:
    """Delete every MSEL row of these exercises (and any inject), children
    first -- no FK here cascades. Runs before the needs forms go, since
    phases and injects reference their objectives."""
    if not ttx_ids:
        return
    inject_ids = list(session.exec(select(Inject.id).where(Inject.ttx_id.in_(ttx_ids))))
    if inject_ids:
        # Branches point at other injects and their actions: cut them first.
        session.execute(
            update(Inject)
            .where(Inject.id.in_(inject_ids))
            .values(branch_from_id=None, branch_action_id=None, rejoin_inject_id=None)
        )
        session.execute(
            delete(InjectExpectedAction).where(InjectExpectedAction.inject_id.in_(inject_ids))
        )
        session.execute(delete(InjectObjective).where(InjectObjective.inject_id.in_(inject_ids)))
        session.execute(delete(InjectImage).where(InjectImage.inject_id.in_(inject_ids)))
        session.execute(delete(InjectFile).where(InjectFile.inject_id.in_(inject_ids)))
        session.execute(
            delete(InjectAttackTechnique).where(InjectAttackTechnique.inject_id.in_(inject_ids))
        )
        session.execute(delete(Inject).where(Inject.id.in_(inject_ids)))
    # The cast belongs to the exercise (it may exist without an MSEL); its
    # injects are gone above.
    session.execute(delete(MselSimulatedActor).where(MselSimulatedActor.ttx_id.in_(ttx_ids)))
    msel_ids = list(session.exec(select(TTXMsel.id).where(TTXMsel.ttx_id.in_(ttx_ids))))
    if not msel_ids:
        return
    phase_ids = list(session.exec(select(MselPhase.id).where(MselPhase.msel_id.in_(msel_ids))))
    if phase_ids:
        session.execute(
            delete(MselPhaseObjective).where(MselPhaseObjective.phase_id.in_(phase_ids))
        )
    session.execute(delete(MselPhase).where(MselPhase.msel_id.in_(msel_ids)))
    # Injects pointed at these; they're gone above.
    session.execute(delete(MselThreatActor).where(MselThreatActor.msel_id.in_(msel_ids)))
    session.execute(delete(MselSnapshot).where(MselSnapshot.msel_id.in_(msel_ids)))
    delete_images_for_msels(session, msel_ids)
    delete_files_for_msels(session, msel_ids)
    session.execute(delete(TTXMsel).where(TTXMsel.id.in_(msel_ids)))
