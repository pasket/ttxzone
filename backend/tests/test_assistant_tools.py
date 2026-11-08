"""The assistant's tools: they read as the token's owner with the
Creator's guards (Planner on the exercise; a Program Manager of its
organization reads), and find what the catalogs hold."""

import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import hash_password
from app.models import AssistantCall, PersonalAccessToken, RoleEnum, TTXAccess, User
from app.services.assistant import calls
from app.services.assistant.switch import ASSISTANT_DISCLAIMER_VERSION
from app.services.assistant.tokens import TOKEN_PREFIX, hash_token
from tests.assistant_helpers import call, create_token, mcp
from tests.test_ttx_needs_form import _to_approved


def _data(result: dict) -> dict:
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


def _error_code(result: dict) -> str:
    assert result["isError"] is True, result
    return result["content"][0]["text"].split(":", 1)[0]


def _member(db_session: Session, email: str, ttx_id: str, role: RoleEnum, **flags: bool) -> str:
    """An account on the exercise with TOTP on, and a token of its own."""
    user = User(email=email, hashed_password=hash_password("Correcthorse123!"), full_name=email)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    db_session.add(TTXAccess(user_id=user.id, ttx_id=uuid.UUID(ttx_id), role=role, **flags))
    raw = f"{TOKEN_PREFIX}{uuid.uuid4().hex}"
    now = datetime.now(UTC)
    db_session.add(
        PersonalAccessToken(
            user_id=user.id,
            name="test",
            prefix=raw[:9],
            token_hash=hash_token(raw),
            expires_at=now + timedelta(days=7),
            disclaimer_version=ASSISTANT_DISCLAIMER_VERSION,
            acknowledged_at=now,
        )
    )
    db_session.commit()
    return raw


def test_a_planner_reads_their_exercise(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    _to_approved(client, ttx_id)
    assert client.get(f"/api/v1/ttx/{ttx_id}/msel").status_code == 200
    token = create_token(client)["token"]

    listed = _data(call(client, token, "list_exercises"))
    overview = _data(call(client, token, "get_exercise_overview", {"ttx_id": ttx_id}))
    needs = _data(call(client, token, "get_needs_analysis", {"ttx_id": ttx_id}))
    msel = _data(call(client, token, "get_msel", {"ttx_id": ttx_id}))

    [exercise] = listed["exercises"]
    assert exercise["ttx_id"] == ttx_id
    assert exercise["needs_analysis_status"] == "approved"
    assert exercise["msel_status"] == "draft"
    assert overview["tlp"] == "amber"
    assert overview["needs_analysis"]["status"] == "approved"
    assert overview["msel"]["status"] == "draft"
    assert needs["format"] == "markdown"
    assert "NEED-01" in needs["content"] and "OBJ-01" in needs["content"]
    assert [o["code"] for o in msel["objectives"]][:1] == ["OBJ-01"]
    records = db_session.exec(select(AssistantCall).order_by(AssistantCall.created_at)).all()
    assert [r.tool for r in records] == [
        "list_exercises",
        "get_exercise_overview",
        "get_needs_analysis",
        "get_msel",
    ]
    assert {r.outcome for r in records} == {"ok"}
    assert records[1].ttx_id == uuid.UUID(ttx_id)


def test_no_msel_yet_is_said_plainly(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]

    msel = _data(call(client, token, "get_msel", {"ttx_id": assistant_planner["ttx"]["id"]}))

    assert msel["msel"] is None


@pytest.mark.parametrize(
    ("role", "flags"),
    [
        (RoleEnum.PLANNER, {"plans": False, "controls": True}),
        (RoleEnum.EVALUATOR, {}),
        (RoleEnum.PLAYER, {}),
    ],
    ids=["controller-who-does-not-plan", "evaluator", "player"],
)
def test_who_does_not_plan_is_refused(
    client: TestClient, db_session: Session, assistant_planner: dict, role: RoleEnum, flags: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = _member(db_session, "member@acme.com", ttx_id, role, **flags)

    for tool in ("get_exercise_overview", "get_needs_analysis", "get_msel"):
        assert _error_code(call(client, token, tool, {"ttx_id": ttx_id})) == "TTX_ACCESS_DENIED"
    assert _data(call(client, token, "list_exercises"))["exercises"] == []
    [record] = db_session.exec(select(AssistantCall).where(AssistantCall.tool == "get_msel")).all()
    assert record.outcome == "TTX_ACCESS_DENIED"


def test_a_program_manager_without_a_seat_only_reads(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    ttx_id = assistant_planner["ttx"]["id"]
    token = create_token(client)["token"]
    founder = db_session.exec(select(User).where(User.email == "planner@acme.com")).one()
    seat = db_session.exec(select(TTXAccess).where(TTXAccess.user_id == founder.id)).one()
    db_session.delete(seat)
    db_session.commit()

    overview = _data(call(client, token, "get_exercise_overview", {"ttx_id": ttx_id}))

    assert overview["exercise"]["ttx_id"] == ttx_id
    # Not one of the exercises they plan.
    assert _data(call(client, token, "list_exercises"))["exercises"] == []


def test_another_organizations_exercise_or_a_made_up_one_is_not_readable(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    other = _member(db_session, "other@globex.com", assistant_planner["ttx"]["id"], RoleEnum.PLAYER)
    db_session.exec(select(TTXAccess))  # the Player's seat is the only link
    token = create_token(client)["token"]

    made_up = call(client, token, "get_msel", {"ttx_id": str(uuid.uuid4())})
    theirs = call(client, other, "get_needs_analysis", {"ttx_id": assistant_planner["ttx"]["id"]})

    assert _error_code(made_up) == "TTX_NOT_FOUND"
    assert _error_code(theirs) == "TTX_ACCESS_DENIED"


def test_the_organization_library_needs_its_reader_guard(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    org_id = assistant_planner["owner"]["organization"]["id"]
    token = create_token(client)["token"]
    player = _member(db_session, "player@acme.com", assistant_planner["ttx"]["id"], RoleEnum.PLAYER)

    own = _data(call(client, token, "search_organization_library", {"organization_id": org_id}))
    refused = call(client, player, "search_organization_library", {"organization_id": org_id})

    assert own["kind"] == "inject" and isinstance(own["results"], list)
    assert refused["isError"] is True


@pytest.mark.parametrize(
    ("query", "expected"),
    [("ransomware hospital", "KB-CAS-007"), ("deepfake CFO", "KB-CAS-006")],
)
def test_knowledge_search_finds_the_expected_entries(
    client: TestClient, db_session: Session, assistant_planner: dict, query: str, expected: str
) -> None:
    token = create_token(client)["token"]

    results = _data(call(client, token, "search_knowledge", {"query": query}))["results"]
    entry = _data(call(client, token, "get_knowledge_entry", {"id": expected}))

    assert results[0]["id"] == expected
    assert entry["id"] == expected and entry["sections"]


def test_catalog_searches(client: TestClient, db_session: Session, assistant_planner: dict) -> None:
    token = create_token(client)["token"]

    injects = _data(
        call(client, token, "search_inject_catalog", {"query": "encryption ransomware"})
    )["results"]
    inject = _data(
        call(client, token, "get_catalog_inject", {"id": "INJ-RAN-01", "language": "es"})
    )
    filtered = _data(call(client, token, "search_inject_catalog", {"family": "ransomware"}))
    objectives = _data(
        call(client, token, "search_objective_catalog", {"query": "backup restore"})
    )["results"]
    attack = _data(call(client, token, "search_attack", {"query": "T1486"}))
    missing = call(client, token, "get_knowledge_entry", {"id": "KB-XXX-999"})

    assert injects[0]["id"] == "INJ-RAN-01"
    assert inject["title"].startswith("Cifrado")
    assert filtered["results"] and all("ransomware" in r["families"] for r in filtered["results"])
    assert objectives[0]["id"] == "recovery-restore-order"
    assert [t["id"] for t in attack["techniques"]] == ["T1486"]
    assert _error_code(missing) == "ASSISTANT_ENTRY_NOT_FOUND"


def test_calls_are_rate_limited_per_token(
    client: TestClient,
    db_session: Session,
    assistant_planner: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ASSISTANT_RATE_LIMIT_PER_MINUTE", 2)
    token = create_token(client)["token"]

    first = call(client, token, "list_exercises")
    second = call(client, token, "list_exercises")
    third = mcp(client, token, "tools/call", {"name": "list_exercises"}).json()
    other = create_token(client, "second client")["token"]

    assert first["isError"] is False and second["isError"] is False
    assert third["error"]["data"]["code"] == "ASSISTANT_RATE_LIMITED"
    assert call(client, other, "list_exercises")["isError"] is False
    # ping and tools/list aren't tool calls.
    assert mcp(client, token, "ping").status_code == 200


def test_call_records_are_kept_ninety_days(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]
    call(client, token, "list_exercises")
    call(client, token, "list_exercises")
    old = db_session.exec(select(AssistantCall)).first()
    old.created_at = datetime.now(UTC) - timedelta(days=calls.ASSISTANT_CALL_RETENTION_DAYS + 1)
    db_session.add(old)
    db_session.commit()

    assert calls.prune_expired(db_session) == 1
    assert len(db_session.exec(select(AssistantCall)).all()) == 1
