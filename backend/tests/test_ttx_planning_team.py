"""planning team ("planning_team_members" in the API): Planners added to an exercise directly by
another of its Planners, from the organization's declared TTX
Managers -- and invitation tokens restricted to players."""

import uuid
from datetime import UTC, datetime, timedelta

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    TTX,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    TTXAccessTagAssignment,
    TTXTag,
    User,
)
from app.schemas.ttx import TTXCreateRequest
from app.services import totp_service
from app.services.ttx_service import create_ttx


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Owner"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _user(db_session: Session, email: str, name: str, secret: str | None = None) -> User:
    # A real password so _login can sign in as them.
    user = User(email=email, hashed_password=hash_password("Correcthorse123!"), full_name=name)
    if secret:
        totp_service.store_secret(user, secret)
        user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _login(client: TestClient, email: str, secret: str) -> None:
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Correcthorse123!"})
    assert login.status_code == 200
    verify = client.post(
        "/api/v1/auth/login/verify-totp",
        json={
            "mfa_pending_token": login.json()["mfa_pending_token"],
            "code": pyotp.TOTP(secret).now(),
        },
    )
    assert verify.status_code == 200


def _setup(client: TestClient, db_session: Session, suffix: str) -> dict:
    """`creator` (the exercise's only Planner, TOTP on) signed in on
    `client` -- the org's Program Manager only reads an exercise they
    aren't on the team of; `manager` is an org Planner not on the
    exercise; `player` is a player of it; `outsider` holds no role in
    the org. The owner's cookies stay in ctx for `_as_owner`."""
    owner = _signup(client, f"col-owner{suffix}@acme.com", f"ColCo{suffix}")
    owner_user = db_session.get(User, uuid.UUID(owner["user"]["id"]))
    owner_user.totp_enabled = True
    db_session.add(owner_user)
    org_id = uuid.UUID(owner["organization"]["id"])

    creator_secret = pyotp.random_base32()
    creator = _user(db_session, f"creator{suffix}@acme.com", "Cara Creator", creator_secret)
    manager = _user(db_session, f"manager{suffix}@acme.com", "Max Manager")
    player = _user(db_session, f"player{suffix}@acme.com", "Pat Player")
    outsider = _user(db_session, f"outsider{suffix}@acme.com", "Olga Outsider")
    for person in (creator, manager, player):
        db_session.add(
            OrganizationMembership(
                user_id=person.id, organization_id=org_id, role=OrgRoleEnum.PLANNER
            )
        )
    ttx = TTX(name="Drill", organization_id=org_id, created_by_id=creator.id)
    db_session.add(ttx)
    db_session.commit()
    db_session.add_all(
        [
            TTXAccess(user_id=creator.id, ttx_id=ttx.id, role=RoleEnum.PLANNER, plans=True),
            TTXAccess(user_id=player.id, ttx_id=ttx.id, role=RoleEnum.PLAYER),
        ]
    )
    db_session.commit()
    owner_cookies = dict(client.cookies)
    _login(client, creator.email, creator_secret)
    return {
        "owner_cookies": owner_cookies,
        "org_id": str(org_id),
        "ttx_id": str(ttx.id),
        "creator": creator,
        "creator_secret": creator_secret,
        "manager": manager,
        "player": player,
        "outsider": outsider,
    }


def _as_owner(client: TestClient, ctx: dict) -> None:
    client.cookies.clear()
    client.cookies.update(ctx["owner_cookies"])


def _url(ctx: dict, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ctx['ttx_id']}/planning-team{suffix}"


def test_list_and_candidates(client: TestClient, db_session: Session) -> None:
    ctx = _setup(client, db_session, "1")

    listed = client.get(_url(ctx))
    candidates = client.get(_url(ctx, "/candidates"))

    assert listed.status_code == 200
    assert [item["email"] for item in listed.json()["items"]] == ["creator1@acme.com"]
    assert "last_login_at" in listed.json()["items"][0]
    # Org Planners not yet on the exercise in any role (the org's founder
    # among them): the player is excluded, as is the creator already there.
    assert {item["email"] for item in candidates.json()["items"]} == {
        "manager1@acme.com",
        "col-owner1@acme.com",
    }


def test_add_an_org_planner(client: TestClient, db_session: Session) -> None:
    ctx = _setup(client, db_session, "2")

    response = client.post(_url(ctx), json={"email": "Manager2@acme.com"}, headers=_csrf(client))

    assert response.status_code == 201
    assert response.json()["email"] == "manager2@acme.com"
    access = db_session.exec(
        select(TTXAccess).where(
            TTXAccess.user_id == ctx["manager"].id, TTXAccess.ttx_id == uuid.UUID(ctx["ttx_id"])
        )
    ).one()
    assert access.role == RoleEnum.PLANNER


def test_add_rejections(client: TestClient, db_session: Session) -> None:
    ctx = _setup(client, db_session, "3")
    headers = _csrf(client)

    outsider = client.post(_url(ctx), json={"email": "outsider3@acme.com"}, headers=headers)
    unknown = client.post(_url(ctx), json={"email": "nobody3@acme.com"}, headers=headers)
    duplicate = client.post(_url(ctx), json={"email": "creator3@acme.com"}, headers=headers)
    player = client.post(_url(ctx), json={"email": "player3@acme.com"}, headers=headers)

    # No account and "not a Planner here" look the same from outside.
    assert outsider.status_code == unknown.status_code == 400
    assert (
        outsider.json()["error"]["code"] == unknown.json()["error"]["code"] == ("NOT_ORG_PLANNER")
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ALREADY_ON_PLANNING_TEAM"
    assert player.status_code == 409
    assert player.json()["error"]["code"] == "ALREADY_PLAYER"


def test_never_zero_planners(client: TestClient, db_session: Session) -> None:
    ctx = _setup(client, db_session, "4")
    headers = _csrf(client)

    last = client.delete(_url(ctx, f"/{ctx['creator'].id}"), headers=headers)
    assert last.status_code == 409
    assert last.json()["error"]["code"] == "LAST_PLANNER"

    client.post(_url(ctx), json={"email": "manager4@acme.com"}, headers=headers)
    removed = client.delete(
        _url(ctx, f"/{ctx['creator'].id}?lead_successor_id={ctx['manager'].id}"), headers=headers
    )
    assert removed.status_code == 204
    _as_owner(client, ctx)
    assert [item["email"] for item in client.get(_url(ctx)).json()["items"]] == [
        "manager4@acme.com"
    ]


def test_tags_on_a_planning_team_member_are_cleared_on_removal(
    client: TestClient, db_session: Session
) -> None:
    ctx = _setup(client, db_session, "5")
    headers = _csrf(client)
    client.post(_url(ctx), json={"email": "manager5@acme.com"}, headers=headers)
    tag = TTXTag(ttx_id=uuid.UUID(ctx["ttx_id"]), name="Lead", color="moss")
    db_session.add(tag)
    db_session.commit()
    tag_id = str(tag.id)

    tagged = client.put(
        _url(ctx, f"/{ctx['manager'].id}/tags"), json={"tag_ids": [tag_id]}, headers=headers
    )
    assert tagged.status_code == 200
    assert [t["name"] for t in tagged.json()["tags"]] == ["Lead"]
    listed = {i["email"]: i for i in client.get(_url(ctx)).json()["items"]}
    assert [t["name"] for t in listed["manager5@acme.com"]["tags"]] == ["Lead"]

    assert client.delete(_url(ctx, f"/{ctx['manager'].id}"), headers=headers).status_code == 204
    leftover = db_session.exec(
        select(TTXAccessTagAssignment).where(TTXAccessTagAssignment.ttx_tag_id == uuid.UUID(tag_id))
    ).first()
    assert leftover is None


def test_a_planning_team_member_can_remove_themselves_while_another_remains(
    client: TestClient, db_session: Session
) -> None:
    ctx = _setup(client, db_session, "6")
    client.post(_url(ctx), json={"email": "manager6@acme.com"}, headers=_csrf(client))

    # The creator is the Lead Planner: leaving names who takes over.
    response = client.delete(
        _url(ctx, f"/{ctx['creator'].id}?lead_successor_id={ctx['manager'].id}"),
        headers=_csrf(client),
    )
    assert response.status_code == 204
    # No longer a Planner of that exercise.
    assert client.get(_url(ctx)).status_code == 403


def test_leaving_an_exercise_keeps_one_planner(client: TestClient, db_session: Session) -> None:
    ctx = _setup(client, db_session, "7")

    response = client.delete(f"/api/v1/ttx/{ctx['ttx_id']}/access", headers=_csrf(client))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "LAST_PLANNER"


def test_planning_team_members_require_planner_access(
    client: TestClient, db_session: Session
) -> None:
    ctx = _setup(client, db_session, "8")

    client.cookies.clear()
    _signup(client, "col-intruder@other.com", "IntruderCo")

    assert client.get(_url(ctx)).status_code == 403


def test_invitation_tokens_are_for_players_only(client: TestClient, db_session: Session) -> None:
    ctx = _setup(client, db_session, "9")
    url = f"/api/v1/ttx/{ctx['ttx_id']}/invitation-tokens"
    expires = (datetime.now(UTC) + timedelta(days=7)).isoformat()

    manager_token = client.post(
        url, json={"role": "planner", "expires_at": expires}, headers=_csrf(client)
    )
    player_token = client.post(
        url, json={"role": "player", "expires_at": expires}, headers=_csrf(client)
    )

    assert manager_token.status_code == 422
    assert player_token.status_code == 201


# -- Lead Planner -------------------------------------------------------------


def _lead(client: TestClient, ctx: dict) -> list[str]:
    return [i["email"] for i in client.get(_url(ctx)).json()["items"] if i["is_lead"]]


def test_the_creator_of_an_exercise_is_its_lead_planner(
    client: TestClient, db_session: Session
) -> None:
    ctx = _setup(client, db_session, "20")
    ttx = create_ttx(
        db_session,
        uuid.UUID(ctx["org_id"]),
        ctx["creator"],
        TTXCreateRequest(name="Second drill", organization_id=uuid.UUID(ctx["org_id"])),
    )
    assert ttx.lead_planner_id == ctx["creator"].id
    # An exercise made outside create_ttx still shows one: its first member.
    assert _lead(client, ctx) == ["creator20@acme.com"]


def test_any_member_can_be_made_lead_planner(client: TestClient, db_session: Session) -> None:
    ctx = _setup(client, db_session, "21")
    headers = _csrf(client)
    client.post(_url(ctx), json={"email": "manager21@acme.com"}, headers=headers)

    response = client.put(
        _url(ctx, "/lead"), json={"user_id": str(ctx["manager"].id)}, headers=headers
    )

    assert response.status_code == 200
    assert {i["email"]: i["is_lead"] for i in response.json()["items"]} == {
        "creator21@acme.com": False,
        "manager21@acme.com": True,
    }
    # Retagging the lead keeps the flag in the answer.
    tagged = client.put(
        _url(ctx, f"/{ctx['manager'].id}/tags"), json={"tag_ids": []}, headers=headers
    )
    assert tagged.json()["is_lead"] is True

    outsider = client.put(
        _url(ctx, "/lead"), json={"user_id": str(ctx["player"].id)}, headers=headers
    )
    assert outsider.status_code == 404
    assert outsider.json()["error"]["code"] == "NOT_ON_PLANNING_TEAM"


def test_removing_the_lead_needs_a_chosen_successor(
    client: TestClient, db_session: Session
) -> None:
    ctx = _setup(client, db_session, "22")
    headers = _csrf(client)
    client.post(_url(ctx), json={"email": "manager22@acme.com"}, headers=headers)
    lead = ctx["creator"].id

    missing = client.delete(_url(ctx, f"/{lead}"), headers=headers)
    assert missing.status_code == 409
    assert missing.json()["error"]["code"] == "LEAD_SUCCESSOR_REQUIRED"
    itself = client.delete(_url(ctx, f"/{lead}?lead_successor_id={lead}"), headers=headers)
    stranger = client.delete(
        _url(ctx, f"/{lead}?lead_successor_id={ctx['player'].id}"), headers=headers
    )
    assert itself.status_code == stranger.status_code == 400
    assert itself.json()["error"]["code"] == "INVALID_LEAD_SUCCESSOR"
    # Nothing was removed on the way.
    assert _lead(client, ctx) == ["creator22@acme.com"]

    removed = client.delete(
        _url(ctx, f"/{lead}?lead_successor_id={ctx['manager'].id}"), headers=headers
    )
    assert removed.status_code == 204
    _as_owner(client, ctx)
    assert _lead(client, ctx) == ["manager22@acme.com"]


def test_a_lead_leaving_the_exercise_names_a_successor(
    client: TestClient, db_session: Session
) -> None:
    ctx = _setup(client, db_session, "24")
    client.post(_url(ctx), json={"email": "manager24@acme.com"}, headers=_csrf(client))

    leave = f"/api/v1/ttx/{ctx['ttx_id']}/access"
    refused = client.delete(leave, headers=_csrf(client))
    assert refused.json()["error"]["code"] == "LEAD_SUCCESSOR_REQUIRED"
    left = client.delete(f"{leave}?lead_successor_id={ctx['manager'].id}", headers=_csrf(client))
    assert left.status_code == 204

    # The Program Manager still reads it.
    _as_owner(client, ctx)
    assert _lead(client, ctx) == ["manager24@acme.com"]


def test_deleting_a_leads_account_hands_over_to_the_chosen_member(
    client: TestClient, db_session: Session
) -> None:
    ctx = _setup(client, db_session, "25")
    client.post(_url(ctx), json={"email": "manager25@acme.com"}, headers=_csrf(client))

    led = client.get("/api/v1/auth/me/lead-exercises").json()["items"]
    assert [(e["ttx_id"], e["organization_name"]) for e in led] == [(ctx["ttx_id"], "ColCo25")]
    assert [c["full_name"] for c in led[0]["candidates"]] == ["Max Manager"]

    refused = client.request(
        "DELETE",
        "/api/v1/auth/me",
        json={"confirmation": "delete my account"},
        headers=_csrf(client),
    )
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "LEAD_SUCCESSOR_REQUIRED"

    deleted = client.request(
        "DELETE",
        "/api/v1/auth/me",
        json={
            "confirmation": "delete my account",
            "lead_successors": {ctx["ttx_id"]: str(ctx["manager"].id)},
        },
        headers=_csrf(client),
    )
    assert deleted.status_code == 204

    _as_owner(client, ctx)
    listed = client.get(_url(ctx))
    assert listed.status_code == 200, listed.text
    assert _lead(client, ctx) == ["manager25@acme.com"]


def test_the_exercise_carries_its_lead_planner(client: TestClient, db_session: Session) -> None:
    ctx = _setup(client, db_session, "26")

    items = client.get("/api/v1/ttx").json()["items"]

    assert items[0]["lead_planner"] == {
        "user_id": str(ctx["creator"].id),
        "full_name": "Cara Creator",
    }


def test_removing_a_member_who_isnt_lead_keeps_the_lead(
    client: TestClient, db_session: Session
) -> None:
    ctx = _setup(client, db_session, "23")
    headers = _csrf(client)
    client.post(_url(ctx), json={"email": "manager23@acme.com"}, headers=headers)

    client.delete(_url(ctx, f"/{ctx['manager'].id}"), headers=headers)

    assert _lead(client, ctx) == ["creator23@acme.com"]
