import logging
import uuid

import pytest
from fastapi import HTTPException
from sqlmodel import Session
from starlette.requests import Request

from app.core.exceptions import AppException
from app.core.security import RequiresOrgAndTTXAccess
from app.models import (
    TTX,
    Organization,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    User,
)


def _seed_user(db_session: Session, email: str) -> User:
    user = User(email=email, hashed_password="unused", full_name="Test User")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _seed_org(db_session: Session, name: str) -> Organization:
    org = Organization(name=name)
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


def _seed_ttx(db_session: Session, organization_id: uuid.UUID, creator_id: uuid.UUID) -> TTX:
    ttx = TTX(name="Ransomware Drill", organization_id=organization_id, created_by_id=creator_id)
    db_session.add(ttx)
    db_session.commit()
    db_session.refresh(ttx)
    return ttx


def _grant_ttx_access(
    db_session: Session, user_id: uuid.UUID, ttx_id: uuid.UUID, role: RoleEnum
) -> None:
    db_session.add(
        TTXAccess(user_id=user_id, ttx_id=ttx_id, role=role, plans=role == RoleEnum.PLANNER)
    )
    db_session.commit()


def _grant_program_manager(
    db_session: Session, user_id: uuid.UUID, organization_id: uuid.UUID
) -> None:
    db_session.add(
        OrganizationMembership(
            user_id=user_id, organization_id=organization_id, role=OrgRoleEnum.PROGRAM_MANAGER
        )
    )
    db_session.commit()


def _fake_request(ttx_id: object, method: str = "POST") -> Request:
    return Request(scope={"type": "http", "method": method, "path_params": {"ttx_id": ttx_id}})


def test_matching_ttx_access_role_succeeds(db_session: Session) -> None:
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner@acme.com")
    ttx = _seed_ttx(db_session, org.id, owner.id)
    admin = _seed_user(db_session, "admin@acme.com")
    admin.totp_enabled = True
    db_session.add(admin)
    db_session.commit()
    _grant_ttx_access(db_session, admin.id, ttx.id, RoleEnum.PLANNER)

    result = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(
        _fake_request(str(ttx.id)), admin, db_session
    )

    assert result.id == ttx.id


def test_planner_ttx_access_without_totp_is_denied_mfa_required(db_session: Session) -> None:
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner@acme.com")
    ttx = _seed_ttx(db_session, org.id, owner.id)
    admin = _seed_user(db_session, "admin2@acme.com")
    _grant_ttx_access(db_session, admin.id, ttx.id, RoleEnum.PLANNER)

    with pytest.raises(AppException) as exc_info:
        RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(_fake_request(str(ttx.id)), admin, db_session)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "MFA_REQUIRED"


def test_player_ttx_access_without_totp_is_not_denied(db_session: Session) -> None:
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner@acme.com")
    ttx = _seed_ttx(db_session, org.id, owner.id)
    player = _seed_user(db_session, "player2@acme.com")
    _grant_ttx_access(db_session, player.id, ttx.id, RoleEnum.PLAYER)

    result = RequiresOrgAndTTXAccess(RoleEnum.PLAYER)(
        _fake_request(str(ttx.id)), player, db_session
    )

    assert result.id == ttx.id


def test_mismatched_ttx_access_role_is_denied(db_session: Session) -> None:
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner@acme.com")
    ttx = _seed_ttx(db_session, org.id, owner.id)
    player = _seed_user(db_session, "player@acme.com")
    _grant_ttx_access(db_session, player.id, ttx.id, RoleEnum.PLAYER)

    with pytest.raises(AppException) as exc_info:
        RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(_fake_request(str(ttx.id)), player, db_session)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "TTX_ACCESS_DENIED"
    assert exc_info.value.ttx_id == str(ttx.id)
    assert exc_info.value.log_level == logging.WARNING


def test_no_ttx_access_row_is_denied(db_session: Session) -> None:
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner@acme.com")
    ttx = _seed_ttx(db_session, org.id, owner.id)
    stranger = _seed_user(db_session, "stranger@acme.com")

    with pytest.raises(AppException) as exc_info:
        RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(_fake_request(str(ttx.id)), stranger, db_session)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "TTX_ACCESS_DENIED"


def test_org_program_manager_reads_without_a_grant(db_session: Session) -> None:
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner@acme.com")
    owner.totp_enabled = True
    db_session.add(owner)
    db_session.commit()
    ttx = _seed_ttx(db_session, org.id, owner.id)
    _grant_program_manager(db_session, owner.id, org.id)

    for method in ("GET", "HEAD"):
        result = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(
            _fake_request(str(ttx.id), method), owner, db_session
        )
        assert result.id == ttx.id


def test_org_program_manager_without_a_grant_cannot_write(db_session: Session) -> None:
    """Oversight, not design: a Program Manager changes an exercise only
    from a seat on its team, like anyone else."""
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner@acme.com")
    owner.totp_enabled = True
    db_session.add(owner)
    db_session.commit()
    ttx = _seed_ttx(db_session, org.id, owner.id)
    _grant_program_manager(db_session, owner.id, org.id)

    for method in ("POST", "PUT", "PATCH", "DELETE"):
        with pytest.raises(AppException) as exc_info:
            RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(
                _fake_request(str(ttx.id), method), owner, db_session
            )
        assert exc_info.value.code == "TTX_ACCESS_DENIED"

    _grant_ttx_access(db_session, owner.id, ttx.id, RoleEnum.PLANNER)
    result = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(
        _fake_request(str(ttx.id)), owner, db_session
    )
    assert result.id == ttx.id


def test_org_program_manager_bypass_without_totp_is_denied_mfa_required(
    db_session: Session,
) -> None:
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner3@acme.com")
    ttx = _seed_ttx(db_session, org.id, owner.id)
    _grant_program_manager(db_session, owner.id, org.id)

    with pytest.raises(AppException) as exc_info:
        RequiresOrgAndTTXAccess(RoleEnum.PLAYER)(
            _fake_request(str(ttx.id), "GET"), owner, db_session
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "MFA_REQUIRED"


def test_other_org_program_manager_is_denied(db_session: Session) -> None:
    org = _seed_org(db_session, "Acme")
    owner = _seed_user(db_session, "owner@acme.com")
    ttx = _seed_ttx(db_session, org.id, owner.id)

    other_org = _seed_org(db_session, "Other Corp")
    intruder = _seed_user(db_session, "intruder@other.com")
    _grant_program_manager(db_session, intruder.id, other_org.id)

    with pytest.raises(AppException) as exc_info:
        RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(
            _fake_request(str(ttx.id), "GET"), intruder, db_session
        )

    assert exc_info.value.status_code == 403


def test_unknown_ttx_id_returns_404(db_session: Session) -> None:
    user = _seed_user(db_session, "someone@acme.com")
    unknown_ttx_id = "00000000-0000-0000-0000-000000000000"

    with pytest.raises(HTTPException) as exc_info:
        RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(_fake_request(unknown_ttx_id), user, db_session)

    assert exc_info.value.status_code == 404


def test_malformed_ttx_id_returns_404(db_session: Session) -> None:
    user = _seed_user(db_session, "someone2@acme.com")

    with pytest.raises(HTTPException) as exc_info:
        RequiresOrgAndTTXAccess(RoleEnum.PLANNER)(_fake_request("not-a-uuid"), user, db_session)

    assert exc_info.value.status_code == 404
