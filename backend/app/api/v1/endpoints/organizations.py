import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from sqlmodel import Session

from app.core import surface
from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.i18n import get_locale
from app.core.security import (
    client_address,
    get_current_user,
    require_planner,
    require_program_manager,
    start_session,
    verify_csrf,
)
from app.models import Organization, OrgRoleEnum, User
from app.schemas.dashboard import OrganizationDashboardRead, PlannerOverviewRead
from app.schemas.library_usage import LibraryDeleteResult, LibraryUsage
from app.schemas.organization import (
    AllowedDomainTagAssignmentRequest,
    DomainAccountListResponse,
    DomainAccountRead,
    LeaveCandidateRead,
    LeaveExerciseRead,
    OrganizationAllowedDomainCreateRequest,
    OrganizationAllowedDomainListResponse,
    OrganizationAllowedDomainRead,
    OrganizationAllowedDomainUpdateRequest,
    OrganizationDeleteRequest,
    OrganizationFoundRequest,
    OrganizationLeavePreviewRead,
    OrganizationLeaveRequest,
    OrganizationProfileUpdateRequest,
    OrganizationRead,
    OrganizationSignupRequest,
    OrganizationSignupResponse,
    OrganizationSummaryListResponse,
    OrgMemberDeleteResponse,
    OrgMemberExerciseListResponse,
    OrgMemberExerciseRead,
    OrgMemberListResponse,
    OrgMemberRead,
    OrgMemberTagsRequest,
    PlannerGrantRequest,
    PlannerListResponse,
    PlannerRead,
    PlannerTagAssignmentRequest,
    ProgramManagerGrantRequest,
    ProgramManagerListResponse,
    ProgramManagerRead,
)
from app.schemas.organization_tag import (
    OrganizationTagApplyRequest,
    OrganizationTagCreateRequest,
    OrganizationTagListResponse,
    OrganizationTagRead,
    OrganizationTagUpdateRequest,
)
from app.services import account_email_service, legal_service, platform_audit_service
from app.services.actor_library_service import require_library_manager, require_library_reader
from app.services.auth_service import record_signup
from app.services.dashboard_service import (
    get_organization_dashboard,
    get_planner_overview,
)
from app.services.library_usage_service import (
    delete_or_disable,
    enable,
    get_item,
    usage,
    usage_counts,
)
from app.services.login_throttle_service import guarded_signup
from app.services.organization_logo_service import clear_logo, logo_url, upload_logo
from app.services.organization_service import (
    add_allowed_domain,
    create_organization_for_user,
    create_organization_with_program_manager,
    delete_member,
    delete_organization,
    domain_accounts_without_role,
    enable_member,
    get_organization,
    grant_member_role,
    grant_program_manager,
    leave_organization,
    leave_preview,
    list_allowed_domains_paginated,
    list_member_role,
    list_org_members,
    list_program_managers,
    list_tags_for_allowed_domains,
    list_tags_for_planner_memberships,
    list_user_organizations,
    member_exercise_accesses,
    remove_allowed_domain,
    revoke_member_role,
    revoke_program_manager,
    set_allowed_domain_tags,
    set_member_role_tags,
    set_member_tags,
    set_program_manager_tags,
    update_allowed_domain_scopes,
    update_organization_profile,
)
from app.services.organization_tag_service import (
    create_organization_tag,
    delete_organization_tag,
    list_organization_tags_paginated,
    set_organization_tags_applied,
    update_organization_tag,
)
from app.services.tenancy_service import effective_policy

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _organization_read(organization: Organization) -> OrganizationRead:
    return OrganizationRead(
        id=organization.id,
        name=organization.name,
        domain=organization.domain,
        alias=organization.alias,
        tax_id=organization.tax_id,
        subscription_tier=organization.subscription_tier,
        description=organization.description,
        logo_url=logo_url(organization),
        created_at=organization.created_at,
    )


@router.post("", response_model=OrganizationSignupResponse, status_code=201)
def signup(
    payload: OrganizationSignupRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    locale: str = Depends(get_locale),
) -> OrganizationSignupResponse:
    """Create an account together with its organization."""
    legal_service.require_signup_acceptance(session, payload.accepted_legal)
    with guarded_signup(session, payload.admin.email, client_address(request)):
        organization, user = create_organization_with_program_manager(session, payload)
    legal_service.record_signup_acceptance(session, user, payload.accepted_legal)
    account_email_service.start_verification(session, user, locale)
    record_signup(session, user, "organization")
    start_session(request, response, session, user)
    return OrganizationSignupResponse(organization=_organization_read(organization), user=user)


@router.post(
    "/mine",
    response_model=OrganizationRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def found_organization_endpoint(
    payload: OrganizationFoundRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationRead:
    """Found an organization with the signed-in account (no step-up;
    audited)."""
    organization = create_organization_for_user(session, user, payload.name)
    platform_audit_service.record(
        session, user, "organization.create", "organization", organization.id, organization.name
    )
    return _organization_read(organization)


def _member_read(membership, target, tags) -> PlannerRead:
    return PlannerRead(
        user_id=target.id,
        email=target.email,
        full_name=target.full_name,
        granted_at=membership.created_at,
        last_login_at=target.last_login_at,
        tags=[OrganizationTagRead.model_validate(tag) for tag in tags],
    )


@router.get("/mine", response_model=OrganizationSummaryListResponse)
def list_my_organizations_endpoint(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationSummaryListResponse:
    """The organizations the caller belongs to."""
    items = list_user_organizations(session, user)
    if surface.is_public():
        # The Players' face: the organizations of the exercises the caller
        # plays, as a Player sees them (no organization role).
        from app.models import TTXContextRole
        from app.services.ttx_service import list_ttx_for_user

        played, _, _ = list_ttx_for_user(session, user, 200, 0, role=TTXContextRole.PLAYER)
        orgs = {ttx.organization_id for ttx in played}
        items = [
            item.model_copy(
                update={
                    "is_program_manager": False,
                    "is_planner": False,
                    "is_observer": False,
                    "is_evaluator": False,
                }
            )
            for item in items
            if item.organization_id in orgs
        ]
    return OrganizationSummaryListResponse(items=items)


def _list_members(
    role: OrgRoleEnum,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"],
    sort_by: Literal["created_at", "name", "last_login"],
    q: str | None,
    organization_id: uuid.UUID,
    session: Session,
) -> PlannerListResponse:
    rows, total = list_member_role(
        session, organization_id, role, limit, offset, sort_dir, sort_by, q
    )
    tags_by_membership = list_tags_for_planner_memberships(
        session, [membership.id for membership, _ in rows]
    )
    return PlannerListResponse(
        items=[
            _member_read(membership, user, tags_by_membership.get(membership.id, []))
            for membership, user in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


def _allowed_domain_read(entry, tags) -> OrganizationAllowedDomainRead:
    return OrganizationAllowedDomainRead(
        id=entry.id,
        domain=entry.domain,
        allows_program_manager=entry.allows_program_manager,
        allows_planner=entry.allows_planner,
        created_at=entry.created_at,
        tags=[OrganizationTagRead.model_validate(tag) for tag in tags],
    )


def _list_allowed_domains(
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"],
    sort_by: Literal["created_at", "name"],
    q: str | None,
    organization_id: uuid.UUID,
    session: Session,
) -> OrganizationAllowedDomainListResponse:
    rows, total = list_allowed_domains_paginated(
        session, organization_id, limit, offset, sort_dir, sort_by, q
    )
    tags_by_domain = list_tags_for_allowed_domains(session, [row.id for row in rows])
    return OrganizationAllowedDomainListResponse(
        items=[_allowed_domain_read(row, tags_by_domain.get(row.id, [])) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


def _add_allowed_domain(
    payload: OrganizationAllowedDomainCreateRequest,
    organization_id: uuid.UUID,
    session: Session,
) -> OrganizationAllowedDomainRead:
    entry = add_allowed_domain(
        session,
        organization_id,
        payload.domain,
        payload.allows_program_manager,
        payload.allows_planner,
    )
    return _allowed_domain_read(entry, [])


def _audit_allowed_domain(
    session: Session,
    user: User,
    organization_id: uuid.UUID,
    op: str,
    domain: str,
    allows_program_manager: bool | None = None,
    allows_planner: bool | None = None,
) -> None:
    """Allowed domains change without a step-up: the activity log records it."""
    details: dict = {"op": op, "domain": domain}
    if allows_program_manager is not None:
        details["allows_program_manager"] = allows_program_manager
    if allows_planner is not None:
        details["allows_planner"] = allows_planner
    platform_audit_service.record(
        session,
        user,
        "organization.allowed_domain",
        "organization",
        organization_id,
        get_organization(session, organization_id).name,
        details,
    )


def _set_allowed_domain_tags(
    domain_id: int,
    payload: AllowedDomainTagAssignmentRequest,
    organization_id: uuid.UUID,
    session: Session,
) -> OrganizationAllowedDomainRead:
    entry, tags = set_allowed_domain_tags(session, organization_id, domain_id, payload.tag_ids)
    return _allowed_domain_read(entry, tags)


def _program_manager_read(membership, target, tags) -> ProgramManagerRead:
    return ProgramManagerRead(
        user_id=target.id,
        email=target.email,
        full_name=target.full_name,
        granted_at=membership.created_at,
        last_login_at=target.last_login_at,
        tags=[OrganizationTagRead.model_validate(tag) for tag in tags],
    )


def require_program_manager_of(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> uuid.UUID:
    """Guard for every /organizations/{organization_id}/... Admin route: the
    org comes from the URL -- whatever the caller selected in the context
    bar -- and is checked against the caller's own Program Manager membership
    (BOLA-safe). The server never infers which organization a Program Manager
    means; there are no "current organization" routes."""
    require_program_manager(session, user, organization_id)
    return organization_id


@router.get("/{organization_id}/domain-accounts", response_model=DomainAccountListResponse)
def domain_accounts_endpoint(
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> DomainAccountListResponse:
    """Accounts from the organization's allowed domains with no role in it
    yet. Only where founding is controlled ("single"/"managed"): in "open"
    anyone can found an organization and allow any domain, so listing its
    accounts would leak them."""
    if effective_policy(session).mode == "open":
        return DomainAccountListResponse(items=[])
    return DomainAccountListResponse(
        items=[
            DomainAccountRead(
                user_id=u.id,
                email=u.email,
                full_name=u.full_name,
                created_at=u.created_at,
                last_login_at=u.last_login_at,
            )
            for u in domain_accounts_without_role(session, organization_id)
        ]
    )


# Org grants managed from Admin -> Users and roles (Planners, Observers,
# Evaluators): one route set per role, same shape -- paginated list, grant
# by email, revoke, tags. Program Managers have their own routes below
# ("never zero"; no step-up anywhere in Users and roles -- a typed name
# confirms removals in the UI).


def _register_member_routes(segment: str, role: OrgRoleEnum) -> None:
    @router.get(f"/{{organization_id}}/{segment}", response_model=PlannerListResponse)
    def list_members_endpoint(
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        sort_dir: Literal["asc", "desc"] = Query("desc"),
        sort_by: Literal["created_at", "name", "last_login"] = Query("created_at"),
        q: str | None = Query(None, max_length=200),
        organization_id: uuid.UUID = Depends(require_program_manager_of),
        session: Session = Depends(get_session),
    ) -> PlannerListResponse:
        """The organization's members holding this role."""
        return _list_members(role, limit, offset, sort_dir, sort_by, q, organization_id, session)

    @router.post(
        f"/{{organization_id}}/{segment}",
        response_model=PlannerRead,
        status_code=201,
        dependencies=[Depends(verify_csrf)],
    )
    def grant_member_endpoint(
        payload: PlannerGrantRequest,
        organization_id: uuid.UUID = Depends(require_program_manager_of),
        session: Session = Depends(get_session),
    ) -> PlannerRead:
        """Grant this organization role to a person."""
        membership, target = grant_member_role(session, organization_id, payload.email, role)
        return _member_read(membership, target, [])

    @router.delete(
        f"/{{organization_id}}/{segment}/{{user_id}}",
        status_code=204,
        dependencies=[Depends(verify_csrf)],
    )
    def revoke_member_endpoint(
        user_id: uuid.UUID,
        organization_id: uuid.UUID = Depends(require_program_manager_of),
        session: Session = Depends(get_session),
    ) -> None:
        """Take this organization role away from a member."""
        revoke_member_role(session, organization_id, user_id, role)

    @router.put(
        f"/{{organization_id}}/{segment}/{{user_id}}/tags",
        response_model=PlannerRead,
        dependencies=[Depends(verify_csrf)],
    )
    def set_member_tags_endpoint(
        user_id: uuid.UUID,
        payload: PlannerTagAssignmentRequest,
        organization_id: uuid.UUID = Depends(require_program_manager_of),
        session: Session = Depends(get_session),
    ) -> PlannerRead:
        """Set a member's tags for this organization role."""
        membership, target, tags = set_member_role_tags(
            session, organization_id, user_id, role, payload.tag_ids
        )
        return _member_read(membership, target, tags)


@router.get("/{organization_id}/members", response_model=OrgMemberListResponse)
def list_org_members_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    sort_by: Literal["created_at", "name", "last_login"] = Query("created_at"),
    q: str | None = Query(None, max_length=200),
    role: OrgRoleEnum | None = Query(None),
    status: Literal["active", "disabled"] | None = Query(None),
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> OrgMemberListResponse:
    """Admin -> Users and roles: one row per person, every grant they hold
    (granted and revoked through each role's own routes)."""
    rows, total, counts = list_org_members(
        session, organization_id, limit, offset, sort_dir, sort_by, q, role, status
    )
    tags_by_membership = list_tags_for_planner_memberships(
        session, [m.id for _, _, memberships in rows for m in memberships]
    )
    items = []
    for user, granted_at, memberships in rows:
        tags = {tag.id: tag for m in memberships for tag in tags_by_membership.get(m.id, [])}
        items.append(
            OrgMemberRead(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                granted_at=granted_at,
                last_login_at=user.last_login_at,
                roles=[m.role.value for m in memberships],
                disabled=any(m.disabled_at is not None for m in memberships),
                tags=[OrganizationTagRead.model_validate(tag) for tag in tags.values()],
            )
        )
    return OrgMemberListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        role_counts={member_role.value: count for member_role, count in counts.items()},
    )


@router.put(
    "/{organization_id}/members/{user_id}/tags",
    response_model=list[OrganizationTagRead],
    dependencies=[Depends(verify_csrf)],
)
def set_org_member_tags_endpoint(
    user_id: uuid.UUID,
    payload: OrgMemberTagsRequest,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> list[OrganizationTagRead]:
    """Set a member's tags."""
    _, tags = set_member_tags(session, organization_id, user_id, payload.tag_ids)
    return [OrganizationTagRead.model_validate(tag) for tag in tags]


@router.get(
    "/{organization_id}/members/{user_id}/exercises",
    response_model=OrgMemberExerciseListResponse,
)
def list_org_member_exercises_endpoint(
    user_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> OrgMemberExerciseListResponse:
    """What revoking a role or deleting the person would touch."""
    items = []
    for access, ttx in member_exercise_accesses(session, organization_id, user_id):
        items.append(
            OrgMemberExerciseRead(
                ttx_id=ttx.id,
                code=ttx.code,
                name=ttx.name,
                role=access.role.value,
                plans=access.plans,
                controls=access.controls,
                facilitates=access.facilitates,
                evaluates=access.evaluates,
                observes=access.observes,
                is_lead=ttx.lead_planner_id == user_id,
            )
        )
    return OrgMemberExerciseListResponse(items=items)


@router.delete(
    "/{organization_id}/members/{user_id}",
    response_model=OrgMemberDeleteResponse,
    dependencies=[Depends(verify_csrf)],
)
def delete_org_member_endpoint(
    user_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrgMemberDeleteResponse:
    """Delete a member, or disable them while they're on an exercise."""
    status, exercises = delete_member(session, organization_id, user_id, user.id)
    return OrgMemberDeleteResponse(status=status, exercises=exercises)


@router.post(
    "/{organization_id}/members/{user_id}/enable",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def enable_org_member_endpoint(
    user_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> None:
    """Enable a disabled member again."""
    enable_member(session, organization_id, user_id)


_register_member_routes("planners", OrgRoleEnum.PLANNER)
_register_member_routes("observers", OrgRoleEnum.OBSERVER)
_register_member_routes("evaluators", OrgRoleEnum.EVALUATOR)


@router.get(
    "/{organization_id}/allowed-domains", response_model=OrganizationAllowedDomainListResponse
)
def list_allowed_domains_by_id_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    sort_by: Literal["created_at", "name"] = Query("created_at"),
    q: str | None = Query(None, max_length=200),
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> OrganizationAllowedDomainListResponse:
    """The organization's allowed domains."""
    return _list_allowed_domains(limit, offset, sort_dir, sort_by, q, organization_id, session)


@router.post(
    "/{organization_id}/allowed-domains",
    response_model=OrganizationAllowedDomainRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def add_allowed_domain_by_id_endpoint(
    payload: OrganizationAllowedDomainCreateRequest,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationAllowedDomainRead:
    """Add an allowed domain."""
    added = _add_allowed_domain(payload, organization_id, session)
    _audit_allowed_domain(
        session,
        user,
        organization_id,
        "add",
        added.domain,
        payload.allows_program_manager,
        payload.allows_planner,
    )
    return added


@router.delete(
    "/{organization_id}/allowed-domains/{domain_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def remove_allowed_domain_by_id_endpoint(
    domain_id: int,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Remove an allowed domain."""
    domain = remove_allowed_domain(session, organization_id, domain_id)
    _audit_allowed_domain(session, user, organization_id, "remove", domain)


@router.patch(
    "/{organization_id}/allowed-domains/{domain_id}",
    response_model=OrganizationAllowedDomainRead,
    dependencies=[Depends(verify_csrf)],
)
def update_allowed_domain_by_id_endpoint(
    domain_id: int,
    payload: OrganizationAllowedDomainUpdateRequest,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationAllowedDomainRead:
    """Change an allowed domain."""
    entry = update_allowed_domain_scopes(
        session,
        organization_id,
        domain_id,
        payload.allows_program_manager,
        payload.allows_planner,
    )
    _audit_allowed_domain(
        session,
        user,
        organization_id,
        "update",
        entry.domain,
        payload.allows_program_manager,
        payload.allows_planner,
    )
    tags = list_tags_for_allowed_domains(session, [entry.id]).get(entry.id, [])
    return _allowed_domain_read(entry, tags)


@router.put(
    "/{organization_id}/allowed-domains/{domain_id}/tags",
    response_model=OrganizationAllowedDomainRead,
    dependencies=[Depends(verify_csrf)],
)
def set_allowed_domain_tags_by_id_endpoint(
    domain_id: int,
    payload: AllowedDomainTagAssignmentRequest,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> OrganizationAllowedDomainRead:
    """Set the tags given to people joining through an allowed domain."""
    return _set_allowed_domain_tags(domain_id, payload, organization_id, session)


@router.get("/{organization_id}/program-managers", response_model=ProgramManagerListResponse)
def list_program_managers_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProgramManagerListResponse:
    """The organization's Exercise Program Managers."""
    require_program_manager(session, user, organization_id)
    rows = list_program_managers(session, organization_id)
    tags_by_membership = list_tags_for_planner_memberships(
        session, [membership.id for membership, _ in rows]
    )
    return ProgramManagerListResponse(
        items=[
            _program_manager_read(membership, target, tags_by_membership.get(membership.id, []))
            for membership, target in rows
        ]
    )


@router.post(
    "/{organization_id}/program-managers",
    response_model=ProgramManagerRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def grant_program_manager_endpoint(
    organization_id: uuid.UUID,
    payload: ProgramManagerGrantRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProgramManagerRead:
    """Grant the Exercise Program Manager role to a person."""
    require_program_manager(session, user, organization_id)
    membership, target = grant_program_manager(session, organization_id, payload.email, user.id)
    return _program_manager_read(membership, target, [])


@router.delete(
    "/{organization_id}/program-managers/{user_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def revoke_program_manager_endpoint(
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Take the Exercise Program Manager role away from a member."""
    require_program_manager(session, user, organization_id)
    revoke_program_manager(session, organization_id, user_id, user.id)


@router.put(
    "/{organization_id}/program-managers/{user_id}/tags",
    response_model=ProgramManagerRead,
    dependencies=[Depends(verify_csrf)],
)
def set_program_manager_tags_endpoint(
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: PlannerTagAssignmentRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProgramManagerRead:
    """Set an Exercise Program Manager's tags."""
    require_program_manager(session, user, organization_id)
    membership, target, tags = set_program_manager_tags(
        session, organization_id, user_id, payload.tag_ids
    )
    return _program_manager_read(membership, target, tags)


@router.get("/{organization_id}/dashboard", response_model=OrganizationDashboardRead)
def get_organization_dashboard_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationDashboardRead:
    """Read-only aggregates for Admin's per-organization dashboard.
    Explicit org id, checked against the caller's own Program Manager
    membership (BOLA-safe, same as GET /organizations/{organization_id})."""
    require_program_manager(session, user, organization_id)
    return get_organization_dashboard(session, organization_id)


@router.get("/{organization_id}/planner-overview", response_model=PlannerOverviewRead)
def get_planner_overview_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PlannerOverviewRead:
    """Creator's organization-wide exercise counts for a Planner of
    this organization (org-scoped Planner membership, TOTP enforced)."""
    require_planner(session, user, organization_id)
    return get_planner_overview(session, organization_id, user)


@router.get("/{organization_id}", response_model=OrganizationRead)
def get_organization_by_id_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationRead:
    """BOLA-safe like every explicit-id route here: the id comes from the
    URL, but access is still checked against the caller's own membership,
    never assumed."""
    require_program_manager(session, user, organization_id)
    return _organization_read(get_organization(session, organization_id))


@router.patch(
    "/{organization_id}", response_model=OrganizationRead, dependencies=[Depends(verify_csrf)]
)
def update_organization_by_id_endpoint(
    organization_id: uuid.UUID,
    payload: OrganizationProfileUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationRead:
    """Change the organization's profile."""
    require_program_manager(session, user, organization_id)
    organization = update_organization_profile(
        session,
        organization_id,
        payload.description,
        payload.tax_id,
        payload.alias,
        name=payload.name,
    )
    return _organization_read(organization)


@router.post(
    "/{organization_id}/logo",
    response_model=OrganizationRead,
    dependencies=[Depends(verify_csrf)],
)
def upload_organization_logo_by_id_endpoint(
    organization_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationRead:
    """Upload the organization's logo."""
    require_program_manager(session, user, organization_id)
    organization = get_organization(session, organization_id)
    upload_logo(session, organization, file)
    return _organization_read(organization)


@router.delete(
    "/{organization_id}/logo",
    response_model=OrganizationRead,
    dependencies=[Depends(verify_csrf)],
)
def clear_organization_logo_by_id_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationRead:
    """Remove the organization's logo."""
    require_program_manager(session, user, organization_id)
    organization = get_organization(session, organization_id)
    clear_logo(session, organization)
    return _organization_read(organization)


def _leave_candidate(user: User) -> LeaveCandidateRead:
    return LeaveCandidateRead(user_id=user.id, full_name=user.full_name, email=user.email)


@router.get("/{organization_id}/leave-preview", response_model=OrganizationLeavePreviewRead)
def leave_preview_endpoint(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationLeavePreviewRead:
    """Any member of the organization, about themselves (Preferences ->
    Privacy -> Leave the organization)."""
    organization = get_organization(session, organization_id)
    preview = leave_preview(session, organization_id, user)
    return OrganizationLeavePreviewRead(
        organization_name=organization.name,
        is_program_manager=preview.is_program_manager,
        is_last_program_manager=preview.is_last_program_manager,
        program_manager_candidates=[
            _leave_candidate(c) for c in preview.program_manager_candidates
        ],
        exercises=[
            LeaveExerciseRead(
                ttx_id=e.ttx.id,
                ttx_code=e.ttx.code,
                ttx_name=e.ttx.name,
                seats=e.seats,
                blocked=e.blocked,
                lead_candidates=[_leave_candidate(c) for c in e.lead_candidates],
            )
            for e in preview.exercises
        ],
    )


@router.post(
    "/{organization_id}/leave",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def leave_organization_endpoint(
    organization_id: uuid.UUID,
    payload: OrganizationLeaveRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Leave the organization yourself -- irreversible (the organization's
    name typed; audited, no step-up); no Program Manager guard, anyone with
    a grant there leaves."""
    name = get_organization(session, organization_id).name
    leave_organization(
        session,
        organization_id,
        user,
        payload.confirmation,
        payload.program_manager_successor_id,
        payload.lead_successors,
    )
    platform_audit_service.record(
        session,
        user,
        "organization.leave",
        "organization",
        organization_id,
        name,
        {
            "program_manager_successor_id": (
                str(payload.program_manager_successor_id)
                if payload.program_manager_successor_id
                else None
            ),
            "lead_successors": {str(k): str(v) for k, v in payload.lead_successors.items()},
        },
    )


@router.delete(
    "/{organization_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def delete_organization_endpoint(
    organization_id: uuid.UUID,
    payload: OrganizationDeleteRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Delete the organization and everything in it, with its name typed
    (no step-up; the activity log records it)."""
    require_program_manager(session, user, organization_id)
    name = get_organization(session, organization_id).name
    if payload.confirmation.strip() != name.strip():
        raise AppException(
            "CONFIRMATION_MISMATCH",
            "Type the organization's name exactly.",
            400,
            log_level=logging.WARNING,
        )
    delete_organization(session, organization_id, user.id)
    platform_audit_service.record(
        session, user, "organization.delete", "organization", organization_id, name
    )


@router.get("/{organization_id}/tags", response_model=OrganizationTagListResponse)
def list_organization_tags_by_id_endpoint(
    organization_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    sort_by: Literal["created_at", "name"] = Query("created_at"),
    q: str | None = Query(None, max_length=200),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationTagListResponse:
    """The organization level of the tag library: its Program Managers and
    Exercise Planners manage it (applying tags stays Program Manager-only)."""
    require_library_reader(session, user, organization_id)
    rows, total = list_organization_tags_paginated(
        session, organization_id, limit, offset, sort_dir, sort_by, q
    )
    counts = usage_counts(session, "tag", organization_id)
    return OrganizationTagListResponse(
        items=[
            OrganizationTagRead.model_validate(row).model_copy(
                update={"usage_count": counts.get(str(row.id), 0)}
            )
            for row in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/{organization_id}/tags",
    response_model=OrganizationTagRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_organization_tag_by_id_endpoint(
    organization_id: uuid.UUID,
    payload: OrganizationTagCreateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationTagRead:
    """The organization level of the tag library: its Program Managers and
    Exercise Planners manage it (applying tags stays Program Manager-only)."""
    require_library_manager(session, user, organization_id)
    tag = create_organization_tag(
        session, organization_id, payload.name, payload.color, payload.custom_hex, origin=payload
    )
    return OrganizationTagRead.model_validate(tag)


@router.patch(
    "/{organization_id}/tags/{tag_id}",
    response_model=OrganizationTagRead,
    dependencies=[Depends(verify_csrf)],
)
def update_organization_tag_by_id_endpoint(
    organization_id: uuid.UUID,
    tag_id: uuid.UUID,
    payload: OrganizationTagUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationTagRead:
    """The organization level of the tag library: its Program Managers and
    Exercise Planners manage it (applying tags stays Program Manager-only)."""
    require_library_manager(session, user, organization_id)
    tag = update_organization_tag(
        session, organization_id, tag_id, payload.name, payload.color, payload.custom_hex
    )
    return OrganizationTagRead.model_validate(tag)


@router.delete(
    "/{organization_id}/tags/{tag_id}",
    response_model=LibraryDeleteResult,
    dependencies=[Depends(verify_csrf)],
)
def delete_organization_tag_by_id_endpoint(
    organization_id: uuid.UUID,
    tag_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryDeleteResult:
    """Delete it for good when nothing uses it -- no exercise copy, not
    applied to the organization, its members or its allowed domains --
    after a recent sign-in; otherwise disable it and say what uses it."""
    require_library_manager(session, user, organization_id)
    tag = get_item(session, "tag", organization_id, tag_id)
    return delete_or_disable(
        session,
        "tag",
        tag,
        user,
        lambda: delete_organization_tag(session, organization_id, tag_id),
    )


@router.get("/{organization_id}/tags/{tag_id}/usage", response_model=LibraryUsage)
def organization_tag_usage_endpoint(
    organization_id: uuid.UUID,
    tag_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LibraryUsage:
    """What deleting it would affect (asked before confirming)."""
    require_library_manager(session, user, organization_id)
    return usage(session, "tag", get_item(session, "tag", organization_id, tag_id))


@router.post(
    "/{organization_id}/tags/{tag_id}/enable",
    response_model=OrganizationTagRead,
    dependencies=[Depends(verify_csrf)],
)
def enable_organization_tag_endpoint(
    organization_id: uuid.UUID,
    tag_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationTagRead:
    """Undo a disable: it can be copied and applied again."""
    require_library_manager(session, user, organization_id)
    tag = get_item(session, "tag", organization_id, tag_id)
    enable(session, tag)
    return OrganizationTagRead.model_validate(tag)


@router.put(
    "/{organization_id}/tags/apply",
    response_model=OrganizationTagListResponse,
    dependencies=[Depends(verify_csrf)],
)
def set_organization_tags_applied_endpoint(
    organization_id: uuid.UUID,
    payload: OrganizationTagApplyRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrganizationTagListResponse:
    """Full-replace which of this org's own tags are applied to the
    Organization itself -- a tag's mere existence doesn't imply it's
    applied (see OrganizationTag's own docstring); this is the explicit
    step that does. Returns the org's whole tag pool (applied and
    unapplied) so AdminOrganizationProfileSection can refresh its local
    state in one response."""
    require_program_manager(session, user, organization_id)
    tags = set_organization_tags_applied(session, organization_id, payload.tag_ids)
    return OrganizationTagListResponse(
        items=[OrganizationTagRead.model_validate(tag) for tag in tags],
        total=len(tags),
        limit=len(tags),
        offset=0,
    )
