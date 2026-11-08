"""The deployment's account security rules an instance administrator sets
from Platform -> Sign-in security: the password policy on top of the fixed floor
(core/password_policy.StrongPassword) and which roles must have a second
factor. A fresh deployment keeps today's rules (DEFAULT_*)."""

import logging
import re
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.password_policy import PASSWORD_MIN_LENGTH
from app.core.security import hash_password, verify_password
from app.models import (
    INSTANCE_SETTINGS_ID,
    InstanceSettings,
    OrganizationMembership,
    OrgRoleEnum,
    PasswordHistory,
    RoleEnum,
    TTXAccess,
    User,
    active_membership,
)

module_logger = logging.getLogger(__name__)

MfaRole = Literal["program_manager", "planner", "evaluator", "observer", "player"]
MFA_ROLES: tuple[MfaRole, ...] = ("program_manager", "planner", "evaluator", "observer", "player")

# Name parts shorter than this are too common to refuse ("Li", "Jo").
_PERSONAL_MIN_PART = 3


@dataclass(frozen=True)
class PasswordPolicy:
    min_length: int
    reject_personal: bool
    max_age_days: int | None
    history_count: int


@dataclass(frozen=True)
class MfaPolicy:
    program_manager: bool
    planner: bool
    evaluator: bool
    observer: bool
    player: bool

    def requires(self, role: MfaRole) -> bool:
        return getattr(self, role)


DEFAULT_PASSWORD_POLICY = PasswordPolicy(PASSWORD_MIN_LENGTH, False, None, 0)
DEFAULT_MFA_POLICY = MfaPolicy(True, True, True, True, False)


def _stored(session: Session) -> InstanceSettings | None:
    return session.get(InstanceSettings, INSTANCE_SETTINGS_ID)


# Policy name -> (when read, value): read by every request (password
# expiry, the second-factor mandate), kept INSTANCE_CACHE_SECONDS.
_cache: dict[str, tuple[float, object]] = {}


def _cached(name: str, read):
    ttl = settings.INSTANCE_CACHE_SECONDS
    now = time.monotonic()
    hit = _cache.get(name)
    if ttl > 0 and hit is not None and now - hit[0] < ttl:
        return hit[1]
    value = read()
    if ttl > 0:
        _cache[name] = (now, value)
    return value


def forget_cached_policies() -> None:
    _cache.clear()


def effective_password_policy(session: Session) -> PasswordPolicy:
    return _cached("password", lambda: _read_password_policy(session))


def effective_mfa_policy(session: Session) -> MfaPolicy:
    return _cached("mfa", lambda: _read_mfa_policy(session))


def _read_password_policy(session: Session) -> PasswordPolicy:
    stored = _stored(session)
    if stored is None:
        return DEFAULT_PASSWORD_POLICY
    return PasswordPolicy(
        max(stored.password_min_length, PASSWORD_MIN_LENGTH),
        stored.password_reject_personal,
        stored.password_max_age_days,
        stored.password_history_count,
    )


def _read_mfa_policy(session: Session) -> MfaPolicy:
    stored = _stored(session)
    if stored is None:
        return DEFAULT_MFA_POLICY
    return MfaPolicy(
        stored.mfa_required_program_manager,
        stored.mfa_required_planner,
        stored.mfa_required_evaluator,
        stored.mfa_required_observer,
        stored.mfa_required_player,
    )


def _refuse(rule: str, message: str, **params: object) -> AppException:
    return AppException(
        "PASSWORD_POLICY",
        message,
        422,
        log_level=logging.WARNING,
        params={"rule": rule, **params},
    )


def _personal_parts(email: str, full_name: str) -> list[str]:
    local = email.split("@", 1)[0]
    parts = [local, *re.split(r"[\s._+-]+", local), *re.split(r"[\s.'-]+", full_name)]
    return [p.lower() for p in parts if len(p) >= _PERSONAL_MIN_PART]


def _history(session: Session, user: User, keep: int) -> list[PasswordHistory]:
    return list(
        session.exec(
            select(PasswordHistory)
            .where(PasswordHistory.user_id == user.id)
            .order_by(PasswordHistory.created_at.desc(), PasswordHistory.id.desc())
            .limit(keep)
        )
    )


def check_new_password(
    session: Session,
    password: str,
    *,
    email: str,
    full_name: str,
    user: User | None = None,
) -> None:
    """The deployment's rules beyond StrongPassword (which the request
    schema already applied). `user`: an existing account, whose current
    and previous passwords count against reuse."""
    policy = effective_password_policy(session)
    if len(password) < policy.min_length:
        raise _refuse(
            "length",
            "The password must be at least {min} characters long.",
            min=policy.min_length,
        )
    if policy.reject_personal:
        lowered = password.lower()
        if any(part in lowered for part in _personal_parts(email, full_name)):
            raise _refuse("personal", "The password can't contain your name or email address.")
    if user is not None and policy.history_count > 0:
        # "The last N" counts the current password as the first of them.
        hashes = [user.hashed_password] if user.hashed_password else []
        hashes += [row.hashed_password for row in _history(session, user, policy.history_count - 1)]
        if any(verify_password(password, hashed) for hashed in hashes):
            raise _refuse(
                "reused",
                "Choose a password you haven't used for your last {count} passwords.",
                count=policy.history_count,
            )


def set_password(session: Session, user: User, password: str, *, temporary: bool = False) -> None:
    """The one place an account's password is replaced (no commit). The
    previous one joins the history while the deployment refuses reuse
    (pruned to what it checks); a temporary password (Platform's create or
    reset) must be changed at the next sign-in and never enters it."""
    policy = effective_password_policy(session)
    keep = max(policy.history_count - 1, 0)
    if user.hashed_password and keep and not user.password_change_required:
        session.add(PasswordHistory(user_id=user.id, hashed_password=user.hashed_password))
        session.flush()
    for row in session.exec(
        select(PasswordHistory)
        .where(PasswordHistory.user_id == user.id)
        .order_by(PasswordHistory.created_at.desc(), PasswordHistory.id.desc())
        .offset(keep)
    ):
        session.delete(row)
    user.hashed_password = hash_password(password)
    user.password_changed_at = datetime.now(UTC)
    user.password_change_required = temporary
    session.add(user)


def password_expired(session: Session, user: User) -> bool:
    """The account's password is older than the deployment's maximum age.
    An account without one (single sign-on only) never expires; one from
    before the column existed counts from the migration that added it."""
    if user.hashed_password is None or user.password_changed_at is None:
        return False
    max_age = effective_password_policy(session).max_age_days
    if max_age is None:
        return False
    changed = user.password_changed_at
    if changed.tzinfo is None:
        changed = changed.replace(tzinfo=UTC)
    return datetime.now(UTC) - changed > timedelta(days=max_age)


def access_mfa_roles(access: TTXAccess) -> set[MfaRole]:
    """The roles an exercise grant acts in, for the second-factor mandate:
    a planning and control team member (Planner, Controller, Facilitator)
    counts as Planner, plus Evaluator / Observer when they also are one."""
    if access.role == RoleEnum.PLANNER:
        roles: set[MfaRole] = {"planner"}
        if access.evaluates:
            roles.add("evaluator")
        if access.observes:
            roles.add("observer")
        return roles
    return {access.role.value}  # type: ignore[arg-type]


def requires_mfa_for(session: Session, roles: set[MfaRole]) -> bool:
    policy = effective_mfa_policy(session)
    return any(policy.requires(role) for role in roles)


def held_mfa_roles(session: Session, user: User) -> set[MfaRole]:
    """Every role the account holds anywhere: org grants (active) and
    exercise grants. "Most restrictive wins" across organizations."""
    roles: set[MfaRole] = set()
    for role in session.exec(
        select(OrganizationMembership.role).where(
            OrganizationMembership.user_id == user.id, active_membership()
        )
    ):
        roles.add(OrgRoleEnum(role).value)  # type: ignore[arg-type]
    for access in session.exec(select(TTXAccess).where(TTXAccess.user_id == user.id)):
        roles |= access_mfa_roles(access)
    return roles


def mfa_mandated(session: Session, user: User) -> bool:
    """The account must have a second factor that meets the mandate (its
    own TOTP, or the provider's MFA on this session) before using its
    roles: the instance administrator always, anyone else per the
    deployment's roles."""
    return user.is_instance_admin or requires_mfa_for(session, held_mfa_roles(session, user))


def accounts_without_totp(session: Session) -> dict[MfaRole, int]:
    """Per role, active accounts holding it without their own TOTP -- who
    a mandate for that role would stop at the enrollment screen (a single
    sign-on with the provider's MFA would still let them through)."""
    base = (User.is_active.is_(True), User.totp_enabled.is_(False))  # type: ignore[attr-defined]
    counts: dict[MfaRole, int] = {}
    for role in MFA_ROLES:
        conditions = []
        if role != "program_manager":
            exercise = TTXAccess.role == RoleEnum(role)
            if role in ("evaluator", "observer"):
                flag = TTXAccess.evaluates if role == "evaluator" else TTXAccess.observes
                exercise = or_(exercise, (TTXAccess.role == RoleEnum.PLANNER) & flag)
            conditions.append(User.id.in_(select(TTXAccess.user_id).where(exercise)))  # type: ignore[attr-defined]
        if role != "player":
            granted = select(OrganizationMembership.user_id).where(
                OrganizationMembership.role == OrgRoleEnum(role), active_membership()
            )
            conditions.append(User.id.in_(granted))  # type: ignore[attr-defined]
        holders = or_(*conditions)
        counts[role] = session.exec(
            select(func.count()).select_from(User).where(*base, holders)
        ).one()
    return counts


def update_security_policy(
    session: Session, user: User, password: PasswordPolicy, mfa: MfaPolicy
) -> tuple[dict, dict]:
    """Saves both policies; returns (before, after) for the audit log.
    Stricter rules never touch stored passwords: they apply to the next
    one set, except the maximum age, which counts from when each was set."""
    before = {
        "password": asdict(effective_password_policy(session)),
        "mfa": asdict(effective_mfa_policy(session)),
    }
    stored = _stored(session) or InstanceSettings(id=INSTANCE_SETTINGS_ID)
    stored.password_min_length = password.min_length
    stored.password_reject_personal = password.reject_personal
    stored.password_max_age_days = password.max_age_days
    stored.password_history_count = password.history_count
    stored.mfa_required_program_manager = mfa.program_manager
    stored.mfa_required_planner = mfa.planner
    stored.mfa_required_evaluator = mfa.evaluator
    stored.mfa_required_observer = mfa.observer
    stored.mfa_required_player = mfa.player
    stored.updated_at = datetime.now(UTC)
    stored.updated_by_user_id = user.id
    session.add(stored)
    if password.history_count <= 1:
        # Nothing checks the history any more: don't keep old hashes.
        for row in session.exec(select(PasswordHistory)):
            session.delete(row)
    session.commit()
    forget_cached_policies()
    module_logger.info("Security policy updated by user %s.", user.id)
    return before, {"password": asdict(password), "mfa": asdict(mfa)}
