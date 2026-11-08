import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import TTX, RoleEnum, TTXAccess, User


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Owner"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def test_role_and_organization_filters(client: TestClient, db_session: Session) -> None:
    """A Program Manager sees every exercise of their org, but acting as TTX
    Manager only the ones they hold that role on -- the same set the
    context bar's exercise selector offers."""
    other = _signup(client, "filter-other@other.com", "FilterOther")
    client.cookies.clear()
    owner = _signup(client, "filter-owner@acme.com", "FilterCo")
    user_id = uuid.UUID(owner["user"]["id"])
    org_id = uuid.UUID(owner["organization"]["id"])
    someone = User(email="filter-someone@acme.com", hashed_password="x", full_name="Someone")
    db_session.add(someone)
    db_session.commit()

    not_mine = TTX(name="Not mine", organization_id=org_id, created_by_id=someone.id)
    mine = TTX(name="Mine", organization_id=org_id, created_by_id=user_id)
    elsewhere = TTX(
        name="Elsewhere",
        organization_id=uuid.UUID(other["organization"]["id"]),
        created_by_id=user_id,
    )
    db_session.add_all([not_mine, mine, elsewhere])
    db_session.commit()
    db_session.add_all(
        [
            TTXAccess(user_id=user_id, ttx_id=mine.id, role=RoleEnum.PLANNER, plans=True),
            TTXAccess(user_id=user_id, ttx_id=elsewhere.id, role=RoleEnum.PLANNER, plans=True),
        ]
    )
    db_session.commit()

    def names(query: str) -> list[str]:
        body = client.get(f"/api/v1/ttx?sort_by=name&sort_dir=asc{query}").json()
        assert body["total"] == len(body["items"])
        return [item["name"] for item in body["items"]]

    assert names("") == ["Elsewhere", "Mine", "Not mine"]
    assert names(f"&organization_id={org_id}") == ["Mine", "Not mine"]
    assert names(f"&organization_id={org_id}&role=planner") == ["Mine"]
    assert names("&role=player") == []
