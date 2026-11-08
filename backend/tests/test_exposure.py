"""The public face (APP_ROLE=api-public): every route classified, only the
Players' routes served, a Player's view only, and sessions bound to the
face they were opened on."""

import re
import uuid
from collections.abc import Iterator

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.exposure import INTERNAL_ONLY, PUBLIC
from app.api.v1.api import ROUTERS, route_keys
from app.core import surface
from app.main import create_app
from app.models import (
    INSTANCE_SETTINGS_ID,
    TTX,
    InstanceSettings,
    RoleEnum,
    TTXAccess,
    User,
)
from app.services.exercise_run_service import acting_role
from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import PASSWORD, _account
from tests.test_ttx_needs_form import _csrf

PLAYER_EMAIL = "pat.player@acme.com"


def _all_routes() -> set[tuple[str, str]]:
    return {
        key
        for router in ROUTERS
        for route in router.routes
        if isinstance(route, APIRoute)
        for key in route_keys(route)
    }


def test_every_route_is_classified_once() -> None:
    routes = _all_routes()

    assert PUBLIC.isdisjoint(INTERNAL_ONLY)
    unclassified = routes - PUBLIC - INTERNAL_ONLY
    assert unclassified == set(), f"classify in app/api/exposure.py: {sorted(unclassified)}"
    stale = (PUBLIC | INTERNAL_ONLY) - routes
    assert stale == set(), f"no such route: {sorted(stale)}"


def test_the_ai_assistant_design_and_administration_stay_internal() -> None:
    for _method, path in PUBLIC:
        assert not path.startswith(("/mcp", "/instance/assistant", "/auth/tokens")), path
        assert "/assistant/" not in path and "/msel" not in path and "/needs-form" not in path
        assert not path.startswith(("/organizations/{", "/instance/")) or path == "/instance/policy"


@pytest.fixture
def public() -> Iterator[TestClient]:
    with TestClient(create_app("api-public")) as client:
        yield client


def _concrete(path: str) -> str:
    return re.sub(r"\{[^}]+\}", str(uuid.uuid4()), path)


def _hit(client: TestClient, method: str, path: str):
    """The route with made-up ids, signed out, redirects not followed."""
    url = "/api/v1" + _concrete(path)
    return client.request(method, url, json={}, follow_redirects=False)


def _not_served(response) -> bool:
    if response.status_code not in (404, 405):
        return False
    return response.json()["error"]["message"] in ("Not Found", "Method Not Allowed")


def test_the_public_face_serves_only_public_routes(public: TestClient) -> None:
    served_internal = [
        (method, path)
        for method, path in sorted(INTERNAL_ONLY)
        if not _not_served(
            public.request(method, "/api/v1" + _concrete(path), json={}, follow_redirects=False)
        )
    ]
    missing_public = [
        (method, path)
        for method, path in sorted(PUBLIC)
        if method != "GET" or not path.endswith("/stream")
        if _not_served(
            public.request(method, "/api/v1" + _concrete(path), json={}, follow_redirects=False)
        )
    ]

    assert served_internal == []
    assert missing_public == []
    for path in ("/openapi.json", "/docs", "/redoc"):
        assert public.get(path).status_code == 404
    assert public.get("/api/v1/instance/policy").json()["surface"] == "public"


def _sign_in(client: TestClient, email: str) -> None:
    client.cookies.clear()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text


def test_a_player_plays_on_the_public_face(
    client: TestClient,
    db_session: Session,
    public: TestClient,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    _post(client, ready, f"/injects/{first['code']}/release")
    _as_player(client, db_session, ready)  # creates the Player
    _sign_in(public, PLAYER_EMAIL)

    view = public.get(_url(ready), params={"as": "player"})
    as_controller = public.get(_url(ready), params={"as": "controller"})
    notes = public.put(
        _url(ready, "/notes"),
        params={"as": "player"},
        json={"inject_code": first["code"], "text": "We isolate the server."},
        headers=_csrf(public),
    )

    assert view.status_code == 200, view.text
    body = view.json()
    assert body["can_control"] is False and body["control"] is None
    assert [i["code"] for i in body["injects"]] == [first["code"]]
    assert as_controller.json()["error"]["code"] == "NOT_ACTING_AS"
    assert notes.status_code != 404
    assert public.get("/api/v1/ttx").status_code == 200
    assert public.get("/api/v1/auth/me").json()["email"] == PLAYER_EMAIL


def test_the_control_team_is_refused_on_the_public_face(
    client: TestClient,
    db_session: Session,
    public: TestClient,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    # A Controller of it (the second factor off for the team, to sign in).
    controller = _account(db_session, "carla.controller@acme.com", "Carla Controller")
    db_session.add(
        TTXAccess(
            user_id=controller.id,
            ttx_id=uuid.UUID(ready),
            role=RoleEnum.PLANNER,
            plans=False,
            controls=True,
        )
    )
    settings_row = db_session.get(InstanceSettings, INSTANCE_SETTINGS_ID) or InstanceSettings(
        id=INSTANCE_SETTINGS_ID
    )
    settings_row.mfa_required_planner = False
    db_session.add(settings_row)
    db_session.commit()
    _sign_in(public, controller.email)

    run = public.get(_url(ready))
    release = public.post(_url(ready, "/end"), headers=_csrf(public))

    assert run.status_code in (403, 404)
    assert release.status_code in (404, 405)
    # It lists nothing there: the public face shows only what one plays.
    assert public.get("/api/v1/ttx").json()["total"] == 0
    assert public.get("/api/v1/organizations/mine").json()["items"] == []
    me = public.get("/api/v1/auth/me").json()
    assert me["is_planner"] is False and me["is_instance_admin"] is False
    assert public.get("/api/v1/instance/policy").json()["can_found_organization"] is False


def test_a_session_works_only_on_the_face_it_was_opened_on(
    client: TestClient,
    db_session: Session,
    public: TestClient,
    ready: str,  # noqa: F811
) -> None:
    _as_player(client, db_session, ready)  # signed in on the internal face
    internal_cookies = dict(client.cookies)
    _sign_in(public, PLAYER_EMAIL)
    public_cookies = dict(public.cookies)

    public.cookies.clear()
    for name, value in internal_cookies.items():
        public.cookies.set(name, value)
    client.cookies.clear()
    for name, value in public_cookies.items():
        client.cookies.set(name, value)

    assert public.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


def test_services_only_ever_give_a_player_view_on_the_public_face(
    db_session: Session,
    client: TestClient,
    ready: str,  # noqa: F811
) -> None:
    ttx = db_session.get(TTX, uuid.UUID(ready))
    creator = db_session.get(User, ttx.created_by_id)
    token = surface._surface.set("public")
    try:
        assert acting_role(db_session, creator, ttx, "controller") is None
    finally:
        surface._surface.reset(token)
    assert acting_role(db_session, creator, ttx, "controller") == "controller"
