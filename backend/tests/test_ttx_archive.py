"""Archiving an exercise: read-only and out of the default lists until it's
unarchived; the same people who may delete it decide."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import TTX, InvitationToken, RoleEnum, TTXAccess
from tests.test_exercise_run import _post, _ready_plan
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import DESIGN_ENDPOINTS
from tests.test_ttx_needs_form import _csrf
from tests.test_ttx_tags import _register_bare

# Writes that still make sense on an archived exercise.
_ALLOWED = {("POST", "/duplicate")}


def _archive(client: TestClient, ttx_id: str, to: str = "archive"):
    return client.post(f"/api/v1/ttx/{ttx_id}/{to}", headers=_csrf(client))


def test_an_archived_exercise_is_read_only_until_unarchived(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    archived = _archive(client, ttx_id)
    assert archived.status_code == 200, archived.text
    assert archived.json()["archived_at"] is not None

    for method, suffix in DESIGN_ENDPOINTS:
        response = client.request(
            method, f"/api/v1/ttx/{ttx_id}{suffix}", json={}, headers=_csrf(client)
        )
        if method == "GET":
            assert response.status_code != 409, (method, suffix)
        elif (method, suffix) not in _ALLOWED:
            assert response.status_code == 409, (method, suffix, response.status_code)
            assert response.json()["error"]["code"] == "TTX_ARCHIVED", (method, suffix)
    # No session starts.
    started = _post(client, ttx_id, "/start")
    assert started.json()["error"]["code"] == "TTX_ARCHIVED"
    # Following up the improvement plan isn't refused for being archived
    # (there's no report here, hence the 404).
    follow_up = client.patch(
        f"/api/v1/ttx/{ttx_id}/aar/actions/IP-01", json={"status": "done"}, headers=_csrf(client)
    )
    assert follow_up.status_code != 409

    unarchived = _archive(client, ttx_id, "unarchive")
    assert unarchived.status_code == 200
    assert unarchived.json()["archived_at"] is None
    renamed = client.patch(f"/api/v1/ttx/{ttx_id}", json={"name": "Renamed"}, headers=_csrf(client))
    assert renamed.status_code == 200


def test_an_archived_exercise_can_still_be_duplicated(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx = exercise["ttx"]
    _archive(client, ttx["id"])
    copy = client.post(
        f"/api/v1/ttx/{ttx['id']}/duplicate",
        json={"name": "Run it again", "organization_id": ttx["organization_id"]},
        headers=_csrf(client),
    )
    assert copy.status_code == 201, copy.text
    assert copy.json()["ttx"]["archived_at"] is None


def test_an_archived_exercise_takes_no_one_new(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    db_session.add(
        InvitationToken(
            ttx_id=uuid.UUID(ttx_id),
            role=RoleEnum.PLAYER,
            token="archived-token-0123456789abcdef",
            created_by_id=uuid.UUID(exercise["ttx"]["created_by_id"]),
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
    )
    db_session.commit()
    _archive(client, ttx_id)

    with TestClient(client.app) as guest:
        _register_bare(guest, "guest@acme.com")
        redeemed = guest.post(
            "/api/v1/invitation-tokens/redeem",
            json={"token": "archived-token-0123456789abcdef"},
            headers=_csrf(guest),
        )
    assert redeemed.status_code == 409, redeemed.text
    assert redeemed.json()["error"]["code"] == "TTX_ARCHIVED"


def test_a_player_of_an_archived_exercise_cant_ask_to_leave(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _archive(client, ttx_id)
    with TestClient(client.app) as player:
        user_id = _register_bare(player, "player@acme.com")
        db_session.add(
            TTXAccess(user_id=uuid.UUID(user_id), ttx_id=uuid.UUID(ttx_id), role=RoleEnum.PLAYER)
        )
        db_session.commit()
        response = player.post(
            f"/api/v1/ttx/{ttx_id}/leave-request", json={"reason": ""}, headers=_csrf(player)
        )
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "TTX_ARCHIVED"


def test_a_session_under_way_must_end_before_archiving(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _ready_plan(client, ttx_id)
    assert _post(client, ttx_id, "/start").status_code == 200
    refused = _archive(client, ttx_id)
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "RUN_IN_PROGRESS"


@pytest.mark.parametrize("to", ["archive", "unarchive"])
def test_only_the_lead_planner_or_a_program_manager_archives(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
    to: str,
) -> None:
    """Another Planner of the exercise, not its lead, may not."""
    ttx_id = exercise["ttx"]["id"]
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    with TestClient(client.app) as other:
        user_id = uuid.UUID(_register_bare(other, "co.planner@acme.com"))
        db_session.add(TTXAccess(user_id=user_id, ttx_id=ttx.id, role=RoleEnum.PLANNER, plans=True))
        from tests.test_ttx_tags import _enable_totp

        _enable_totp(db_session, str(user_id))
        db_session.commit()
        refused = _archive(other, ttx_id, to)
    assert refused.status_code == 403, refused.text
    assert refused.json()["error"]["code"] == "TTX_ARCHIVE_FORBIDDEN"


def test_the_list_filters_archived_exercises(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx = exercise["ttx"]
    other = client.post(
        "/api/v1/ttx",
        json={"name": "Second", "organization_id": ttx["organization_id"]},
        headers=_csrf(client),
    ).json()
    _archive(client, ttx["id"])

    def names(query: str) -> set[str]:
        body = client.get(f"/api/v1/ttx?organization_id={ttx['organization_id']}{query}").json()
        return {item["name"] for item in body["items"]}

    assert names("") == {ttx["name"], other["name"]}
    assert names("&archived=true") == {ttx["name"]}
    assert names("&archived=false") == {other["name"]}
