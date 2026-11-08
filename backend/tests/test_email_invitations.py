"""Personal invitations by email: a Planner sends links to addresses; the
link grants the exercise at once (no access request), to the account
with that address only, and only while the deployment sends email."""

import json
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core import crypto
from app.core.config import settings
from app.main import app
from app.models import (
    TTX,
    EmailInvitation,
    EmailOutbox,
    EmailSettings,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
    User,
)

PASSWORD = "Correcthorse123!"


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _email_on(db_session: Session) -> None:
    db_session.add(EmailSettings(from_address="ttx@acme.com", smtp_host="smtp.acme.com"))
    db_session.commit()


def _register(email: str, full_name: str = "Pat") -> None:
    with TestClient(app) as other:
        response = other.post(
            "/api/v1/auth/register",
            json={"email": email, "password": PASSWORD, "full_name": full_name},
        )
        assert response.status_code == 201, response.text


def _exercise(client: TestClient, db_session: Session) -> TTX:
    """An organization founded (with email still off, so its founder isn't
    asked to confirm the address) and an exercise its founder plans."""
    response = client.post(
        "/api/v1/organizations",
        json={
            "organization": {"name": "Acme", "tax_id": None},
            "admin": {"email": "owner@acme.com", "password": PASSWORD, "full_name": "Ada"},
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    owner_id = uuid.UUID(body["user"]["id"])
    owner = db_session.get(User, owner_id)
    owner.totp_enabled = True
    db_session.add(owner)
    ttx = TTX(
        name="Ransomware Drill", organization_id=body["organization"]["id"], created_by_id=owner_id
    )
    db_session.add(ttx)
    db_session.flush()
    db_session.add(
        TTXAccess(user_id=owner_id, ttx_id=ttx.id, role=RoleEnum.PLANNER, plans=True, controls=True)
    )
    db_session.commit()
    db_session.refresh(ttx)
    return ttx


def _invite(client: TestClient, ttx: TTX, emails: list[str]):
    return client.post(
        f"/api/v1/ttx/{ttx.id}/email-invitations", json={"emails": emails}, headers=_csrf(client)
    )


def _links(db_session: Session) -> dict[str, str]:
    """Each invited address's latest link token, from the outbox."""
    db_session.expire_all()
    tokens: dict[str, str] = {}
    for row in db_session.exec(
        select(EmailOutbox)
        .where(EmailOutbox.template == "email_invitation")
        .order_by(EmailOutbox.created_at)
    ):
        params = json.loads(crypto.decrypt_secret(row.payload_encrypted or ""))
        prefix, token = params["link"].split("#token=")
        assert prefix == "https://ttx.acme.com/join"
        tokens[row.to_address] = token
    return tokens


def _accept(client: TestClient, token: str, account: dict | None = None):
    headers = _csrf(client) if settings.CSRF_COOKIE_NAME in client.cookies else {}
    payload: dict = {"token": token}
    if account is not None:
        payload["account"] = account
    return client.post("/api/v1/email-invitations/accept", json=payload, headers=headers)


def _login(client: TestClient, email: str) -> None:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text


def test_without_email_nothing_is_sent(client: TestClient, db_session: Session) -> None:
    ttx = _exercise(client, db_session)

    response = _invite(client, ttx, ["pat@example.com"])

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_INVITATIONS_UNAVAILABLE"
    policy = client.get("/api/v1/instance/policy").json()
    assert policy["email_invitations_available"] is False


def test_a_batch_reports_each_address(client: TestClient, db_session: Session) -> None:
    ttx = _exercise(client, db_session)
    _email_on(db_session)

    response = _invite(
        client, ttx, ["Pat@Example.com", "pat@example.com", "lee@example.com", "owner@acme.com"]
    )

    assert response.status_code == 201, response.text
    assert response.json()["results"] == [
        {"email": "pat@example.com", "outcome": "sent"},
        {"email": "lee@example.com", "outcome": "sent"},
        {"email": "owner@acme.com", "outcome": "on_team"},
    ]
    assert set(_links(db_session)) == {"pat@example.com", "lee@example.com"}

    again = _invite(client, ttx, ["pat@example.com"])
    assert again.json()["results"] == [{"email": "pat@example.com", "outcome": "resent"}]
    db_session.expire_all()
    rows = list(db_session.exec(select(EmailInvitation).where(EmailInvitation.ttx_id == ttx.id)))
    assert len(rows) == 2

    listed = client.get(f"/api/v1/ttx/{ttx.id}/email-invitations?sort_by=name&sort_dir=asc")
    assert [i["email"] for i in listed.json()["items"]] == ["lee@example.com", "pat@example.com"]
    assert {i["status"] for i in listed.json()["items"]} == {"pending"}


def test_an_invalid_address_refuses_the_batch(client: TestClient, db_session: Session) -> None:
    ttx = _exercise(client, db_session)
    _email_on(db_session)

    response = _invite(client, ttx, ["pat@example.com", "not an address"])

    assert response.status_code == 422
    assert _links(db_session) == {}


def test_a_new_account_joins_at_once(client: TestClient, db_session: Session) -> None:
    ttx = _exercise(client, db_session)
    _email_on(db_session)
    _invite(client, ttx, ["pat@example.com"])
    token = _links(db_session)["pat@example.com"]

    with TestClient(app) as guest:
        preview = guest.post("/api/v1/email-invitations/preview", json={"token": token})
        assert preview.status_code == 200
        assert preview.json() == {
            "organization_name": "Acme",
            "ttx_name": "Ransomware Drill",
            "email_hint": "p•••@example.com",
            "account_exists": False,
        }
        response = _accept(guest, token, {"full_name": "Pat", "password": PASSWORD})
        assert response.status_code == 200, response.text
        assert response.json()["created_account"] is True
        # Signed in, and the address counts as confirmed: nothing held.
        assert guest.get("/api/v1/auth/me").status_code == 200

    db_session.expire_all()
    pat = db_session.exec(select(User).where(User.email == "pat@example.com")).one()
    assert pat.email_verified_at is not None
    access = db_session.exec(
        select(TTXAccess).where(TTXAccess.user_id == pat.id, TTXAccess.ttx_id == ttx.id)
    ).one()
    assert access.role == RoleEnum.PLAYER
    # No request for a Planner to approve.
    assert db_session.exec(select(TTXAccessRequest)).first() is None

    players = client.get(f"/api/v1/ttx/{ttx.id}/players").json()["items"]
    assert [(p["email"], p["invited_by_email"]) for p in players] == [("pat@example.com", True)]

    with TestClient(app) as again:
        reused = _accept(again, token, {"full_name": "Pat", "password": PASSWORD})
        assert reused.status_code == 400
        assert reused.json()["error"]["code"] == "INVITATION_INVALID"


def test_only_the_invited_account_accepts(client: TestClient, db_session: Session) -> None:
    ttx = _exercise(client, db_session)
    _register("pat@example.com")
    _register("lee@example.com")
    _email_on(db_session)
    _invite(client, ttx, ["pat@example.com"])
    token = _links(db_session)["pat@example.com"]

    with TestClient(app) as guest:
        preview = guest.post("/api/v1/email-invitations/preview", json={"token": token})
        assert preview.json()["account_exists"] is True
        # Signed out, it can't create a second account with that address.
        refused = _accept(guest, token, {"full_name": "Pat", "password": PASSWORD})
        assert refused.status_code == 409
        assert refused.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"

        _login(guest, "lee@example.com")
        other = _accept(guest, token)
        assert other.status_code == 409
        assert other.json()["error"]["code"] == "INVITATION_OTHER_ACCOUNT"

        guest.post("/api/v1/auth/logout", headers=_csrf(guest))
        _login(guest, "pat@example.com")
        accepted = _accept(guest, token)
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["created_account"] is False


def test_expired_and_revoked_links_fail(client: TestClient, db_session: Session) -> None:
    ttx = _exercise(client, db_session)
    _email_on(db_session)
    _invite(client, ttx, ["pat@example.com", "lee@example.com"])
    links = _links(db_session)
    rows = {
        i.email: i
        for i in db_session.exec(select(EmailInvitation).where(EmailInvitation.ttx_id == ttx.id))
    }
    expired = rows["pat@example.com"]
    expired.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.add(expired)
    db_session.commit()

    revoked = client.delete(
        f"/api/v1/ttx/{ttx.id}/email-invitations/{rows['lee@example.com'].id}",
        headers=_csrf(client),
    )
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"

    with TestClient(app) as guest:
        for address in ("pat@example.com", "lee@example.com"):
            response = guest.post(
                "/api/v1/email-invitations/preview", json={"token": links[address]}
            )
            assert response.status_code == 400
            assert response.json()["error"]["code"] == "INVITATION_INVALID"

    # Sending again gives a revoked invitation a new link.
    resent = client.post(
        f"/api/v1/ttx/{ttx.id}/email-invitations/{rows['lee@example.com'].id}/resend",
        headers=_csrf(client),
    )
    assert resent.status_code == 200
    assert resent.json()["status"] == "pending"
    assert _links(db_session)["lee@example.com"] != links["lee@example.com"]


def test_a_player_already_in_is_not_invited(client: TestClient, db_session: Session) -> None:
    ttx = _exercise(client, db_session)
    _register("pat@example.com")
    _email_on(db_session)
    pat = db_session.exec(select(User).where(User.email == "pat@example.com")).one()
    db_session.add(TTXAccess(user_id=pat.id, ttx_id=ttx.id, role=RoleEnum.PLAYER))
    db_session.commit()

    response = _invite(client, ttx, ["pat@example.com"])

    assert response.json()["results"] == [{"email": "pat@example.com", "outcome": "already_player"}]


def test_deleting_the_exercise_deletes_its_invitations(
    client: TestClient, db_session: Session
) -> None:
    ttx = _exercise(client, db_session)
    _email_on(db_session)
    _invite(client, ttx, ["pat@example.com"])

    from app.services.ttx_service import delete_exercises

    delete_exercises(db_session, [ttx.id])
    db_session.commit()

    assert db_session.exec(select(EmailInvitation)).first() is None
