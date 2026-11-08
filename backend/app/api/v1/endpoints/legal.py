from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import (
    RequireRecentAuthentication,
    get_current_user,
    require_instance_admin,
    verify_csrf,
)
from app.models import LegalDocumentKind, LegalDocumentVersion, User
from app.schemas.legal import (
    LegalAcceptanceListResponse,
    LegalAcceptanceRead,
    LegalAcceptRequest,
    LegalDocumentAdminListResponse,
    LegalDocumentAdminRead,
    LegalDocumentListResponse,
    LegalDocumentRead,
    LegalDocumentSummary,
    LegalDraftRead,
    LegalDraftUpdateRequest,
    LegalPublishRequest,
    LegalTemplateListResponse,
    LegalTemplateRead,
    LegalTemplateRequest,
    LegalVersionRead,
    LegalVersionSummary,
)
from app.services import legal_service, platform_audit_service

router = APIRouter(prefix="/legal", tags=["legal"])
accept_router = APIRouter(prefix="/auth/legal", tags=["legal"])
admin_router = APIRouter(prefix="/instance/legal", tags=["legal"])


@router.get("", response_model=LegalDocumentListResponse)
def list_documents_endpoint(session: Session = Depends(get_session)) -> LegalDocumentListResponse:
    """Public: the register screen reads it before anyone signs in."""
    latest = legal_service.latest_versions(session)
    return LegalDocumentListResponse(
        items=[
            LegalDocumentSummary(
                kind=kind,
                version=latest[kind].version,
                published_at=latest[kind].published_at,
                languages=legal_service.languages_of(latest[kind].content),
            )
            for kind in LegalDocumentKind
            if kind in latest
        ]
    )


@router.get("/{kind}", response_model=LegalDocumentRead)
def read_document_endpoint(
    kind: LegalDocumentKind,
    lang: str | None = Query(default=None, max_length=8),
    session: Session = Depends(get_session),
) -> LegalDocumentRead:
    """Public: the latest published version, in `lang` when it exists."""
    version = legal_service.latest_version(session, kind)
    language, available, content = legal_service.document_text(version, lang)
    return LegalDocumentRead(
        kind=kind,
        version=version.version,
        published_at=version.published_at,
        language=language,
        requested_language_available=available,
        content=content,
    )


@accept_router.post("/accept", status_code=204, dependencies=[Depends(verify_csrf)])
def accept_endpoint(
    payload: LegalAcceptRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Record the caller's acceptance of the current legal documents."""
    legal_service.accept_pending(session, user, payload.acceptances)


@accept_router.get("/acceptances", response_model=LegalAcceptanceListResponse)
def my_acceptances_endpoint(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> LegalAcceptanceListResponse:
    """What this account accepted, newest first (Preferences -> Privacy)."""
    return LegalAcceptanceListResponse(
        items=[
            LegalAcceptanceRead(kind=a.kind, version=a.version, accepted_at=a.accepted_at)
            for a in legal_service.acceptances_of(session, user)
        ]
    )


def _published_by(session: Session, version: LegalDocumentVersion) -> str | None:
    author = (
        session.get(User, version.published_by_user_id) if version.published_by_user_id else None
    )
    return author.full_name if author else None


def _admin_read(session: Session, kind: LegalDocumentKind) -> LegalDocumentAdminRead:
    draft = legal_service.get_draft(session, kind)
    versions = legal_service.list_versions(session, kind)
    return LegalDocumentAdminRead(
        kind=kind,
        draft=LegalDraftRead(
            content=dict(draft.content) if draft else {},
            updated_at=draft.updated_at if draft else None,
        ),
        has_unpublished_changes=legal_service.has_unpublished_changes(
            draft, versions[0] if versions else None
        ),
        versions=[
            LegalVersionSummary(
                version=version.version,
                published_at=version.published_at,
                published_by=_published_by(session, version),
                requires_acceptance=version.requires_acceptance,
                languages=legal_service.languages_of(version.content),
            )
            for version in versions
        ],
    )


@admin_router.get("", response_model=LegalDocumentAdminListResponse)
def admin_list_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> LegalDocumentAdminListResponse:
    """Every legal document with its draft and published versions."""
    return LegalDocumentAdminListResponse(
        items=[_admin_read(session, kind) for kind in LegalDocumentKind]
    )


@admin_router.get("/acceptances.csv", dependencies=[RequireRecentAuthentication])
def acceptance_record_endpoint(
    admin: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> Response:
    """The acceptance record of every account, for an audit. It names
    every account, so it needs a recent authentication -- and goes into
    Platform's activity log."""
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    record = legal_service.acceptance_record_csv(session)
    platform_audit_service.record(session, admin, "legal.acceptances_export", "legal")
    return Response(
        record,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="legal_acceptances_{stamp}.csv"',
            "Cache-Control": "private, no-store",
        },
    )


@admin_router.put(
    "/{kind}/draft", response_model=LegalDocumentAdminRead, dependencies=[Depends(verify_csrf)]
)
def save_draft_endpoint(
    kind: LegalDocumentKind,
    payload: LegalDraftUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> LegalDocumentAdminRead:
    """Save a legal document's draft."""
    legal_service.save_draft(session, admin, kind, payload.content)
    return _admin_read(session, kind)


@admin_router.post(
    "/{kind}/publish",
    response_model=LegalDocumentAdminRead,
    status_code=201,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def publish_endpoint(
    kind: LegalDocumentKind,
    payload: LegalPublishRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> LegalDocumentAdminRead:
    """Publish a legal document's draft as a new version."""
    version = legal_service.publish(session, admin, kind, payload.requires_acceptance)
    platform_audit_service.record(
        session,
        admin,
        "legal.publish",
        "legal",
        target_label=kind.value,
        details={"version": version.version, "requires_acceptance": version.requires_acceptance},
    )
    return _admin_read(session, kind)


@admin_router.get("/{kind}/versions/{version}", response_model=LegalVersionRead)
def read_version_endpoint(
    kind: LegalDocumentKind,
    version: int,
    _: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> LegalVersionRead:
    """One published version of a legal document."""
    found = legal_service.get_version(session, kind, version)
    return LegalVersionRead(
        version=found.version,
        published_at=found.published_at,
        published_by=_published_by(session, found),
        requires_acceptance=found.requires_acceptance,
        content=dict(found.content),
    )


@admin_router.post(
    "/templates", response_model=LegalTemplateListResponse, dependencies=[Depends(verify_csrf)]
)
def templates_endpoint(
    payload: LegalTemplateRequest,
    _: User = Depends(require_instance_admin),
) -> LegalTemplateListResponse:
    """The shipped templates with the operator's details written in. Saves
    nothing: Platform puts them in the draft for the operator to edit."""
    rendered = legal_service.render_templates(payload)
    return LegalTemplateListResponse(
        items=[LegalTemplateRead(kind=kind, content=content) for kind, content in rendered.items()]
    )
