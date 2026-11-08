"""The scenario library (Library -> Scenarios): TTX-Zone's catalog (read
only), the organization's scenarios (Program Managers manage them, import
and export them; Exercise Planners list them) and the exercise in context
(its Exercise Planners export it, and overwrite it with a library scenario
or a shared file -- always checked first with `dry_run`)."""

import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from pydantic import TypeAdapter, ValidationError
from sqlmodel import Session

from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.i18n import get_locale
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    require_planner,
    verify_csrf,
)
from app.data.scenario_catalog import scenario_catalog
from app.models import TTX, RoleEnum, User
from app.schemas.library_usage import LibraryDeleteResult, LibraryUsage
from app.schemas.scenario import (
    ExerciseScenarioRead,
    OrganizationScenarioCreateRequest,
    OrganizationScenarioUpdateRequest,
    ScenarioApplyRequest,
    ScenarioCheck,
    ScenarioDocument,
    ScenarioDocumentV1,
    ScenarioDocumentV2,
    ScenarioDocumentV3,
    ScenarioDocumentV4,
    ScenarioDocumentV5,
    ScenarioDocumentV6,
    ScenarioDocumentV7,
    ScenarioDocumentV8,
    ScenarioListResponse,
    ScenarioRead,
    ScenarioSummary,
    ScenarioVariables,
)
from app.services import organization_scenario_service as library
from app.services import platform_audit_service
from app.services.actor_library_service import require_library_manager, require_library_reader
from app.services.library_usage_service import delete_or_disable, enable, usage, usage_counts
from app.services.scenario_document import file_name, render
from app.services.scenario_service import (
    apply_document,
    export_ttx,
    has_runs,
    localize_check,
    ttx_counts,
)

router = APIRouter(tags=["scenario-library"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)
# The import's `variables` form field: a JSON object, as in ScenarioApplyRequest.
_VARIABLES = TypeAdapter(ScenarioVariables)


def _download(doc: ScenarioDocument) -> Response:
    return Response(
        render(doc, stamp=True).encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name(doc)}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/scenario-format/{version}/schema.json")
def scenario_schema_endpoint(version: int, _user: User = Depends(get_current_user)) -> dict:
    """The JSON Schema of a scenario file's data block, per format version
    (2 adds a phase's headline, 3 rooms, 4 inject files, 5 rendered
    artifacts, 6 inject formats and polls, 7 poll outcomes, 8 impact
    meters): for anyone writing or checking files outside TTX-Zone."""
    models = {
        1: ScenarioDocumentV1,
        2: ScenarioDocumentV2,
        3: ScenarioDocumentV3,
        4: ScenarioDocumentV4,
        5: ScenarioDocumentV5,
        6: ScenarioDocumentV6,
        7: ScenarioDocumentV7,
        8: ScenarioDocumentV8,
    }
    if version not in models:
        raise AppException("SCENARIO_FORMAT_NOT_FOUND", "No such scenario format version.", 404)
    return models[version].model_json_schema()


# -- TTX-Zone ---------------------------------------------------------------------


@router.get("/scenario-catalog", response_model=ScenarioListResponse)
def scenario_catalog_endpoint(
    _user: User = Depends(get_current_user), locale: str = Depends(get_locale)
) -> ScenarioListResponse:
    """TTX-Zone's own scenarios, in the reader's language when available."""
    return ScenarioListResponse(
        items=[library.system_summary(s, locale) for s in scenario_catalog().values()]
    )


@router.get("/scenario-catalog/{scenario_id}", response_model=ScenarioRead)
def scenario_catalog_item_endpoint(
    scenario_id: str,
    _user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
) -> ScenarioRead:
    """One scenario of TTX-Zone's catalog."""
    return library.system_read(scenario_id, locale)


# -- the organization's ---------------------------------------------------------------


@router.get("/organizations/{organization_id}/scenarios", response_model=ScenarioListResponse)
def list_org_scenarios_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioListResponse:
    """The organization's library of scenarios."""
    require_library_reader(session, user, organization_id)
    used = usage_counts(session, "scenario", organization_id)
    return ScenarioListResponse(
        items=[
            library.organization_summary(row, used.get(str(row.id), 0))
            for row in library.list_scenarios(session, organization_id)
        ]
    )


@router.get("/organizations/{organization_id}/scenarios/{scenario_id}", response_model=ScenarioRead)
def get_org_scenario_endpoint(
    organization_id: uuid.UUID,
    scenario_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioRead:
    """One scenario of the organization's library."""
    require_library_reader(session, user, organization_id)
    row = library.get_scenario(session, organization_id, scenario_id)
    return ScenarioRead(
        **library.organization_summary(row).model_dump(),
        document=library.organization_document(row),
    )


@router.post(
    "/organizations/{organization_id}/scenarios",
    response_model=ScenarioSummary,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_org_scenario_endpoint(
    organization_id: uuid.UUID,
    payload: OrganizationScenarioCreateRequest,
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ScenarioSummary:
    """From a TTX-Zone scenario, another of the organization's (a
    duplicate, `_copy`) or one of its exercises (its current content)."""
    require_library_manager(session, user, organization_id)
    row = library.create(session, organization_id, payload, user, locale)
    return library.organization_summary(row)


@router.post(
    "/organizations/{organization_id}/scenarios/import",
    response_model=ScenarioCheck,
    dependencies=[Depends(verify_csrf)],
)
def import_org_scenario_endpoint(
    organization_id: uuid.UUID,
    response: Response,
    file: UploadFile = File(...),
    dry_run: bool = Query(True),
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ScenarioCheck:
    """Check a shared `.ttx.md` file (`dry_run`, the default: nothing is
    written) or add it to the library. A file with errors is never added."""
    require_library_manager(session, user, organization_id)
    report, row = library.import_file(session, organization_id, file, user, dry_run=dry_run)
    if row is not None:
        response.status_code = 201
        report.name = row.name
    return localize_check(report, locale)


@router.patch(
    "/organizations/{organization_id}/scenarios/{scenario_id}",
    response_model=ScenarioSummary,
    dependencies=[Depends(verify_csrf)],
)
def update_org_scenario_endpoint(
    organization_id: uuid.UUID,
    scenario_id: uuid.UUID,
    payload: OrganizationScenarioUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioSummary:
    """Rename it or change its description (its content is the document)."""
    require_library_manager(session, user, organization_id)
    row = library.get_scenario(session, organization_id, scenario_id)
    library.update(session, row, payload.name, payload.description)
    return library.organization_summary(row)


@router.delete(
    "/organizations/{organization_id}/scenarios/{scenario_id}",
    response_model=LibraryDeleteResult,
    dependencies=[Depends(verify_csrf)],
)
def delete_org_scenario_endpoint(
    organization_id: uuid.UUID,
    scenario_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryDeleteResult:
    """Delete a scenario of the organization's library."""
    require_library_manager(session, user, organization_id)
    row = library.get_scenario(session, organization_id, scenario_id)
    return delete_or_disable(session, "scenario", row, user, lambda: library.delete(session, row))


@router.get(
    "/organizations/{organization_id}/scenarios/{scenario_id}/usage",
    response_model=LibraryUsage,
)
def org_scenario_usage_endpoint(
    organization_id: uuid.UUID,
    scenario_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryUsage:
    """Where a scenario of the organization's library has been used."""
    require_library_manager(session, user, organization_id)
    return usage(session, "scenario", library.get_scenario(session, organization_id, scenario_id))


@router.post(
    "/organizations/{organization_id}/scenarios/{scenario_id}/enable",
    response_model=ScenarioSummary,
    dependencies=[Depends(verify_csrf)],
)
def enable_org_scenario_endpoint(
    organization_id: uuid.UUID,
    scenario_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioSummary:
    """Enable a disabled scenario of the organization's library."""
    require_library_manager(session, user, organization_id)
    row = library.get_scenario(session, organization_id, scenario_id)
    enable(session, row)
    return library.organization_summary(row)


@router.get("/organizations/{organization_id}/scenarios/{scenario_id}/export")
def export_org_scenario_endpoint(
    organization_id: uuid.UUID,
    scenario_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    """The scenario as a `.ttx.md` file to share."""
    require_library_manager(session, user, organization_id)
    row = library.get_scenario(session, organization_id, scenario_id)
    doc = library.organization_document(row)
    return _download(
        doc.model_copy(update={"exercise": doc.exercise.model_copy(update={"name": row.name})})
    )


# -- the exercise in context ---------------------------------------------------------


@router.get("/ttx/{ttx_id}/scenario", response_model=ExerciseScenarioRead)
def ttx_scenario_endpoint(
    ttx: TTX = Depends(_planner), session: Session = Depends(get_session)
) -> ExerciseScenarioRead:
    """What the exercise holds today (what exporting it packs, and what
    copying a scenario onto it would replace), and whether it was played
    (then no scenario can replace it)."""
    return ExerciseScenarioRead(
        **ttx_counts(session, ttx).model_dump(), played=has_runs(session, ttx)
    )


@router.get("/ttx/{ttx_id}/scenario/export")
def export_ttx_scenario_endpoint(
    ttx: TTX = Depends(_planner),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> Response:
    """The exercise as a `.ttx.md` file -- without people, approvals or
    dates."""
    return _download(export_ttx(session, ttx, locale))


def _form_variables(variables: str | None) -> ScenarioVariables:
    try:
        return _VARIABLES.validate_json(variables) if variables else {}
    except ValidationError:
        raise AppException(
            "SCENARIO_BAD_VARIABLES",
            "The placeholder values aren't valid.",
            422,
            log_level=logging.WARNING,
        ) from None


def _audit_applied(
    session: Session, user: User, ttx: TTX, report: ScenarioCheck, dry_run: bool, source: dict
) -> None:
    # Overwriting an exercise can't be undone; no step-up (the dialog shows
    # what it replaces), the activity log records who did it.
    if not dry_run and report.ok:
        platform_audit_service.record_exercise(
            session, user, "exercise.scenario_applied", ttx, {"name": report.name, **source}
        )


@router.post(
    "/ttx/{ttx_id}/scenario/apply",
    response_model=ScenarioCheck,
    dependencies=[Depends(verify_csrf)],
)
def apply_ttx_scenario_endpoint(
    payload: ScenarioApplyRequest,
    dry_run: bool = Query(True),
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ScenarioCheck:
    """Overwrite the exercise with a TTX-Zone or organization scenario --
    or, with `dry_run` (the default), only report what would happen."""
    doc, origin = library.document_to_apply(
        session, ttx, payload.source, payload.id, payload.language, locale
    )
    report = apply_document(
        session, ttx, doc, user, dry_run=dry_run, origin=origin, variables=payload.variables
    )
    _audit_applied(
        session, user, ttx, report, dry_run, {"source": payload.source, "id": str(payload.id)}
    )
    return localize_check(report, locale)


@router.post(
    "/ttx/{ttx_id}/scenario/import",
    response_model=ScenarioCheck,
    dependencies=[Depends(verify_csrf)],
)
def import_ttx_scenario_endpoint(
    file: UploadFile = File(...),
    variables: str | None = Form(None, max_length=64_000),
    dry_run: bool = Query(True),
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ScenarioCheck:
    """Overwrite the exercise with a shared `.ttx.md` file -- or, with
    `dry_run` (the default), only check it."""
    values = _form_variables(variables)
    doc = library.read_upload(file)
    if isinstance(doc, ScenarioCheck):
        return localize_check(doc, locale)
    report = apply_document(session, ttx, doc, user, dry_run=dry_run, variables=values)
    _audit_applied(session, user, ttx, report, dry_run, {"source": "file"})
    return localize_check(report, locale)


# -- a new exercise ------------------------------------------------------------------


@router.post(
    "/organizations/{organization_id}/exercises/from-scenario",
    response_model=ScenarioCheck,
    dependencies=[Depends(verify_csrf)],
)
def exercise_from_scenario_endpoint(
    organization_id: uuid.UUID,
    payload: ScenarioApplyRequest,
    response: Response,
    dry_run: bool = Query(True),
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ScenarioCheck:
    """A new exercise from a TTX-Zone or organization scenario, leaving
    every other one alone -- or, with `dry_run` (the default), only report
    what would happen."""
    require_planner(session, user, organization_id)
    doc, origin = library.library_document(
        session, organization_id, payload.source, payload.id, payload.language or locale
    )
    report = library.create_exercise(
        session,
        organization_id,
        doc,
        user,
        locale,
        dry_run=dry_run,
        origin=origin,
        variables=payload.variables,
    )
    if report.ttx_id is not None:
        response.status_code = 201
    return localize_check(report, locale)


@router.post(
    "/organizations/{organization_id}/exercises/import",
    response_model=ScenarioCheck,
    dependencies=[Depends(verify_csrf)],
)
def exercise_from_file_endpoint(
    organization_id: uuid.UUID,
    response: Response,
    file: UploadFile = File(...),
    variables: str | None = Form(None, max_length=64_000),
    dry_run: bool = Query(True),
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ScenarioCheck:
    """A new exercise from a shared `.ttx.md` file -- or, with `dry_run`
    (the default), only check it."""
    require_planner(session, user, organization_id)
    values = _form_variables(variables)
    doc = library.read_upload(file)
    if isinstance(doc, ScenarioCheck):
        return localize_check(doc, locale)
    report = library.create_exercise(
        session, organization_id, doc, user, locale, dry_run=dry_run, variables=values
    )
    if report.ttx_id is not None:
        response.status_code = 201
    return localize_check(report, locale)
