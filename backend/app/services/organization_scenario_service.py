"""The scenario library: TTX-Zone's catalog, the organization's scenarios
and the files people share.

Organization scenarios are managed by the organization's Program Managers
(made from a TTX-Zone scenario, another of theirs, one of the
organization's exercises or an imported file); its Exercise Planners copy
them onto their exercises (scenario_service.apply_document). Deleting one
an exercise came from disables it instead (library_usage_service)."""

import logging
import uuid
from datetime import UTC, datetime
from typing import cast

from fastapi import UploadFile
from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.data.scenario_catalog import SystemScenario, scenario_catalog
from app.models import TTX, ActorOrigin, OrganizationScenario, User
from app.schemas.scenario import (
    OrganizationScenarioCreateRequest,
    ScenarioCheck,
    ScenarioCounts,
    ScenarioDocument,
    ScenarioRead,
    ScenarioSummary,
)
from app.schemas.ttx import TTXCreateRequest
from app.services.library_usage_service import ensure_not_disabled, get_item
from app.services.scenario_document import (
    ScenarioFormatError,
    parse,
    scenario_issue,
    validate_data,
)
from app.services.scenario_service import apply_document, check_document, counts, export_ttx
from app.services.ttx_service import create_ttx

logger = logging.getLogger(__name__)


def _reject(
    code: str, message: str, status_code: int = 422, params: dict | None = None
) -> AppException:
    return AppException(code, message, status_code, log_level=logging.WARNING, params=params)


# -- reading a file --------------------------------------------------------------


def read_upload(upload: UploadFile) -> ScenarioDocument | ScenarioCheck:
    """The document in an uploaded `.ttx.md` file, or the report of why it
    can't be read."""
    raw = upload.file.read(settings.SCENARIO_MAX_BYTES + 1)
    if len(raw) > settings.SCENARIO_MAX_BYTES:
        max_mb = settings.SCENARIO_MAX_BYTES // (1024 * 1024)
        return _failed(
            "file", "SCENARIO_TOO_LARGE", "A scenario file can be {max_mb} MB.", max_mb=max_mb
        )
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return _failed("file", "SCENARIO_NOT_TEXT", "The file isn't UTF-8 text.")
    try:
        return parse(text)
    except ScenarioFormatError as exc:
        return ScenarioCheck(ok=False, errors=exc.issues)


def _failed(path: str, code: str, message: str, **params: str | int) -> ScenarioCheck:
    return ScenarioCheck(ok=False, errors=[scenario_issue(path, code, message, **params)])


# -- summaries ----------------------------------------------------------------------


def _attack_version(doc: ScenarioDocument) -> str | None:
    return doc.msel.attack_version if doc.msel else None


def system_summary(scenario: SystemScenario, locale: str) -> ScenarioSummary:
    doc = scenario.document(locale)
    return ScenarioSummary(
        id=scenario.id,
        name=doc.exercise.name,
        description=doc.exercise.description,
        language=doc.language,
        languages=scenario.languages,
        format_version=doc.format_version,
        attack_version=_attack_version(doc),
        counts=counts(doc),
    )


def system_read(scenario_id: str, locale: str) -> ScenarioRead:
    scenario = get_system(scenario_id)
    doc = scenario.document(locale)
    return ScenarioRead(**system_summary(scenario, locale).model_dump(), document=doc)


def get_system(scenario_id: str) -> SystemScenario:
    scenario = scenario_catalog().get(scenario_id)
    if scenario is None:
        raise _reject("SCENARIO_NOT_FOUND", "That TTX-Zone scenario doesn't exist.", 404)
    return scenario


def organization_summary(row: OrganizationScenario, usage_count: int = 0) -> ScenarioSummary:
    return ScenarioSummary(
        id=str(row.id),
        name=row.name,
        description=row.description,
        language=row.language,
        languages=[row.language],
        format_version=row.format_version,
        attack_version=row.attack_version,
        counts=ScenarioCounts.model_validate(row.counts),
        origin=row.origin,
        origin_id=row.origin_id,
        origin_name=row.origin_name,
        disabled_at=row.disabled_at,
        usage_count=usage_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def organization_document(row: OrganizationScenario) -> ScenarioDocument:
    # Stored as it was read: an older format is upgraded on the way out.
    return validate_data(row.document)


def list_scenarios(session: Session, organization_id: uuid.UUID) -> list[OrganizationScenario]:
    return list(
        session.exec(
            select(OrganizationScenario)
            .where(OrganizationScenario.organization_id == organization_id)
            .order_by(OrganizationScenario.name)
        )
    )


def get_scenario(
    session: Session, organization_id: uuid.UUID, scenario_id: uuid.UUID
) -> OrganizationScenario:
    return cast(OrganizationScenario, get_item(session, "scenario", organization_id, scenario_id))


# -- writes -------------------------------------------------------------------------


def store(
    session: Session,
    organization_id: uuid.UUID,
    doc: ScenarioDocument,
    user: User,
    *,
    name: str | None = None,
    origin: tuple[ActorOrigin, str, str] | None = None,
) -> OrganizationScenario:
    """Add a document to the organization's library (already checked)."""
    level, origin_id, origin_name = origin or (None, None, None)
    row = OrganizationScenario(
        organization_id=organization_id,
        name=(name or doc.exercise.name)[:255],
        description=doc.exercise.description,
        language=doc.language,
        format_version=doc.format_version,
        attack_version=_attack_version(doc),
        document=doc.model_dump(mode="json"),
        counts=counts(doc).model_dump(),
        origin=level,
        origin_id=origin_id,
        origin_name=origin_name,
        created_by_id=user.id,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    logger.info(
        "Scenario %s added to org %s's library by user %s.", row.id, organization_id, user.id
    )
    return row


def _copy_name(name: str) -> str:
    return f"{name[:250]}_copy"


def create(
    session: Session,
    organization_id: uuid.UUID,
    payload: OrganizationScenarioCreateRequest,
    user: User,
    locale: str,
) -> OrganizationScenario:
    if payload.system_id is not None:
        scenario = get_system(payload.system_id)
        doc = scenario.document(payload.language or locale)
        origin = (ActorOrigin.SYSTEM, scenario.id, doc.exercise.name)
        name = payload.name or _copy_name(doc.exercise.name)
    elif payload.organization_scenario_id is not None:
        source = get_scenario(session, organization_id, payload.organization_scenario_id)
        doc = organization_document(source)
        origin = (ActorOrigin.ORGANIZATION, str(source.id), source.name)
        name = payload.name or _copy_name(source.name)
    else:
        ttx = session.get(TTX, payload.ttx_id)
        if ttx is None or ttx.organization_id != organization_id:
            raise _reject("TTX_NOT_FOUND", "That exercise isn't in this organization.", 404)
        doc = export_ttx(session, ttx, locale)
        origin = (ActorOrigin.EXERCISE, str(ttx.id), ttx.name)
        name = payload.name or ttx.name
    checked = check_document(doc)
    if checked.errors:
        first = checked.errors[0]
        raise _reject("SCENARIO_INVALID", first.message, params=first.params)
    return store(session, organization_id, doc, user, name=name, origin=origin)


def import_file(
    session: Session,
    organization_id: uuid.UUID,
    upload: UploadFile,
    user: User,
    *,
    dry_run: bool,
) -> tuple[ScenarioCheck, OrganizationScenario | None]:
    """Check a shared file and, unless `dry_run`, add it to the library.
    Nothing is written when the file has errors."""
    doc = read_upload(upload)
    if isinstance(doc, ScenarioCheck):
        return doc, None
    checked = check_document(doc)
    report = ScenarioCheck(
        ok=not checked.errors,
        errors=checked.errors,
        warnings=checked.warnings,
        name=doc.exercise.name,
        language=doc.language,
        format_version=doc.format_version,
        counts=counts(doc),
    )
    if checked.errors or dry_run:
        return report, None
    return report, store(session, organization_id, doc, user)


def update(
    session: Session, row: OrganizationScenario, name: str, description: str | None
) -> OrganizationScenario:
    row.name = name.strip()
    row.description = description
    row.updated_at = datetime.now(UTC)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def delete(session: Session, row: OrganizationScenario) -> None:
    session.delete(row)
    session.commit()


def document_to_apply(
    session: Session, ttx: TTX, source: str, scenario_id: str, language: str | None, locale: str
) -> tuple[ScenarioDocument, tuple[str, str, str]]:
    """A library scenario to copy onto the exercise, and its origin. A
    TTX-Zone one comes in the language asked for, else the exercise's: the
    reader's own only when the exercise has none yet."""
    return library_document(
        session,
        ttx.organization_id,
        source,
        scenario_id,
        language or ttx.content_language or locale,
    )


def library_document(
    session: Session, organization_id: uuid.UUID, source: str, scenario_id: str, language: str
) -> tuple[ScenarioDocument, tuple[str, str, str]]:
    """A library scenario and its origin; `language` picks a TTX-Zone one's."""
    if source == "system":
        doc = get_system(scenario_id).document(language)
        return doc, (ActorOrigin.SYSTEM.value, scenario_id, doc.exercise.name)
    try:
        row_id = uuid.UUID(scenario_id)
    except ValueError:
        raise _reject("SCENARIO_NOT_FOUND", "That scenario isn't in this library.", 404) from None
    row = get_scenario(session, organization_id, row_id)
    ensure_not_disabled(session, "scenario", organization_id, ActorOrigin.ORGANIZATION, str(row.id))
    return organization_document(row), (ActorOrigin.ORGANIZATION.value, str(row.id), row.name)


def create_exercise(
    session: Session,
    organization_id: uuid.UUID,
    doc: ScenarioDocument,
    user: User,
    locale: str,
    *,
    dry_run: bool,
    origin: tuple[str, str, str] | None = None,
    variables: dict[str, str] | None = None,
) -> ScenarioCheck:
    """A new exercise made from the document, its creator on the team, in
    one transaction: errors, or `dry_run`, leave no exercise behind."""
    ttx = create_ttx(
        session,
        organization_id,
        user,
        TTXCreateRequest(
            name=doc.exercise.name[:255],
            organization_id=organization_id,
            content_language=doc.language,
        ),
        locale,
        commit=False,
    )
    ttx_id = ttx.id
    report = apply_document(
        session, ttx, doc, user, dry_run=dry_run, origin=origin, variables=variables
    )
    # Nothing is replaced: the "exercise" compared against is the new one.
    report.replaces = None
    if not report.ok:
        session.rollback()
    elif not dry_run:
        report.ttx_id = ttx_id
    return report
