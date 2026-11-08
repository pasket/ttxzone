import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, text

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("POSTGRES_USER", "ttx_admin")
os.environ.setdefault("POSTGRES_PASSWORD", "test-password")
os.environ.setdefault("POSTGRES_DB", "ttx_zone_test")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
# A fixed Fernet key (core/crypto.py), never a real one.
os.environ.setdefault("DATA_ENCRYPTION_KEY", "dGVzdC1rZXktbm90LWZvci1wcm9kdWN0aW9uLTMyYnk=")

from app import models  # noqa: E402,F401  (register tables on metadata)
from app.core.config import settings  # noqa: E402
from app.core.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import tenancy_service  # noqa: E402
from app.services.tenancy_service import TenancyPolicy  # noqa: E402


@pytest.fixture(autouse=True)
def _disable_org_creation_domain_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    """Off by default for every test -- otherwise every org signup in the
    whole suite would make a real DNS query (see org_creation_security.py),
    an external dependency the test suite must never have. Tests that
    actually exercise the policy re-enable it explicitly and mock DNS
    resolution themselves (see test_organization_creation_security.py)."""
    monkeypatch.setattr(settings, "ORG_CREATION_DOMAIN_POLICY_ENABLED", False)


@pytest.fixture(autouse=True)
def _scratch_msel_uploads(tmp_path_factory, monkeypatch: pytest.MonkeyPatch) -> None:
    """MSEL images and files land in a throwaway folder: a test copying a
    TTX-Zone inject with an illustration never writes into the real
    uploads. Tests that inspect the folder patch it again themselves."""
    from app.services import msel_file_service, msel_image_service

    scratch = tmp_path_factory.mktemp("msel-uploads")
    monkeypatch.setattr(msel_image_service, "MSEL_IMAGE_DIR", scratch / "images")
    monkeypatch.setattr(msel_file_service, "MSEL_FILE_DIR", scratch / "files")


@pytest.fixture(autouse=True)
def _unpinned_tenancy(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every test starts in an "open" deployment, whatever the local .env
    pins or the shipped default (managed, one organization) says -- the
    suite founds organizations freely; tenancy tests set their own rules."""
    monkeypatch.setattr(tenancy_service, "DEFAULT_POLICY", TenancyPolicy("open", None, False))
    monkeypatch.setattr(settings, "TENANCY_MODE", None)
    monkeypatch.setattr(settings, "TENANCY_MAX_ORGANIZATIONS", None)


@pytest.fixture(autouse=True)
def _unpinned_email(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every test starts with email set from the web (none yet), whatever
    the local .env pins; email tests pin their own."""
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", None)
    monkeypatch.setattr(settings, "EMAIL_ALLOW_INSECURE", False)


@pytest.fixture(autouse=True)
def _unpinned_oidc(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every test starts with single sign-on set from the web (none yet),
    whatever the local .env pins, and a known public address; nothing
    remembered of a provider from an earlier test."""
    from app.services import oidc_service

    monkeypatch.setattr(settings, "OIDC_PROVIDER", None)
    monkeypatch.setattr(settings, "OIDC_ALLOW_INSECURE", False)
    monkeypatch.setattr(settings, "PUBLIC_BASE_URL", "https://ttx.acme.com")
    oidc_service._discovery_cache.clear()
    oidc_service._jwk_clients.clear()


@pytest.fixture(autouse=True)
def _no_background_loops(monkeypatch: pytest.MonkeyPatch) -> None:
    """The app's lifespan runs no email or activity-log loop in tests: they
    would send (woken at once by NOTIFY) or forward behind a test's back.
    Tests drive deliver_pending / forward rounds themselves;
    test_process_roles.py covers the loops' wiring."""
    from contextlib import asynccontextmanager

    from app import main

    @asynccontextmanager
    async def no_loops():
        yield

    monkeypatch.setattr(main, "background_loops", no_loops)


@pytest.fixture(autouse=True)
def _no_run_caches(monkeypatch: pytest.MonkeyPatch) -> None:
    """The Playground's per-process caches (who is present, the Players'
    shared view) start off, so a test sees each change at once; the tests
    of the caches turn them on."""
    monkeypatch.setattr(settings, "RUN_PRESENCE_CACHE_SECONDS", 0.0)
    monkeypatch.setattr(settings, "RUN_VIEW_CACHE_SECONDS", 0.0)
    monkeypatch.setattr(settings, "INSTANCE_CACHE_SECONDS", 0.0)


@pytest.fixture(autouse=True)
def _unpinned_assistant(monkeypatch: pytest.MonkeyPatch) -> None:
    """The AI assistant's switch is set from the web (off), whatever the
    local .env pins."""
    monkeypatch.setattr(settings, "ASSISTANT_ENABLED", None)


@pytest.fixture(scope="session", autouse=True)
def _prepare_schema() -> Generator[None, None, None]:
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _truncate_tables() -> Generator[None, None, None]:
    yield
    with Session(engine) as session:
        session.exec(
            text(
                "TRUNCATE TABLE login_throttle, email_outbox, ttx_access_request, "
                "invitation_token_redemption, invitation_token, ttx_access, ttx, "
                'organization_membership, organization, "user" '
                "RESTART IDENTITY CASCADE"
            )
        )
        session.commit()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


@pytest.fixture
def next_release(tmp_path, monkeypatch):
    """A fake ATT&CK v99.0 next to the real v19.2: T1566 revoked by
    T1566.001, T1490 deprecated, T1021 moved from Lateral Movement to
    Stealth, group G9998 new and G0049 gone, the rest unchanged."""
    import json

    from app.data import attack_catalog
    from app.services import ttx_msel_service as msel_service

    for domain in ("enterprise", "ics"):
        raw = json.loads((attack_catalog._DIR / f"{domain}-v19.2.json").read_text())
        raw["version"] = "99.0"
        if domain == "enterprise":
            raw["techniques"] = [t for t in raw["techniques"] if t["id"] != "T1566"]
            raw["revoked"]["T1566"] = "T1566.001"
            for technique in raw["techniques"]:
                if technique["id"] == "T1490":
                    technique["deprecated"] = True
                if technique["id"] == "T1021":
                    technique["tactics"] = ["TA0005"]
            for group in raw["groups"]:
                group["techniques"] = [
                    "T1566.001" if t == "T1566" else t for t in group["techniques"]
                ]
            raw["groups"].append(
                {"id": "G9998", "name": "Newcomer", "aliases": [], "techniques": ["T1486"]}
            )
        raw["groups"] = [g for g in raw["groups"] if g["id"] != "G0049"]
        raw["revoked_groups"] = {k: v for k, v in raw["revoked_groups"].items() if v != "G0049"}
        (tmp_path / f"{domain}-v99.0.json").write_text(json.dumps(raw))
        (tmp_path / f"{domain}-v19.2.json").write_text(
            (attack_catalog._DIR / f"{domain}-v19.2.json").read_text()
        )
    monkeypatch.setattr(attack_catalog, "_DIR", tmp_path)
    monkeypatch.setattr(attack_catalog, "ATTACK_VERSIONS", ("19.2", "99.0"))
    monkeypatch.setattr(msel_service, "ATTACK_VERSIONS", ("19.2", "99.0"))
    monkeypatch.setattr(msel_service.upgrade_attack, "__defaults__", ("99.0",))
    attack_catalog.load_domain.cache_clear()
    attack_catalog.load_groups.cache_clear()
    yield
    attack_catalog.load_domain.cache_clear()
    attack_catalog.load_groups.cache_clear()


@pytest.fixture
def assistant_planner(client: TestClient, db_session: Session) -> dict:
    """An organization's founder (Program Manager and Planner, TOTP on)
    with one exercise, signed in, the assistant on."""
    from tests.assistant_helpers import enable_assistant
    from tests.test_ttx_needs_form import _create_ttx, _manager

    owner = _manager(client, db_session, "planner@acme.com", "Acme")
    ttx = _create_ttx(client, owner["organization"]["id"])
    enable_assistant(db_session)
    return {"owner": owner, "ttx": ttx}
