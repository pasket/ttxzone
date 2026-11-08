from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import TTX, Organization, RoleEnum, TTXAccess


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _seed_ttx(db_session: Session, organization_id, creator_id, name: str = "Drill") -> TTX:
    ttx = TTX(name=name, organization_id=organization_id, created_by_id=creator_id)
    db_session.add(ttx)
    db_session.commit()
    db_session.refresh(ttx)
    return ttx


def test_program_manager_sees_only_own_org_ttx(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    own_ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])

    other_org = Organization(name="Other Corp")
    db_session.add(other_org)
    db_session.commit()
    db_session.refresh(other_org)
    _seed_ttx(db_session, other_org.id, owner["user"]["id"], name="Other Drill")

    response = client.get("/api/v1/ttx")

    assert response.status_code == 200
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {str(own_ttx.id)}
    assert body["items"][0]["role"] == "program_manager"


def test_ttx_access_holder_sees_only_granted_ttx(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])

    planner = _signup(client, "eval@external.com", "Planner Org")
    db_session.add(
        TTXAccess(user_id=planner["user"]["id"], ttx_id=ttx.id, role=RoleEnum.PLANNER, plans=True)
    )
    db_session.commit()

    response = client.get("/api/v1/ttx")

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == str(ttx.id)
    assert body["items"][0]["role"] == "planner"


def test_list_ttx_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/ttx")

    assert response.status_code == 401


def test_list_ttx_user_with_no_access_sees_empty_list(client: TestClient) -> None:
    _signup(client, "lonely@nobody.com", "Nobody Org")

    response = client.get("/api/v1/ttx")

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_list_ttx_pagination(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner4@acme.com", "Acme4")
    for i in range(5):
        _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name=f"Drill {i}")

    response = client.get("/api/v1/ttx", params={"limit": 2, "offset": 0})
    body = response.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["limit"] == 2
    assert body["offset"] == 0

    response2 = client.get("/api/v1/ttx", params={"limit": 2, "offset": 4})
    body2 = response2.json()
    assert body2["total"] == 5
    assert len(body2["items"]) == 1


def test_list_ttx_sort_dir(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner5@acme.com", "Acme5")
    first = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name="First")
    last = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name="Last")

    default_response = client.get("/api/v1/ttx")
    default_ids = [item["id"] for item in default_response.json()["items"]]
    assert default_ids == [str(last.id), str(first.id)]

    asc_response = client.get("/api/v1/ttx", params={"sort_dir": "asc"})
    asc_ids = [item["id"] for item in asc_response.json()["items"]]
    assert asc_ids == [str(first.id), str(last.id)]


def test_list_ttx_search_and_alphabetical_sort(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-ttx-search@acme.com", "TtxSearchCo")
    _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name="Zeta Drill")
    _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name="Alpha Drill")
    _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name="Beta Exercise")

    response = client.get("/api/v1/ttx?sort_by=name&sort_dir=asc")
    assert response.status_code == 200
    names = [item["name"] for item in response.json()["items"]]
    assert names == ["Alpha Drill", "Beta Exercise", "Zeta Drill"]

    response = client.get("/api/v1/ttx?q=drill")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert {item["name"] for item in body["items"]} == {"Zeta Drill", "Alpha Drill"}

    # The code is searched too, as the exercise lists show it.
    code = next(i["code"] for i in body["items"] if i["name"] == "Alpha Drill")
    response = client.get("/api/v1/ttx", params={"q": code.lower()})
    assert [item["name"] for item in response.json()["items"]] == ["Alpha Drill"]


def test_list_ttx_alphabetical_sort_desc(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner-ttx-search-desc@acme.com", "TtxSearchDescCo")
    _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name="Zeta Drill")
    _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name="Alpha Drill")
    _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], name="Beta Exercise")

    # Z to A, the exact reverse of the asc test.
    response = client.get("/api/v1/ttx?sort_by=name&sort_dir=desc")
    assert response.status_code == 200
    names = [item["name"] for item in response.json()["items"]]
    assert names == ["Zeta Drill", "Beta Exercise", "Alpha Drill"]
