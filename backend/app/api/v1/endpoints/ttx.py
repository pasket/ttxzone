import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlmodel import Session, select

from app.core import surface
from app.core.db import get_session
from app.core.i18n import get_locale
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    is_program_manager,
    require_planner,
    require_program_manager,
    require_ttx_role,
    verify_csrf,
)
from app.models import (
    TTX,
    InvitationToken,
    MselStatus,
    RoleEnum,
    TTXAccess,
    TTXContextRole,
    TTXNeedsForm,
    User,
)
from app.schemas.dashboard import TTXDashboardRead
from app.schemas.invitation_token import (
    InvitationTokenAuditListResponse,
    InvitationTokenAuditRead,
    InvitationTokenCreateRequest,
    InvitationTokenCreateResponse,
)
from app.schemas.ttx import (
    LeadPlannerRead,
    TTXAttentionRead,
    TTXCreateRequest,
    TTXDeleteRequest,
    TTXDuplicateRequest,
    TTXDuplicateResponse,
    TTXListResponse,
    TTXRead,
    TTXUpdateRequest,
)
from app.schemas.ttx_access_request import TTXAccessRequestListResponse, TTXAccessRequestRead
from app.schemas.ttx_planning_team import (
    PlanningTeamAddRequest,
    PlanningTeamCandidate,
    PlanningTeamCandidateListResponse,
    PlanningTeamFunctionsRequest,
    PlanningTeamLeadRequest,
    PlanningTeamListResponse,
    PlanningTeamMemberRead,
    PlanningTeamTagAssignmentRequest,
)
from app.schemas.ttx_tag import TTXTagAssignmentRequest, TTXTagRead
from app.services import platform_audit_service
from app.services.attention_service import attention
from app.services.dashboard_service import get_ttx_dashboard
from app.services.invitation_token_service import (
    create_invitation_token,
    list_invitation_tokens_for_ttx,
)
from app.services.organization_service import list_allowed_domains
from app.services.ttx_access_request_service import (
    approve_access_request,
    list_pending_access_requests_for_ttx,
    reject_access_request,
)
from app.services.ttx_image_service import clear_image, image_url, upload_image
from app.services.ttx_msel_service import find_msel, msel_statuses
from app.services.ttx_needs_form_service import form_statuses, get_form
from app.services.ttx_planning_team_service import (
    add_planning_team_member,
    lead_planners,
    lead_user_id,
    list_candidates,
    list_planning_team,
    list_tags_for_accesses,
    remove_planning_team_member,
    set_lead_planner,
    set_planning_team_member_functions,
    set_planning_team_member_tags,
)
from app.services.ttx_service import (
    can_delete_ttx,
    create_ttx,
    delete_ttx,
    duplicate_ttx,
    list_ttx_for_user,
    set_archived,
    unenroll_from_ttx,
    update_ttx,
)
from app.services.ttx_tag_service import (
    list_tags_for_invitation_tokens,
    list_tags_for_ttxs,
    set_ttx_tags,
)

router = APIRouter(prefix="/ttx", tags=["ttx"])


@router.post("", response_model=TTXRead, status_code=201, dependencies=[Depends(verify_csrf)])
def create_ttx_endpoint(
    payload: TTXCreateRequest,
    locale: str = Depends(get_locale),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXRead:
    # A user can be Planner of more than one org, so unlike the old
    # single-org auto-resolve, the org is explicit in the payload and
    # validated here rather than guessed.
    """Create an exercise; the caller becomes its Lead Planner."""
    require_planner(session, user, payload.organization_id)
    ttx = create_ttx(session, payload.organization_id, user, payload, locale)
    return _ttx_read(session, ttx, user)


@router.get("", response_model=TTXListResponse)
def list_ttx_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    sort_by: Literal["created_at", "name"] = Query("created_at"),
    q: str | None = Query(None, max_length=200),
    organization_id: uuid.UUID | None = Query(None),
    role: TTXContextRole | None = Query(None),
    archived: bool | None = Query(None),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXListResponse:
    """The exercises the caller can reach."""
    if surface.is_public():
        # The Players' face lists only the exercises its caller plays.
        role = TTXContextRole.PLAYER
    items, access_map, total = list_ttx_for_user(
        session, user, limit, offset, sort_dir, sort_by, q, organization_id, role, archived
    )
    ttx_ids = [ttx.id for ttx in items]
    tags_by_ttx = list_tags_for_ttxs(session, ttx_ids)
    forms = form_statuses(session, ttx_ids)
    msels = msel_statuses(session, ttx_ids)
    leads = lead_planners(session, ttx_ids)
    managed = {
        org_id
        for org_id in {ttx.organization_id for ttx in items}
        if is_program_manager(session, user, org_id)
    }

    def deletable(ttx: TTX) -> bool:
        access = access_map.get(ttx.id)
        return ttx.organization_id in managed or (
            ttx.lead_planner_id == user.id
            and access is not None
            and access.role == RoleEnum.PLANNER
            and access.plans
        )

    return TTXListResponse(
        items=[
            _build_ttx_read(
                ttx,
                access_map.get(ttx.id),
                tags_by_ttx.get(ttx.id, []),
                forms[ttx.id],
                msels.get(ttx.id),
                leads.get(ttx.id),
                deletable(ttx),
            )
            for ttx in items
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete("/{ttx_id}/access", status_code=204, dependencies=[Depends(verify_csrf)])
def unenroll_from_ttx_endpoint(
    ttx_id: uuid.UUID,
    lead_successor_id: uuid.UUID | None = Query(None),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Self-service leave -- no role guard: any caller can only ever remove
    their own TTXAccess row (keyed off their own user id), so there's no
    BOLA surface here regardless of role.
    """
    unenroll_from_ttx(session, user, ttx_id, lead_successor_id)


def _build_ttx_read(
    ttx: TTX,
    access: TTXAccess | None,
    tags,
    form: TTXNeedsForm,
    msel_status: MselStatus | None,
    lead: User | None = None,
    can_delete: bool = False,
) -> TTXRead:
    """`access` is the caller's grant on the exercise; None means they see
    it through Program Manager org-wide visibility only."""
    return TTXRead(
        id=ttx.id,
        code=ttx.code,
        name=ttx.name,
        description=ttx.description,
        content_language=ttx.content_language,
        organization_id=ttx.organization_id,
        created_by_id=ttx.created_by_id,
        created_at=ttx.created_at,
        role=access.role.value if access else "program_manager",
        plans=access.plans if access else False,
        controls=access.controls if access else False,
        facilitates=access.facilitates if access else False,
        evaluates=access.evaluates if access else False,
        observes=access.observes if access else False,
        image_url=image_url(ttx),
        tags=[TTXTagRead.model_validate(t) for t in tags],
        needs_form_status=form.status,
        tlp=form.tlp,
        msel_status=msel_status,
        lead_planner=LeadPlannerRead(user_id=lead.id, full_name=lead.full_name) if lead else None,
        can_delete=can_delete,
        archived_at=ttx.archived_at,
    )


def _ttx_read(session: Session, ttx: TTX, user: User) -> TTXRead:
    """The caller's view after a change -- their own grant (only a team
    member gets past a write guard; a Program Manager without one reads
    it, see _build_ttx_read)."""
    tags = list_tags_for_ttxs(session, [ttx.id]).get(ttx.id, [])
    msel = find_msel(session, ttx.id)
    access = session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == user.id)
    ).first()
    return _build_ttx_read(
        ttx,
        access,
        tags,
        get_form(session, ttx.id),
        msel.status if msel else None,
        lead_planners(session, [ttx.id]).get(ttx.id),
        can_delete_ttx(session, user, ttx, access),
    )


@router.delete(
    "/{ttx_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def delete_ttx_endpoint(
    ttx_id: uuid.UUID,
    payload: TTXDeleteRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Delete the exercise and everything under it, for good: its Lead
    Planner or a Program Manager of its organization, with its name typed
    (no step-up; the activity log records it). The one write a Program Manager makes on an
    exercise without a seat on its team (oversight of the portfolio), so
    it is guarded here rather than by RequiresOrgAndTTXAccess."""
    ttx = session.get(TTX, ttx_id)
    if ttx is None:
        raise HTTPException(status_code=404, detail="TTX not found.")
    if is_program_manager(session, user, ttx.organization_id):
        require_program_manager(session, user, ttx.organization_id)
    else:
        require_ttx_role(session, user, ttx, (RoleEnum.PLANNER,))
    label = f"{ttx.code} {ttx.name}"
    ttx_id, organization_id = ttx.id, ttx.organization_id
    delete_ttx(session, ttx, user, payload.confirmation)
    platform_audit_service.record(
        session,
        user,
        "exercise.delete",
        "exercise",
        ttx_id,
        label[:320],
        {"organization_id": str(organization_id)},
    )


def _archive(ttx_id: uuid.UUID, user: User, session: Session, archived: bool) -> TTXRead:
    """Like the delete: its Lead Planner or a Program Manager of its
    organization, guarded here (the Program Manager has no seat, and the
    exercise may already be archived)."""
    ttx = session.get(TTX, ttx_id)
    if ttx is None:
        raise HTTPException(status_code=404, detail="TTX not found.")
    if is_program_manager(session, user, ttx.organization_id):
        require_program_manager(session, user, ttx.organization_id)
    else:
        require_ttx_role(session, user, ttx, (RoleEnum.PLANNER,))
    return _ttx_read(session, set_archived(session, ttx, user, archived), user)


@router.post("/{ttx_id}/archive", response_model=TTXRead, dependencies=[Depends(verify_csrf)])
def archive_ttx_endpoint(
    ttx_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXRead:
    """Read-only and out of the default lists, until it's unarchived."""
    return _archive(ttx_id, user, session, True)


@router.post("/{ttx_id}/unarchive", response_model=TTXRead, dependencies=[Depends(verify_csrf)])
def unarchive_ttx_endpoint(
    ttx_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXRead:
    """Bring an archived exercise back."""
    return _archive(ttx_id, user, session, False)


@router.patch(
    "/{ttx_id}",
    response_model=TTXRead,
    dependencies=[Depends(verify_csrf)],
)
def update_ttx_endpoint(
    payload: TTXUpdateRequest,
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXRead:
    """Change the exercise's details."""
    ttx = update_ttx(session, ttx, payload)
    return _ttx_read(session, ttx, user)


@router.post(
    "/{ttx_id}/duplicate",
    response_model=TTXDuplicateResponse,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def duplicate_ttx_endpoint(
    payload: TTXDuplicateRequest,
    locale: str = Depends(get_locale),
    # An archived exercise is what's usually run again.
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER, allow_archived=True)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXDuplicateResponse:
    """A new exercise with this one's design and team: a Planner of it who
    may also create exercises in its organization."""
    if payload.organization_id != ttx.organization_id:
        raise HTTPException(status_code=404, detail="TTX not found.")
    require_planner(session, user, ttx.organization_id)
    copy, skipped = duplicate_ttx(session, ttx, user, payload.name, locale)
    return TTXDuplicateResponse(ttx=_ttx_read(session, copy, user), skipped_members=skipped)


@router.get("/{ttx_id}/dashboard", response_model=TTXDashboardRead)
def get_ttx_dashboard_endpoint(
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    session: Session = Depends(get_session),
) -> TTXDashboardRead:
    """Read-only aggregates for Creator's per-exercise dashboard. Same
    guard as every other exercise-management route: Planner of this
    exercise, or Program Manager of its organization."""
    return get_ttx_dashboard(session, ttx)


@router.post(
    "/{ttx_id}/image",
    response_model=TTXRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def upload_ttx_image_endpoint(
    file: UploadFile = File(...),
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXRead:
    """Upload the exercise's image."""
    upload_image(session, ttx, file)
    return _ttx_read(session, ttx, user)


@router.delete(
    "/{ttx_id}/image",
    response_model=TTXRead,
    dependencies=[Depends(verify_csrf)],
)
def clear_ttx_image_endpoint(
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXRead:
    """Remove the exercise's image."""
    clear_image(session, ttx)
    return _ttx_read(session, ttx, user)


@router.put("/{ttx_id}/tags/apply", response_model=TTXRead, dependencies=[Depends(verify_csrf)])
def set_ttx_tags_endpoint(
    payload: TTXTagAssignmentRequest,
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXRead:
    """Full-replace which of the exercise's own tags it carries (the same
    `/apply` shape as the organization's)."""
    set_ttx_tags(session, ttx, payload.tag_ids)
    return _ttx_read(session, ttx, user)


@router.post(
    "/{ttx_id}/invitation-tokens",
    response_model=InvitationTokenCreateResponse,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_invitation_token_endpoint(
    payload: InvitationTokenCreateRequest,
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> InvitationTokenCreateResponse:
    """Create an invitation token for the exercise."""
    invitation_token = create_invitation_token(session, ttx, user, payload)
    return InvitationTokenCreateResponse(
        id=invitation_token.id,
        ttx_id=invitation_token.ttx_id,
        role=invitation_token.role,
        description=invitation_token.description,
        expires_at=invitation_token.expires_at,
        max_uses=invitation_token.max_uses,
        created_at=invitation_token.created_at,
        token=invitation_token.token,
    )


@router.get("/{ttx_id}/invitation-tokens", response_model=InvitationTokenAuditListResponse)
def list_invitation_tokens_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    sort_by: Literal["created_at", "name"] = Query("created_at"),
    q: str | None = Query(None, max_length=200),
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    session: Session = Depends(get_session),
) -> InvitationTokenAuditListResponse:
    """The exercise's invitation tokens."""
    items, redemptions_by_token, total = list_invitation_tokens_for_ttx(
        session, ttx.id, limit, offset, sort_dir, sort_by, q
    )
    tags_by_token = list_tags_for_invitation_tokens(session, [token.id for token in items])
    return InvitationTokenAuditListResponse(
        items=[
            InvitationTokenAuditRead(
                id=token.id,
                ttx_id=token.ttx_id,
                role=token.role,
                description=token.description,
                token=token.token,
                expires_at=token.expires_at,
                max_uses=token.max_uses,
                redemption_count=token.redemption_count,
                revoked_at=token.revoked_at,
                created_at=token.created_at,
                created_by_id=token.created_by_id,
                redemptions=redemptions_by_token.get(token.id, []),
                tags=[TTXTagRead.model_validate(t) for t in tags_by_token.get(token.id, [])],
            )
            for token in items
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


def _is_allowed_domain(role: RoleEnum, user: User, allowed_domains: frozenset[str]) -> bool:
    # Only Planner-role requests are domain-gated (default-deny, mirrors
    # organization_service.is_email_domain_allowed); Player requests
    # are always approvable.
    if role != RoleEnum.PLANNER:
        return True
    return user.email.rsplit("@", 1)[-1].lower() in allowed_domains


def _org_allowed_domains(session: Session, organization_id: uuid.UUID) -> frozenset[str]:
    # Only Planner-role requests are domain-gated, so only Planner
    # domains count here.
    return frozenset(d.domain for d in list_allowed_domains(session, organization_id, "planner"))


def _access_request_read(
    request, user, token, allowed_domains: frozenset[str]
) -> TTXAccessRequestRead:
    return TTXAccessRequestRead(
        id=request.id,
        ttx_id=request.ttx_id,
        role=request.role,
        token_description=token.description,
        status=request.status,
        user=user,
        created_at=request.created_at,
        is_allowed_domain=_is_allowed_domain(request.role, user, allowed_domains),
    )


@router.get("/{ttx_id}/access-requests", response_model=TTXAccessRequestListResponse)
def list_access_requests_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    sort_by: Literal["created_at", "name"] = Query("created_at"),
    q: str | None = Query(None, max_length=200),
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    session: Session = Depends(get_session),
) -> TTXAccessRequestListResponse:
    """The Players' pending requests to join the exercise."""
    rows, total = list_pending_access_requests_for_ttx(
        session, ttx.id, limit, offset, sort_dir, sort_by, q
    )
    allowed_domains = _org_allowed_domains(session, ttx.organization_id)
    return TTXAccessRequestListResponse(
        items=[
            _access_request_read(request, user, token, allowed_domains)
            for request, user, token in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/{ttx_id}/access-requests/{request_id}/approve",
    response_model=TTXAccessRequestRead,
    dependencies=[Depends(verify_csrf)],
)
def approve_access_request_endpoint(
    request_id: uuid.UUID,
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXAccessRequestRead:
    """Approve a request to join the exercise."""
    request = approve_access_request(session, ttx, user, request_id)
    token = session.get(InvitationToken, request.invitation_token_id)
    requester = session.get(User, request.user_id)
    allowed_domains = _org_allowed_domains(session, ttx.organization_id)
    return _access_request_read(request, requester, token, allowed_domains)


@router.post(
    "/{ttx_id}/access-requests/{request_id}/reject",
    response_model=TTXAccessRequestRead,
    dependencies=[Depends(verify_csrf)],
)
def reject_access_request_endpoint(
    request_id: uuid.UUID,
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXAccessRequestRead:
    """Reject a request to join the exercise."""
    request = reject_access_request(session, ttx, user, request_id)
    token = session.get(InvitationToken, request.invitation_token_id)
    requester = session.get(User, request.user_id)
    allowed_domains = _org_allowed_domains(session, ttx.organization_id)
    return _access_request_read(request, requester, token, allowed_domains)


# planning team (Creator -> Settings -> planning team), called
# `/planning-team` in the API:
# the exercise's planning and control team, added directly from the
# organization's declared Planners -- see ttx_planning_team_service.


def _planning_team_member_read(access, user, tags, is_lead: bool = False) -> PlanningTeamMemberRead:
    return PlanningTeamMemberRead(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        added_at=access.created_at,
        last_login_at=user.last_login_at,
        tags=[TTXTagRead.model_validate(tag) for tag in tags],
        is_lead=is_lead,
        plans=access.plans,
        controls=access.controls,
        facilitates=access.facilitates,
    )


def _planning_team_response(session: Session, ttx: TTX, rows) -> PlanningTeamListResponse:
    tags_by_access = list_tags_for_accesses(session, [access.id for access, _ in rows])
    lead = lead_user_id(ttx, rows)
    return PlanningTeamListResponse(
        items=[
            _planning_team_member_read(
                access, user, tags_by_access.get(access.id, []), is_lead=user.id == lead
            )
            for access, user in rows
        ]
    )


@router.get("/{ttx_id}/planning-team", response_model=PlanningTeamListResponse)
def list_planning_team_endpoint(
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    session: Session = Depends(get_session),
) -> PlanningTeamListResponse:
    """The exercise's planning and control team."""
    return _planning_team_response(session, ttx, list_planning_team(session, ttx))


@router.put(
    "/{ttx_id}/planning-team/lead",
    response_model=PlanningTeamListResponse,
    dependencies=[Depends(verify_csrf)],
)
def set_lead_planner_endpoint(
    payload: PlanningTeamLeadRequest,
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PlanningTeamListResponse:
    """Make one member the Lead Planner; answers the whole team, since
    the previous lead changes too."""
    return _planning_team_response(
        session, ttx, set_lead_planner(session, ttx, payload.user_id, user.id)
    )


@router.get("/{ttx_id}/planning-team/candidates", response_model=PlanningTeamCandidateListResponse)
def list_planning_team_candidates_endpoint(
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    session: Session = Depends(get_session),
) -> PlanningTeamCandidateListResponse:
    """Who can join the planning and control team."""
    return PlanningTeamCandidateListResponse(
        items=[
            PlanningTeamCandidate(user_id=u.id, email=u.email, full_name=u.full_name)
            for u in list_candidates(session, ttx)
        ]
    )


@router.post(
    "/{ttx_id}/planning-team",
    response_model=PlanningTeamMemberRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def add_planning_team_member_endpoint(
    payload: PlanningTeamAddRequest,
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PlanningTeamMemberRead:
    """Add a member to the planning and control team."""
    access, target = add_planning_team_member(
        session,
        ttx,
        payload.email,
        user.id,
        plans=payload.plans,
        controls=payload.controls,
        facilitates=payload.facilitates,
    )
    return _planning_team_member_read(access, target, [])


@router.put(
    "/{ttx_id}/planning-team/{user_id}/functions",
    response_model=PlanningTeamListResponse,
    dependencies=[Depends(verify_csrf)],
)
def set_planning_team_member_functions_endpoint(
    user_id: uuid.UUID,
    payload: PlanningTeamFunctionsRequest,
    # Required when the Lead Planner stops planning: who takes over.
    lead_successor_id: uuid.UUID | None = Query(None),
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PlanningTeamListResponse:
    """Planner / Controller / Facilitator of one member; answers the whole
    team, since the lead can change too."""
    set_planning_team_member_functions(
        session,
        ttx,
        user_id,
        payload.plans,
        payload.controls,
        payload.facilitates,
        user.id,
        lead_successor_id,
    )
    return _planning_team_response(session, ttx, list_planning_team(session, ttx))


@router.delete(
    "/{ttx_id}/planning-team/{user_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def remove_planning_team_member_endpoint(
    user_id: uuid.UUID,
    # Required when removing the Lead Planner: who takes over.
    lead_successor_id: uuid.UUID | None = Query(None),
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Remove a member from the planning and control team."""
    remove_planning_team_member(session, ttx, user_id, user.id, lead_successor_id)


@router.put(
    "/{ttx_id}/planning-team/{user_id}/tags",
    response_model=PlanningTeamMemberRead,
    dependencies=[Depends(verify_csrf)],
)
def set_planning_team_member_tags_endpoint(
    user_id: uuid.UUID,
    payload: PlanningTeamTagAssignmentRequest,
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    session: Session = Depends(get_session),
) -> PlanningTeamMemberRead:
    """Set a team member's tags."""
    access, target, tags = set_planning_team_member_tags(session, ttx, user_id, payload.tag_ids)
    is_lead = lead_user_id(ttx, list_planning_team(session, ttx)) == target.id
    return _planning_team_member_read(access, target, tags, is_lead=is_lead)


@router.get("/{ttx_id}/attention", response_model=TTXAttentionRead)
def ttx_attention_endpoint(
    ttx: TTX = Depends(RequiresOrgAndTTXAccess(RoleEnum.PLANNER)),
    session: Session = Depends(get_session),
) -> TTXAttentionRead:
    """How many validation issues keep each of the exercise's documents
    from moving on, for the Creator menu."""
    return attention(session, ttx)
