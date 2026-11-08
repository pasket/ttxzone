import logging

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Organization, OrganizationMembership, OrgRoleEnum, User


def _signup_payload(email: str = "ada@acme.com") -> dict:
    return {
        "organization": {"name": "Acme", "tax_id": "B12345678"},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada Lovelace"},
    }


def test_signup_success(client: TestClient, db_session: Session, caplog) -> None:
    with caplog.at_level(logging.INFO, logger="app.auth"):
        response = client.post("/api/v1/organizations", json=_signup_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["organization"]["name"] == "Acme"
    assert body["user"]["email"] == "ada@acme.com"

    assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies
    assert settings.CSRF_COOKIE_NAME in response.cookies

    org = db_session.exec(select(Organization).where(Organization.name == "Acme")).first()
    user = db_session.exec(select(User).where(User.email == "ada@acme.com")).first()
    assert org is not None
    assert user is not None
    membership = db_session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.organization_id == org.id,
        )
    ).first()
    assert membership is not None
    assert membership.role == OrgRoleEnum.PROGRAM_MANAGER

    assert any(
        "created with program-manager" in record.message and record.levelno == logging.INFO
        for record in caplog.records
    )


def test_signup_duplicate_email_is_rejected(client: TestClient, caplog) -> None:
    client.post("/api/v1/organizations", json=_signup_payload())

    with caplog.at_level(logging.WARNING, logger="app.auth"):
        response = client.post("/api/v1/organizations", json=_signup_payload())

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"
    assert any(r.levelno == logging.WARNING for r in caplog.records)


def test_signup_rejects_short_password(client: TestClient) -> None:
    payload = _signup_payload()
    payload["admin"]["password"] = "short"

    response = client.post("/api/v1/organizations", json=payload)

    assert response.status_code == 422


def test_signup_rejects_invalid_email(client: TestClient) -> None:
    payload = _signup_payload()
    payload["admin"]["email"] = "not-an-email"

    response = client.post("/api/v1/organizations", json=payload)

    assert response.status_code == 422
