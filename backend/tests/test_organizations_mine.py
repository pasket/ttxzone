import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.main import app
from app.models import TTX, InvitationToken, RoleEnum, TTXAccess, User
from tests.org_paths import org_base


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _enable_totp(db_session: Session, user_id: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _grant_planner_via_api(program_manager_client: TestClient, email: str) -> None:
    response = program_manager_client.post(
        f"{org_base(program_manager_client)}/planners",
        json={"email": email},
        headers=_csrf_headers(program_manager_client),
    )
    assert response.status_code == 201


def test_list_my_organizations_covers_program_manager_planner_and_player(
    db_session: Session,
) -> None:
    # The user under test: Program Manager of org A, Planner of orgs B and C
    # (granted separately by each org's own Program Manager), Player of
    # org D (via token redemption) -- the exact multi-org scenario from
    # the feature request.
    with TestClient(app) as multi_client:
        org_a = _signup(multi_client, "multi@acme.com", "Org A")
        _enable_totp(db_session, org_a["user"]["id"])

        with TestClient(app) as owner_b_client:
            org_b = _signup(owner_b_client, "ownerb@acme.com", "Org B")
            _enable_totp(db_session, org_b["user"]["id"])
            _grant_planner_via_api(owner_b_client, "multi@acme.com")

        with TestClient(app) as owner_c_client:
            org_c = _signup(owner_c_client, "ownerc@acme.com", "Org C")
            _enable_totp(db_session, org_c["user"]["id"])
            _grant_planner_via_api(owner_c_client, "multi@acme.com")

        with TestClient(app) as owner_d_client:
            org_d = _signup(owner_d_client, "ownerd@acme.com", "Org D")
            # owner_d is Program Manager of org D (from signup), so approving
            # goes through RequiresOrgAndTTXAccess's Program Manager-bypass
            # branch, which now also enforces the TOTP mandate -- flip the
            # flag directly (mirrors other tests' _enable_totp helpers)
            # rather than re-logging-in, since re-authenticating after
            # enabling TOTP would trigger a real MFA challenge this test
            # has no secret to answer; the existing session cookie from
            # signup still works fine since totp_enabled is read fresh
            # from the DB on every request, not from the JWT.
            _enable_totp(db_session, org_d["user"]["id"])
            ttx_d = TTX(
                name="Org D Drill",
                organization_id=org_d["organization"]["id"],
                created_by_id=org_d["user"]["id"],
            )
            db_session.add(ttx_d)
            db_session.flush()
            # Its creator's seat, as create_ttx gives it.
            db_session.add(
                TTXAccess(
                    user_id=uuid.UUID(org_d["user"]["id"]),
                    ttx_id=ttx_d.id,
                    role=RoleEnum.PLANNER,
                    plans=True,
                    controls=True,
                )
            )
            db_session.commit()
            db_session.refresh(ttx_d)
            token_d = InvitationToken(
                token="org-d-player-token",
                ttx_id=ttx_d.id,
                role=RoleEnum.PLAYER,
                created_by_id=uuid.UUID(org_d["user"]["id"]),
                expires_at=datetime.now(UTC) + timedelta(days=1),
                max_uses=5,
            )
            db_session.add(token_d)
            db_session.commit()

            redeem = multi_client.post(
                "/api/v1/invitation-tokens/redeem",
                json={"token": "org-d-player-token"},
                headers=_csrf_headers(multi_client),
            )
            assert redeem.status_code == 200

            # Redemption only creates a pending TTXAccessRequest -- org D
            # doesn't count as "belonging to" yet (list_user_organizations
            # only counts real OrganizationMembership/TTXAccess rows)
            # until org D's own Planner approves it.
            pending = owner_d_client.get(f"/api/v1/ttx/{ttx_d.id}/access-requests")
            request_id = pending.json()["items"][0]["id"]
            approve = owner_d_client.post(
                f"/api/v1/ttx/{ttx_d.id}/access-requests/{request_id}/approve",
                headers=_csrf_headers(owner_d_client),
            )
            assert approve.status_code == 200

        response = multi_client.get("/api/v1/organizations/mine")
        assert response.status_code == 200
        items = {item["organization_id"]: item for item in response.json()["items"]}

        # The founder of an organization runs its program and plans.
        assert items[org_a["organization"]["id"]]["is_program_manager"] is True
        assert items[org_a["organization"]["id"]]["is_planner"] is True

        assert items[org_b["organization"]["id"]]["is_planner"] is True
        assert items[org_b["organization"]["id"]]["is_program_manager"] is False

        assert items[org_c["organization"]["id"]]["is_planner"] is True

        # Player-only org: listed, but neither flag set -- module
        # visibility for it comes from the (org-filtered) ttxList role
        # check on the frontend, not from these two flags.
        assert items[org_d["organization"]["id"]]["is_program_manager"] is False
        assert items[org_d["organization"]["id"]]["is_planner"] is False

        assert set(items.keys()) == {
            org_a["organization"]["id"],
            org_b["organization"]["id"],
            org_c["organization"]["id"],
            org_d["organization"]["id"],
        }


def test_list_my_organizations_single_org_for_new_signup(client: TestClient) -> None:
    _signup(client, "lonely@nobody.com", "Nobody Org")
    response = client.get("/api/v1/organizations/mine")

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["is_program_manager"] is True
    assert response.json()["items"][0]["alias"] is None
    assert response.json()["items"][0]["logo_url"] is None


def test_list_my_organizations_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/organizations/mine")

    assert response.status_code == 401
