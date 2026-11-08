import logging
import uuid
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.core import surface
from app.core.config import settings
from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.security import (
    RequireRecentAuthentication,
    get_current_user,
    require_instance_admin,
    verify_csrf,
)
from app.models import (
    Organization,
    OrganizationMembership,
    OrgRoleEnum,
    User,
    active_membership,
)
from app.schemas.instance import (
    AuditRetentionRead,
    AuditWebhookRead,
    AuditWebhookTestRead,
    AuditWebhookUpdateRequest,
    DomainOrganizationListResponse,
    DomainOrganizationRead,
    FreeEmailDomainCreateRequest,
    FreeEmailDomainListResponse,
    FreeEmailDomainRead,
    FreeEmailDomainUpdateRequest,
    InstanceAccountBulkOutcomeRead,
    InstanceAccountBulkRead,
    InstanceAccountBulkRequest,
    InstanceAccountCreateRead,
    InstanceAccountCreateRequest,
    InstanceAccountDeleteRequest,
    InstanceAccountDependencyRead,
    InstanceAccountDetailRead,
    InstanceAccountExerciseRead,
    InstanceAccountListResponse,
    InstanceAccountOrganizationRead,
    InstanceAccountPasswordResetRead,
    InstanceAccountRead,
    InstanceAccountSuspendRequest,
    InstanceAccountUpdateRequest,
    InstanceAdminGrantRequest,
    InstanceAdminListResponse,
    InstanceAdminRead,
    InstanceOrganizationCreateRequest,
    InstanceOrganizationListResponse,
    InstanceOrganizationRead,
    InstanceOrganizationUpdateRequest,
    InstancePolicyRead,
    InstanceProgramManagerGrantRequest,
    InstanceProgramManagerListResponse,
    InstanceProgramManagerRead,
    InstanceSettingsRead,
    InstanceSettingsUpdateRequest,
    MfaPolicyCounts,
    MfaPolicyFields,
    PasswordPolicyFields,
    PlatformAuditEventRead,
    PlatformAuditListResponse,
    SecurityPolicyRead,
    SecurityPolicyUpdateRequest,
)
from app.services import account_email_service, platform_audit_service, security_policy_service
from app.services.account_admin_service import (
    BULK_TYPED_CONFIRMATION,
    account_detail,
    bulk_action,
    create_account,
    delete_account,
    end_sessions,
    reset_password,
    reset_two_factor,
    update_profile,
)
from app.services.account_suspension_service import (
    AccountFilters,
    AccountSort,
    AccountStatus,
    get_account,
    list_accounts,
    organizations_of,
    reactivate_account,
    suspend_account,
)
from app.services.assistant import switch as assistant_switch
from app.services.instance_admin_service import (
    grant_instance_admin,
    list_instance_admins,
    require_web_grants,
    revoke_instance_admin,
)
from app.services.org_creation_security import (
    FreeEmailDomainEntry,
    add_free_email_domain,
    list_free_email_domains,
    remove_free_email_domain,
    set_builtin_free_email_domain_active,
)
from app.services.organization_service import (
    create_organization_for_program_manager,
    delete_organization,
    get_organization,
    grant_program_manager,
    list_program_managers,
    organizations_for_email_domain,
    revoke_program_manager,
    set_organization_domain,
)
from app.services.tenancy_service import (
    effective_policy,
    organization_count,
    self_service_founding_allowed,
    update_instance_settings,
)

router = APIRouter(prefix="/instance", tags=["instance"])


@router.get("/policy", response_model=InstancePolicyRead)
def policy_endpoint(session: Session = Depends(get_session)) -> InstancePolicyRead:
    """Public: the register screen reads it before anyone signs in."""
    email_links = account_email_service.available(session)
    password = security_policy_service.effective_password_policy(session)
    return InstancePolicyRead(
        tenancy_mode=effective_policy(session).mode,
        can_found_organization=self_service_founding_allowed(session) and not surface.is_public(),
        password_reset_available=email_links,
        email_invitations_available=email_links,
        password_min_length=password.min_length,
        password_reject_personal=password.reject_personal,
        assistant_enabled=assistant_switch.effective_enabled(session) and not surface.is_public(),
        surface=surface.current(),
    )


def _settings_read(session: Session) -> InstanceSettingsRead:
    policy = effective_policy(session)
    return InstanceSettingsRead(
        tenancy_mode=policy.mode,
        max_organizations=policy.max_organizations,
        pinned_by_env=policy.pinned_by_env,
        organization_count=organization_count(session),
    )


@router.get("/settings", response_model=InstanceSettingsRead)
def get_settings_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> InstanceSettingsRead:
    """The instance's tenancy rule and its settings."""
    return _settings_read(session)


@router.put(
    "/settings",
    response_model=InstanceSettingsRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def update_settings_endpoint(
    payload: InstanceSettingsUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceSettingsRead:
    """Change the tenancy rule. Needs a recent authentication."""
    before = effective_policy(session)
    update_instance_settings(session, admin, payload.tenancy_mode, payload.max_organizations)
    platform_audit_service.record(
        session,
        admin,
        "tenancy.update",
        "instance",
        details={
            "before": {"mode": before.mode, "max_organizations": before.max_organizations},
            "after": {"mode": payload.tenancy_mode, "max_organizations": payload.max_organizations},
        },
    )
    return _settings_read(session)


def _security_policy_read(session: Session) -> SecurityPolicyRead:
    password = security_policy_service.effective_password_policy(session)
    mfa = security_policy_service.effective_mfa_policy(session)
    return SecurityPolicyRead(
        password=PasswordPolicyFields(**asdict(password)),
        mfa=MfaPolicyFields(**asdict(mfa)),
        accounts_without_totp=MfaPolicyCounts(
            **security_policy_service.accounts_without_totp(session)
        ),
    )


@router.get("/security-policy", response_model=SecurityPolicyRead)
def get_security_policy_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> SecurityPolicyRead:
    """The instance's password and second-factor rules."""
    return _security_policy_read(session)


@router.put(
    "/security-policy",
    response_model=SecurityPolicyRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def update_security_policy_endpoint(
    payload: SecurityPolicyUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> SecurityPolicyRead:
    """Change the password and second-factor rules. Needs a recent authentication."""
    before, after = security_policy_service.update_security_policy(
        session,
        admin,
        security_policy_service.PasswordPolicy(**payload.password.model_dump()),
        security_policy_service.MfaPolicy(**payload.mfa.model_dump()),
    )
    platform_audit_service.record(
        session,
        admin,
        "security_policy.update",
        "instance",
        details={"before": before, "after": after},
    )
    return _security_policy_read(session)


def _free_email_domain_read(entry: FreeEmailDomainEntry) -> FreeEmailDomainRead:
    return FreeEmailDomainRead(domain=entry.domain, builtin=entry.builtin, active=entry.active)


@router.get("/free-email-domains", response_model=FreeEmailDomainListResponse)
def list_free_email_domains_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> FreeEmailDomainListResponse:
    """The domains treated as free email providers."""
    return FreeEmailDomainListResponse(
        items=[_free_email_domain_read(entry) for entry in list_free_email_domains(session)],
        applies=effective_policy(session).mode == "open",
    )


@router.post(
    "/free-email-domains",
    response_model=FreeEmailDomainRead,
    status_code=201,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def add_free_email_domain_endpoint(
    payload: FreeEmailDomainCreateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> FreeEmailDomainRead:
    """Add a domain to the free email domains."""
    entry = add_free_email_domain(session, payload.domain)
    platform_audit_service.record(
        session,
        admin,
        "free_email_domain.enable" if entry.builtin else "free_email_domain.add",
        "instance",
        target_label=entry.domain,
    )
    return _free_email_domain_read(entry)


@router.put(
    "/free-email-domains/{domain}",
    response_model=FreeEmailDomainRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def update_free_email_domain_endpoint(
    domain: str,
    payload: FreeEmailDomainUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> FreeEmailDomainRead:
    """Switches a built-in domain on or off."""
    entry = set_builtin_free_email_domain_active(session, domain, payload.active)
    platform_audit_service.record(
        session,
        admin,
        "free_email_domain.enable" if payload.active else "free_email_domain.disable",
        "instance",
        target_label=entry.domain,
    )
    return _free_email_domain_read(entry)


@router.delete(
    "/free-email-domains/{domain}",
    status_code=204,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def remove_free_email_domain_endpoint(
    domain: str,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> None:
    """Remove a domain from the free email domains."""
    remove_free_email_domain(session, domain)
    platform_audit_service.record(
        session, admin, "free_email_domain.remove", "instance", target_label=domain.strip().lower()
    )


def _organization_read(session: Session, organization: Organization) -> InstanceOrganizationRead:
    program_managers = session.exec(
        select(func.count())
        .select_from(OrganizationMembership)
        .where(
            OrganizationMembership.organization_id == organization.id,
            OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
            active_membership(),
        )
    ).one()
    return InstanceOrganizationRead(
        id=organization.id,
        name=organization.name,
        domain=organization.domain,
        program_manager_count=program_managers,
        created_at=organization.created_at,
    )


@router.get("/organizations", response_model=InstanceOrganizationListResponse)
def list_organizations_endpoint(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=200),
    sort_by: Literal["created_at", "name"] = Query("created_at"),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    _: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceOrganizationListResponse:
    """Every organization of the deployment (newest first by default);
    `q` matches its name or domain."""
    where_clause = []
    if q:
        pattern = f"%{q}%"
        where_clause.append(
            or_(Organization.name.ilike(pattern), Organization.domain.ilike(pattern))
        )
    column = Organization.name if sort_by == "name" else Organization.created_at
    order = column.asc() if sort_dir == "asc" else column.desc()
    total = session.exec(select(func.count()).select_from(Organization).where(*where_clause)).one()
    organizations = session.exec(
        select(Organization)
        .where(*where_clause)
        .order_by(order, Organization.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return InstanceOrganizationListResponse(
        items=[_organization_read(session, o) for o in organizations],
        total=total,
        limit=limit,
        offset=offset,
    )


# Creating and editing organizations from Platform skip the step-up on
# purpose (the user's call, like Users and roles); deleting one, which is
# irreversible, keeps it -- on top of its name typed in Platform.
@router.post(
    "/organizations",
    response_model=InstanceOrganizationRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_organization_endpoint(
    payload: InstanceOrganizationCreateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceOrganizationRead:
    """Create an organization, naming the account that will manage it."""
    organization = create_organization_for_program_manager(
        session, admin, payload.name, payload.program_manager_email
    )
    platform_audit_service.record(
        session,
        admin,
        "organization.create",
        "organization",
        organization.id,
        organization.name,
        {"program_manager": payload.program_manager_email.lower()},
    )
    return _organization_read(session, organization)


@router.patch(
    "/organizations/{organization_id}",
    response_model=InstanceOrganizationRead,
    dependencies=[Depends(verify_csrf)],
)
def update_organization_endpoint(
    organization_id: uuid.UUID,
    payload: InstanceOrganizationUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceOrganizationRead:
    """Change an organization from Platform."""
    before = get_organization(session, organization_id).domain
    organization = set_organization_domain(session, organization_id, payload.domain, admin.id)
    platform_audit_service.record(
        session,
        admin,
        "organization.domain",
        "organization",
        organization.id,
        organization.name,
        {"before": before, "after": organization.domain},
    )
    return _organization_read(session, organization)


@router.delete(
    "/organizations/{organization_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def delete_organization_endpoint(
    organization_id: uuid.UUID,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> None:
    # Its name goes into the log before the organization goes.
    """Delete an organization and everything in it. Needs a recent authentication."""
    name = get_organization(session, organization_id).name
    delete_organization(session, organization_id, admin.id)
    platform_audit_service.record(
        session, admin, "organization.delete", "organization", organization_id, name
    )


def _program_managers(
    session: Session, organization_id: uuid.UUID
) -> InstanceProgramManagerListResponse:
    return InstanceProgramManagerListResponse(
        items=[
            InstanceProgramManagerRead(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                disabled=membership.disabled_at is not None,
            )
            for membership, user in list_program_managers(session, organization_id)
        ]
    )


@router.get(
    "/organizations/{organization_id}/program-managers",
    response_model=InstanceProgramManagerListResponse,
)
def list_program_managers_endpoint(
    organization_id: uuid.UUID,
    _: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceProgramManagerListResponse:
    """An organization's Exercise Program Managers."""
    get_organization(session, organization_id)
    return _program_managers(session, organization_id)


@router.post(
    "/organizations/{organization_id}/program-managers",
    response_model=InstanceProgramManagerListResponse,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def grant_program_manager_endpoint(
    organization_id: uuid.UUID,
    payload: InstanceProgramManagerGrantRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceProgramManagerListResponse:
    """Same rules as in Users and roles: an existing account whose email
    domain the organization allows for Program Manager."""
    organization = get_organization(session, organization_id)
    _, target = grant_program_manager(session, organization_id, payload.email, admin.id)
    platform_audit_service.record(
        session,
        admin,
        "program_manager.grant",
        "organization",
        organization.id,
        organization.name,
        {"account": target.email},
    )
    return _program_managers(session, organization_id)


@router.delete(
    "/organizations/{organization_id}/program-managers/{user_id}",
    response_model=InstanceProgramManagerListResponse,
    dependencies=[Depends(verify_csrf)],
)
def revoke_program_manager_endpoint(
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceProgramManagerListResponse:
    """Never the last one (409 LAST_PROGRAM_MANAGER)."""
    organization = get_organization(session, organization_id)
    target = session.get(User, user_id)
    revoke_program_manager(session, organization_id, user_id, admin.id)
    platform_audit_service.record(
        session,
        admin,
        "program_manager.revoke",
        "organization",
        organization.id,
        organization.name,
        {"account": target.email if target else str(user_id)},
    )
    return _program_managers(session, organization_id)


def _account_read(user: User, organizations: list) -> InstanceAccountRead:
    return InstanceAccountRead(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        is_instance_admin=user.is_instance_admin,
        suspended_at=user.suspended_at,
        organizations=[
            InstanceAccountOrganizationRead(
                id=o.id,
                name=o.name,
                roles=o.roles,
                disabled=o.disabled,
                sole_program_manager=o.sole_program_manager,
            )
            for o in organizations
        ],
    )


@router.get("/accounts", response_model=InstanceAccountListResponse)
def list_accounts_endpoint(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=200),
    status: AccountStatus = Query("all"),
    organization: uuid.UUID | Literal["none"] | None = Query(None),
    role: OrgRoleEnum | None = Query(None),
    instance_admin: bool | None = Query(None),
    sort_by: AccountSort = Query("created_at"),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    _: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountListResponse:
    """Every active account of the deployment (newest first by default),
    with its organizations (whatever the tenancy mode). The filters
    combine: `status` (active, suspended), `organization` (an id, or
    `none`), `role` (held there, or anywhere) and `instance_admin`."""
    filters = AccountFilters(
        status=status, organization=organization, role=role, instance_admin=instance_admin
    )
    users, total = list_accounts(session, q, limit, offset, filters, sort_by, sort_dir)
    organizations = organizations_of(session, [u.id for u in users])
    return InstanceAccountListResponse(
        items=[_account_read(u, organizations.get(u.id, [])) for u in users],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/accounts",
    response_model=InstanceAccountCreateRead,
    status_code=201,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def create_account_endpoint(
    payload: InstanceAccountCreateRequest,
    response: Response,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountCreateRead:
    """A new account (name and email, unique) with a temporary password,
    in this answer only; whatever the tenancy rule. It starts with no
    organization: roles are granted from an organization's Admin, or the
    instance administrator grant from its page here."""
    response.headers["Cache-Control"] = "no-store"
    user, temporary = create_account(session, admin, str(payload.email), payload.full_name)
    return InstanceAccountCreateRead(user_id=user.id, temporary_password=temporary)


def _single_account_read(session: Session, user: User) -> InstanceAccountRead:
    return _account_read(user, organizations_of(session, [user.id]).get(user.id, []))


def _account_detail_read(session: Session, user: User, admin: User) -> InstanceAccountDetailRead:
    detail = account_detail(session, user)
    base = _account_read(user, detail.organizations)
    return InstanceAccountDetailRead(
        **base.model_dump(),
        totp_enabled=user.totp_enabled,
        email_mfa_enabled=user.email_mfa_enabled,
        backup_codes_remaining=detail.backup_codes_remaining,
        password_change_required=user.password_change_required,
        email_verified_at=user.email_verified_at,
        email_verification_pending=account_email_service.verification_pending(session, user),
        email_reconfirmation_overdue=account_email_service.reconfirmation_overdue(session, user),
        active_sessions=detail.active_sessions,
        exercises=[
            InstanceAccountExerciseRead(
                id=e.id,
                code=e.code,
                name=e.name,
                organization_id=e.organization_id,
                organization_name=e.organization_name,
                roles=e.roles,
                lead_evaluator=e.lead_evaluator,
                lead_planner=e.lead_planner,
            )
            for e in detail.exercises
        ],
        dependencies=[
            InstanceAccountDependencyRead(category=category, count=count)
            for category, count in sorted(detail.dependencies.items())
        ],
        is_self=user.id == admin.id,
    )


@router.post(
    "/accounts/bulk",
    response_model=InstanceAccountBulkRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def bulk_accounts_endpoint(
    payload: InstanceAccountBulkRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountBulkRead:
    """One action on several accounts (up to 100), each on its own: the
    ones refused are reported, not fatal. Suspending and deleting ask for
    the number of accounts typed to confirm."""
    if payload.action in BULK_TYPED_CONFIRMATION and payload.confirmation.strip() != str(
        len(set(payload.user_ids))
    ):
        raise AppException(
            "CONFIRMATION_MISMATCH",
            "Type the number of selected accounts exactly.",
            400,
            log_level=logging.WARNING,
        )
    outcomes = bulk_action(session, admin, payload.action, payload.user_ids)
    done = sum(1 for o in outcomes if o.code is None)
    return InstanceAccountBulkRead(
        done=done,
        skipped=len(outcomes) - done,
        results=[
            InstanceAccountBulkOutcomeRead(
                user_id=o.user_id, email=o.email, code=o.code, message=o.message
            )
            for o in outcomes
        ],
    )


@router.get("/accounts/{user_id}", response_model=InstanceAccountDetailRead)
def get_account_endpoint(
    user_id: uuid.UUID,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountDetailRead:
    """One account: who it is, where it works (organizations, exercises),
    its sign-in state and what keeps it from being deleted."""
    return _account_detail_read(session, get_account(session, user_id), admin)


@router.patch(
    "/accounts/{user_id}",
    response_model=InstanceAccountDetailRead,
    dependencies=[Depends(verify_csrf)],
)
def update_account_endpoint(
    user_id: uuid.UUID,
    payload: InstanceAccountUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountDetailRead:
    """Name and email (unique). Routine operator work: no step-up, like
    editing an organization; recorded with the before and after."""
    user = get_account(session, user_id)
    update_profile(session, admin, user, payload.full_name, payload.email)
    return _account_detail_read(session, user, admin)


@router.post(
    "/accounts/{user_id}/reset-password",
    response_model=InstanceAccountPasswordResetRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def reset_password_endpoint(
    user_id: uuid.UUID,
    response: Response,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountPasswordResetRead:
    """A temporary password, in this answer only: every session ends and
    the next sign-in asks for a new one."""
    response.headers["Cache-Control"] = "no-store"
    temporary = reset_password(session, admin, get_account(session, user_id))
    return InstanceAccountPasswordResetRead(temporary_password=temporary)


@router.post(
    "/accounts/{user_id}/reset-two-factor",
    response_model=InstanceAccountDetailRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def reset_two_factor_endpoint(
    user_id: uuid.UUID,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountDetailRead:
    """Clear an account's second factors so it can enroll again."""
    user = get_account(session, user_id)
    reset_two_factor(session, admin, user)
    return _account_detail_read(session, user, admin)


@router.post(
    "/accounts/{user_id}/end-sessions",
    response_model=InstanceAccountDetailRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def end_sessions_endpoint(
    user_id: uuid.UUID,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountDetailRead:
    """End every session of an account."""
    user = get_account(session, user_id)
    end_sessions(session, admin, user)
    return _account_detail_read(session, user, admin)


@router.delete(
    "/accounts/{user_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def delete_account_endpoint(
    user_id: uuid.UUID,
    payload: InstanceAccountDeleteRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> None:
    """For good, only an account that left no trace (409
    ACCOUNT_HAS_DEPENDENCIES otherwise: suspend it instead); its email
    typed to confirm."""
    user = get_account(session, user_id)
    if payload.confirmation.strip().lower() != user.email.lower():
        raise AppException(
            "CONFIRMATION_MISMATCH",
            "Type the account's email exactly.",
            400,
            log_level=logging.WARNING,
        )
    delete_account(session, admin, user)


@router.post(
    "/accounts/{user_id}/suspend",
    response_model=InstanceAccountRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def suspend_account_endpoint(
    user_id: uuid.UUID,
    payload: InstanceAccountSuspendRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountRead:
    """No sign-in and every session ended, on the whole deployment; the
    account's email typed to confirm. Never yourself, never the last
    instance administrator."""
    user = get_account(session, user_id)
    if payload.confirmation.strip().lower() != user.email.lower():
        raise AppException(
            "CONFIRMATION_MISMATCH",
            "Type the account's email exactly.",
            400,
            log_level=logging.WARNING,
        )
    # Already suspended: nothing happens, so nothing is recorded.
    changed = user.suspended_at is None
    suspend_account(session, user, admin.id)
    if changed:
        platform_audit_service.record(
            session, admin, "account.suspend", "account", user.id, user.email
        )
    return _single_account_read(session, user)


@router.post(
    "/accounts/{user_id}/reactivate",
    response_model=InstanceAccountRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def reactivate_account_endpoint(
    user_id: uuid.UUID,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAccountRead:
    """Lift an account's suspension. Needs a recent authentication."""
    user = get_account(session, user_id)
    changed = user.suspended_at is not None
    reactivate_account(session, user, admin.id)
    if changed:
        platform_audit_service.record(
            session, admin, "account.reactivate", "account", user.id, user.email
        )
    return _single_account_read(session, user)


def _admins(session: Session) -> InstanceAdminListResponse:
    return InstanceAdminListResponse(
        items=[
            InstanceAdminRead(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                created_at=user.created_at,
                last_login_at=user.last_login_at,
                suspended_at=user.suspended_at,
            )
            for user in list_instance_admins(session)
        ],
        web_grants_enabled=settings.INSTANCE_ADMIN_WEB_GRANTS,
    )


@router.get("/admins", response_model=InstanceAdminListResponse)
def list_admins_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> InstanceAdminListResponse:
    """The instance administrators."""
    return _admins(session)


@router.post(
    "/admins",
    response_model=InstanceAdminListResponse,
    status_code=201,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def grant_admin_endpoint(
    payload: InstanceAdminGrantRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAdminListResponse:
    """An existing, active, unsuspended account, its email typed to
    confirm -- it sees every account of the deployment once it enrolls
    TOTP. 409 INSTANCE_ADMIN_WEB_GRANTS_DISABLED when the deployment leaves
    it to the console."""
    require_web_grants()
    user = get_account(session, payload.user_id)
    if payload.confirmation.strip().lower() != user.email.lower():
        raise AppException(
            "CONFIRMATION_MISMATCH",
            "Type the account's email exactly.",
            400,
            log_level=logging.WARNING,
        )
    grant_instance_admin(session, user, admin)
    return _admins(session)


@router.delete(
    "/admins/{user_id}",
    response_model=InstanceAdminListResponse,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def revoke_admin_endpoint(
    user_id: uuid.UUID,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> InstanceAdminListResponse:
    """Yourself included while another active one remains (409
    LAST_INSTANCE_ADMIN otherwise)."""
    require_web_grants()
    revoke_instance_admin(session, get_account(session, user_id), admin)
    return _admins(session)


@router.get("/audit", response_model=PlatformAuditListResponse)
def list_audit_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None, max_length=48),
    q: str | None = Query(None, max_length=200),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    _: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> PlatformAuditListResponse:
    """Platform's activity log, newest first by default; `q` matches who
    acted or what was acted on."""
    events, total = platform_audit_service.list_events(session, limit, offset, action, q, sort_dir)
    return PlatformAuditListResponse(
        items=[PlatformAuditEventRead.model_validate(e, from_attributes=True) for e in events],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/audit/export", dependencies=[RequireRecentAuthentication])
def export_audit_endpoint(
    format: Literal["jsonl", "csv"] = Query("jsonl"),
    action: str | None = Query(None, max_length=48),
    q: str | None = Query(None, max_length=200),
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> Response:
    """The activity log (same filters as the list), oldest first: JSON
    Lines for a log shipper, or CSV. It names accounts, so it asks for a
    recent sign-in -- and is itself recorded."""
    if format == "csv":
        body = platform_audit_service.export_csv(session, action, q)
        media_type = "text/csv; charset=utf-8"
    else:
        body = platform_audit_service.export_jsonl(session, action, q)
        media_type = "application/x-ndjson; charset=utf-8"
    platform_audit_service.record(
        session,
        admin,
        "audit.export",
        "instance",
        details={"format": format, "action": action, "q": q},
    )
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return Response(
        body,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="platform_activity_{stamp}.{format}"',
            "Cache-Control": "private, no-store",
        },
    )


def _webhook_read(session: Session) -> AuditWebhookRead:
    webhook = platform_audit_service.get_webhook(session)
    allow_http = settings.AUDIT_WEBHOOK_ALLOW_HTTP
    if webhook is None:
        return AuditWebhookRead(configured=False, allow_http=allow_http)
    return AuditWebhookRead(
        configured=True,
        url=webhook.url,
        enabled=webhook.enabled,
        secret=platform_audit_service.readable_secret(webhook),
        has_authorization=webhook.authorization_encrypted is not None,
        pending=platform_audit_service.pending_count(session),
        last_success_at=webhook.last_success_at,
        last_failure_at=webhook.last_failure_at,
        last_status=webhook.last_status,
        last_error=webhook.last_error,
        allow_http=allow_http,
    )


@router.get("/audit/retention", response_model=AuditRetentionRead)
def get_retention_endpoint(_: User = Depends(require_instance_admin)) -> AuditRetentionRead:
    """How long this log keeps its events (fixed), and how the server's log
    files are capped (.env, read-only here)."""
    return AuditRetentionRead(
        days=platform_audit_service.RETENTION_DAYS,
        log_file_max_mb=settings.LOG_FILE_MAX_MB,
        log_file_backups=settings.LOG_FILE_BACKUPS,
    )


@router.get("/audit/webhook", response_model=AuditWebhookRead)
def get_webhook_endpoint(
    _: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> AuditWebhookRead:
    """The activity log's SIEM forwarding settings."""
    return _webhook_read(session)


@router.put(
    "/audit/webhook",
    response_model=AuditWebhookRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def save_webhook_endpoint(
    payload: AuditWebhookUpdateRequest,
    admin: User = Depends(require_instance_admin),
    session: Session = Depends(get_session),
) -> AuditWebhookRead:
    """Where the log goes: every event from now on is forwarded (the ones
    before can be exported). Recorded, with step-up -- it sends account
    emails out of the deployment."""
    platform_audit_service.save_webhook(
        session,
        admin,
        payload.url,
        payload.enabled,
        payload.authorization or None,
        clear_authorization=payload.authorization == "",
    )
    return _webhook_read(session)


@router.post(
    "/audit/webhook/rotate-secret",
    response_model=AuditWebhookRead,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def rotate_webhook_secret_endpoint(
    admin: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> AuditWebhookRead:
    """Replace the SIEM webhook's signing secret."""
    platform_audit_service.rotate_webhook_secret(session, admin)
    return _webhook_read(session)


@router.delete(
    "/audit/webhook",
    status_code=204,
    dependencies=[Depends(verify_csrf), RequireRecentAuthentication],
)
def delete_webhook_endpoint(
    admin: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> None:
    """Remove the activity log's SIEM forwarding."""
    platform_audit_service.delete_webhook(session, admin)


@router.post(
    "/audit/webhook/test",
    response_model=AuditWebhookTestRead,
    dependencies=[Depends(verify_csrf)],
)
def test_webhook_endpoint(
    admin: User = Depends(require_instance_admin), session: Session = Depends(get_session)
) -> AuditWebhookTestRead:
    """Sends one synthetic event now and says how the collector answered."""
    status, error = platform_audit_service.send_test(session, admin)
    return AuditWebhookTestRead(ok=error is None, status=status, error=error)


@router.get("/domain-organizations", response_model=DomainOrganizationListResponse)
def domain_organizations_endpoint(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> DomainOrganizationListResponse:
    """The Waiting Room's "your organization": where the caller's email
    domain is allowed. Empty in "open" mode -- there anyone can found an
    organization claiming any domain, so it would leak names."""
    if effective_policy(session).mode == "open":
        return DomainOrganizationListResponse(items=[])
    return DomainOrganizationListResponse(
        items=[
            DomainOrganizationRead(id=o.id, name=o.name)
            for o in organizations_for_email_domain(session, user.email)
        ]
    )
