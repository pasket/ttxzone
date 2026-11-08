"""Platform -> Accounts -> one account: its summary (organizations,
exercises, sign-in state, what keeps it), correcting its name and email,
resetting its password (temporary, to be changed at the next sign-in) or
its second factor, ending its sessions, and deleting it for good when it
left no trace."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import (
    TTX,
    LegalAcceptance,
    PlatformAuditEvent,
    RoleEnum,
    TotpBackupCode,
    TTXAccess,
    User,
)
from app.services import totp_service
from app.services.account_admin_service import DEPENDENCY_CATEGORIES, user_references
from tests.test_instance_tenancy import (
    PASSWORD,
    _csrf,
    _make_admin,
    _register,
    _signup,
    _stale_sign_in,
)


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> TestClient:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    return client


def _user(db_session: Session, email: str) -> User:
    db_session.expire_all()
    return db_session.exec(select(User).where(User.email == email)).one()


def _user_or_none(db_session: Session, email: str) -> User | None:
    db_session.expire_all()
    return db_session.exec(select(User).where(User.email == email)).first()


def _another(db_session: Session, email: str = "pat@acme.com") -> User:
    with TestClient(app) as other:
        _register(other, email)
    return _user(db_session, email)


def _detail(client: TestClient, user: User) -> dict:
    response = client.get(f"/api/v1/instance/accounts/{user.id}")
    assert response.status_code == 200, response.text
    return response.json()


def _delete(client: TestClient, user: User, confirmation: str | None = None):
    return client.request(
        "DELETE",
        f"/api/v1/instance/accounts/{user.id}",
        json={"confirmation": confirmation or user.email},
        headers=_csrf(client),
    )


def _login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_every_reference_to_an_account_is_classified() -> None:
    """A new table pointing at accounts must say what it means for
    deleting one (account_admin_service.DEPENDENCY_CATEGORIES)."""
    handled = {
        ("user_session", "user_id"),
        ("totp_backup_code", "user_id"),
        ("password_history", "user_id"),
        ("legal_acceptance", "user_id"),
        ("external_identity", "user_id"),
        ("oidc_login_state", "user_id"),
        ("account_token", "user_id"),
        ("personal_access_token", "user_id"),
        ("assistant_call", "user_id"),
        ("assistant_proposal", "user_id"),
        ("platform_audit_event", "actor_user_id"),
    }
    unclassified = [
        reference
        for reference in user_references()
        if reference not in handled and reference[0] not in DEPENDENCY_CATEGORIES
    ]
    assert unclassified == []


def test_the_summary_lists_organizations_exercises_and_what_keeps_the_account(
    admin: TestClient, db_session: Session
) -> None:
    with TestClient(app) as other:
        owner = _signup(other, "pm@acme.com", "Acme").json()
    pm_id = uuid.UUID(owner["user"]["id"])
    ttx = TTX(
        name="Ransomware",
        organization_id=uuid.UUID(owner["organization"]["id"]),
        created_by_id=pm_id,
    )
    db_session.add(ttx)
    db_session.commit()
    db_session.add(
        TTXAccess(
            user_id=pm_id,
            ttx_id=ttx.id,
            role=RoleEnum.PLANNER,
            plans=True,
            controls=True,
            evaluates=True,
            leads=True,
        )
    )
    db_session.commit()

    detail = _detail(admin, _user(db_session, "pm@acme.com"))

    assert [o["name"] for o in detail["organizations"]] == ["Acme"]
    [exercise] = detail["exercises"]
    assert (exercise["name"], exercise["organization_name"], exercise["code"]) == (
        "Ransomware",
        "Acme",
        ttx.code,
    )
    assert exercise["roles"] == ["planner", "controller", "evaluator"]
    assert exercise["lead_evaluator"] is True
    assert detail["active_sessions"] == 1
    categories = {d["category"]: d["count"] for d in detail["dependencies"]}
    assert {"organizations", "exercises", "exercise_content"} <= set(categories)
    assert detail["is_self"] is False


def test_name_and_email_are_corrected_and_logged(admin: TestClient, db_session: Session) -> None:
    pat = _another(db_session)
    _another(db_session, "sam@acme.com")

    updated = admin.patch(
        f"/api/v1/instance/accounts/{pat.id}",
        json={"full_name": "  Pat Smith ", "email": "Pat.Smith@Acme.com"},
        headers=_csrf(admin),
    )
    taken = admin.patch(
        f"/api/v1/instance/accounts/{pat.id}",
        json={"email": "sam@acme.com"},
        headers=_csrf(admin),
    )

    assert updated.status_code == 200, updated.text
    assert (updated.json()["full_name"], updated.json()["email"]) == (
        "Pat Smith",
        "pat.smith@acme.com",
    )
    assert taken.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"
    event = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "account.update")
    ).one()
    assert event.details == {
        "full_name": {"before": "Pat", "after": "Pat Smith"},
        "email": {"before": "pat@acme.com", "after": "pat.smith@acme.com"},
    }


def test_a_reset_password_is_temporary_and_must_be_changed(
    admin: TestClient, db_session: Session
) -> None:
    with TestClient(app) as other:
        _register(other, "pat@acme.com")
        pat = _user(db_session, "pat@acme.com")

        reset = admin.post(
            f"/api/v1/instance/accounts/{pat.id}/reset-password", headers=_csrf(admin)
        )
        assert reset.status_code == 200, reset.text
        assert reset.headers["cache-control"] == "no-store"
        temporary = reset.json()["temporary_password"]
        # Its open session ended.
        assert other.get("/api/v1/auth/me").status_code == 401

    with TestClient(app) as again:
        assert _login(again, "pat@acme.com").json()["error"]["code"] == "INVALID_CREDENTIALS"
        assert _login(again, "pat@acme.com", temporary).status_code == 200
        me = again.get("/api/v1/auth/me").json()
        assert me["password_change_required"] is True
        blocked = again.get("/api/v1/organizations/mine")
        assert blocked.json()["error"]["code"] == "PASSWORD_CHANGE_REQUIRED"
        same = again.post(
            "/api/v1/auth/password",
            json={"current_password": temporary, "new_password": temporary},
            headers=_csrf(again),
        )
        assert same.json()["error"]["code"] == "PASSWORD_REUSED"
        changed = again.post(
            "/api/v1/auth/password",
            json={"current_password": temporary, "new_password": "Brandnew123!"},
            headers=_csrf(again),
        )
        assert changed.status_code == 204, changed.text
        assert again.get("/api/v1/auth/me").json()["password_change_required"] is False
        assert again.get("/api/v1/organizations/mine").status_code == 200


def test_resetting_two_factor_clears_it_and_the_mandatory_gate_asks_again(
    admin: TestClient, db_session: Session
) -> None:
    with TestClient(app) as other:
        _signup(other, "pm@acme.com", "Acme")
    pm = _user(db_session, "pm@acme.com")
    totp_service.store_secret(pm, "JBSWY3DPEHPK3PXP")
    pm.totp_enabled = True
    db_session.add(pm)
    db_session.add(TotpBackupCode(user_id=pm.id, code_hash="x"))
    db_session.commit()

    reset = admin.post(f"/api/v1/instance/accounts/{pm.id}/reset-two-factor", headers=_csrf(admin))

    assert reset.status_code == 200, reset.text
    assert reset.json()["totp_enabled"] is False
    pm = _user(db_session, "pm@acme.com")
    assert (pm.totp_secret_encrypted, pm.totp_enabled) == (None, False)
    assert (
        db_session.exec(select(TotpBackupCode).where(TotpBackupCode.user_id == pm.id)).all() == []
    )
    with TestClient(app) as again:
        assert _login(again, "pm@acme.com").status_code == 200
        orgs = again.get("/api/v1/organizations/mine").json()
        org_id = orgs["items"][0]["organization_id"]
        gated = again.get(f"/api/v1/organizations/{org_id}/members")
        assert gated.json()["error"]["code"] == "MFA_REQUIRED"


def test_an_operator_creates_an_account_with_a_temporary_password(
    admin: TestClient, db_session: Session
) -> None:
    created = admin.post(
        "/api/v1/instance/accounts",
        json={"email": "New.Person@Acme.com", "full_name": " New Person "},
        headers=_csrf(admin),
    )

    assert created.status_code == 201, created.text
    assert created.headers["cache-control"] == "no-store"
    temporary = created.json()["temporary_password"]
    user = _user(db_session, "new.person@acme.com")
    assert str(user.id) == created.json()["user_id"]
    assert user.full_name == "New Person"
    assert user.password_change_required is True
    assert user.email_verification_required is False
    event = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "account.create")
    ).one()
    assert event.target_label == "new.person@acme.com"

    taken = admin.post(
        "/api/v1/instance/accounts",
        json={"email": "new.person@acme.com", "full_name": "Again"},
        headers=_csrf(admin),
    )
    assert taken.status_code == 409
    assert taken.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"

    with TestClient(app) as person:
        assert _login(person, "new.person@acme.com", temporary).status_code == 200
        blocked = person.get("/api/v1/organizations/mine")
        assert blocked.json()["error"]["code"] == "PASSWORD_CHANGE_REQUIRED"


def test_only_an_instance_administrator_creates_accounts(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "pat@acme.com")

    refused = client.post(
        "/api/v1/instance/accounts",
        json={"email": "x@acme.com", "full_name": "X"},
        headers=_csrf(client),
    )

    assert refused.status_code == 403
    assert _user_or_none(db_session, "x@acme.com") is None


def test_ending_sessions_and_the_step_up(admin: TestClient, db_session: Session) -> None:
    with TestClient(app) as other:
        _register(other, "pat@acme.com")
        pat = _user(db_session, "pat@acme.com")
        ended = admin.post(f"/api/v1/instance/accounts/{pat.id}/end-sessions", headers=_csrf(admin))
        assert ended.json()["active_sessions"] == 0
        assert other.get("/api/v1/auth/me").status_code == 401
    _stale_sign_in(db_session, "ops@acme.com")
    for path in ("reset-password", "reset-two-factor", "end-sessions"):
        stale = admin.post(f"/api/v1/instance/accounts/{pat.id}/{path}", headers=_csrf(admin))
        assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    assert _delete(admin, pat).json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    stale = admin.post(
        "/api/v1/instance/accounts",
        json={"email": "x@acme.com", "full_name": "X"},
        headers=_csrf(admin),
    )
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"


def test_never_on_your_own_account(admin: TestClient, db_session: Session) -> None:
    ops = _user(db_session, "ops@acme.com")

    assert _detail(admin, ops)["is_self"] is True
    for path in ("reset-password", "reset-two-factor", "end-sessions"):
        response = admin.post(f"/api/v1/instance/accounts/{ops.id}/{path}", headers=_csrf(admin))
        assert response.json()["error"]["code"] == "CANNOT_MANAGE_YOURSELF"
    renamed = admin.patch(
        f"/api/v1/instance/accounts/{ops.id}", json={"full_name": "X"}, headers=_csrf(admin)
    )
    assert renamed.json()["error"]["code"] == "CANNOT_MANAGE_YOURSELF"
    assert _delete(admin, ops).json()["error"]["code"] == "CANNOT_MANAGE_YOURSELF"


def test_an_account_with_any_trace_is_kept(admin: TestClient, db_session: Session) -> None:
    with TestClient(app) as other:
        _signup(other, "pm@acme.com", "Acme")
    pm = _user(db_session, "pm@acme.com")

    refused = _delete(admin, pm)

    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "ACCOUNT_HAS_DEPENDENCIES"
    assert _user(db_session, "pm@acme.com") is not None


def test_another_instance_admin_must_be_revoked_first(
    admin: TestClient, db_session: Session
) -> None:
    pat = _another(db_session)
    _make_admin(db_session, "pat@acme.com")

    assert _delete(admin, _user(db_session, "pat@acme.com")).json()["error"]["code"] == (
        "REVOKE_INSTANCE_ADMIN_FIRST"
    )
    assert pat.id


def test_an_empty_account_is_deleted_for_good(admin: TestClient, db_session: Session) -> None:
    pat = _another(db_session)
    pat_id = pat.id
    db_session.add(TotpBackupCode(user_id=pat_id, code_hash="x"))
    db_session.commit()
    # Something it did in Platform's log, as an actor.
    db_session.add(
        PlatformAuditEvent(
            action="account.suspend",
            actor_user_id=pat_id,
            actor_label="pat@acme.com",
            target_kind="account",
        )
    )
    db_session.commit()

    mismatch = _delete(admin, pat, "someone@acme.com")
    deleted = _delete(admin, pat)

    assert mismatch.json()["error"]["code"] == "CONFIRMATION_MISMATCH"
    assert deleted.status_code == 204, deleted.text
    db_session.expire_all()
    assert db_session.get(User, pat_id) is None
    assert (
        db_session.exec(select(TotpBackupCode).where(TotpBackupCode.user_id == pat_id)).all() == []
    )
    assert (
        db_session.exec(select(LegalAcceptance).where(LegalAcceptance.user_id == pat_id)).all()
        == []
    )
    # What pat did -- signing up and in included -- keeps the email, not the id.
    kept = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.actor_label == "pat@acme.com")
    ).all()
    assert kept and all(event.actor_user_id is None for event in kept)
    logged = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "account.delete")
    ).one()
    assert logged.target_label == "pat@acme.com"
    assert admin.get(f"/api/v1/instance/accounts/{pat_id}").json()["error"]["code"] == (
        "ACCOUNT_NOT_FOUND"
    )
    # The email is free again.
    with TestClient(app) as again:
        _register(again, "pat@acme.com")


def test_a_temporary_password_always_meets_the_policy() -> None:
    from app.core.password_policy import validate_password_strength
    from app.services.account_admin_service import temporary_password

    passwords = {temporary_password() for _ in range(200)}
    assert len(passwords) == 200
    for password in passwords:
        assert len(password) == 16
        validate_password_strength(password)


def _bulk(client: TestClient, action: str, users: list, confirmation: str = ""):
    return client.post(
        "/api/v1/instance/accounts/bulk",
        json={
            "action": action,
            "user_ids": [str(u.id) for u in users],
            "confirmation": confirmation,
        },
        headers=_csrf(client),
    )


def test_bulk_suspend_does_each_one_and_reports_the_ones_skipped(
    admin: TestClient, db_session: Session
) -> None:
    pat, sam = _another(db_session), _another(db_session, "sam@acme.com")
    ops = _user(db_session, "ops@acme.com")
    users = [pat, sam, ops]

    unconfirmed = _bulk(admin, "suspend", users, "2")
    done = _bulk(admin, "suspend", users, "3")

    assert unconfirmed.json()["error"]["code"] == "CONFIRMATION_MISMATCH"
    assert done.status_code == 200, done.text
    body = done.json()
    assert (body["done"], body["skipped"]) == (2, 1)
    assert {r["email"]: r["code"] for r in body["results"]} == {
        "pat@acme.com": None,
        "sam@acme.com": None,
        "ops@acme.com": "CANNOT_MANAGE_YOURSELF",
    }
    assert _user(db_session, "pat@acme.com").suspended_at is not None
    events = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "account.suspend")
    ).all()
    assert sorted(e.target_label for e in events) == ["pat@acme.com", "sam@acme.com"]

    reactivated = _bulk(admin, "reactivate", [pat, sam])
    assert reactivated.json()["done"] == 2
    assert _user(db_session, "sam@acme.com").suspended_at is None


def test_bulk_delete_takes_only_the_accounts_that_left_no_trace(
    admin: TestClient, db_session: Session
) -> None:
    empty_id = _another(db_session).id
    with TestClient(app) as other:
        _signup(other, "pm@acme.com", "Acme")
    pm_id = _user(db_session, "pm@acme.com").id
    gone = uuid.uuid4()

    response = admin.post(
        "/api/v1/instance/accounts/bulk",
        json={
            "action": "delete",
            "user_ids": [str(empty_id), str(pm_id), str(gone)],
            "confirmation": "3",
        },
        headers=_csrf(admin),
    )

    assert response.status_code == 200, response.text
    codes = {r["user_id"]: r["code"] for r in response.json()["results"]}
    assert codes == {
        str(empty_id): None,
        str(pm_id): "ACCOUNT_HAS_DEPENDENCIES",
        str(gone): "ACCOUNT_NOT_FOUND",
    }
    db_session.expire_all()
    assert db_session.get(User, empty_id) is None
    assert db_session.get(User, pm_id) is not None


def test_bulk_signs_out_without_typing_but_with_step_up(
    admin: TestClient, db_session: Session
) -> None:
    with TestClient(app) as other:
        _register(other, "pat@acme.com")
        pat = _user(db_session, "pat@acme.com")
        assert _bulk(admin, "end_sessions", [pat]).json()["done"] == 1
        assert other.get("/api/v1/auth/me").status_code == 401
    # At most 100 at once.
    too_many = admin.post(
        "/api/v1/instance/accounts/bulk",
        json={"action": "end_sessions", "user_ids": [str(uuid.uuid4()) for _ in range(101)]},
        headers=_csrf(admin),
    )
    assert too_many.status_code == 422
    _stale_sign_in(db_session, "ops@acme.com")
    assert _bulk(admin, "end_sessions", [pat]).json()["error"]["code"] == (
        "REAUTHENTICATION_REQUIRED"
    )


def test_suspending_twice_records_it_once(admin: TestClient, db_session: Session) -> None:
    pat = _another(db_session)

    for _ in range(2):
        response = admin.post(
            f"/api/v1/instance/accounts/{pat.id}/suspend",
            json={"confirmation": pat.email},
            headers=_csrf(admin),
        )
        assert response.status_code == 200, response.text
    for _ in range(2):
        admin.post(f"/api/v1/instance/accounts/{pat.id}/reactivate", headers=_csrf(admin))

    actions = [
        e.action
        for e in db_session.exec(
            select(PlatformAuditEvent).where(PlatformAuditEvent.target_id == pat.id)
        )
    ]
    assert sorted(a for a in actions if not a.startswith("auth.")) == [
        "account.reactivate",
        "account.suspend",
    ]
