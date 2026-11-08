"""Settings read from the environment for a production deployment: required
secrets from files, and a database URL that survives any password."""

from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy.engine import make_url

from app.core.config import Settings


def test_required_secrets_can_come_from_files(tmp_path: Path) -> None:
    secret = tmp_path / "secret_key"
    secret.write_text("signing-key-from-a-file\n", encoding="utf-8")
    password = tmp_path / "db_password"
    password.write_text("db-password-from-a-file\n", encoding="utf-8")

    loaded = Settings(  # type: ignore[call-arg]
        _env_file=None,
        SECRET_KEY=None,
        SECRET_KEY_FILE=str(secret),
        POSTGRES_PASSWORD=None,
        POSTGRES_PASSWORD_FILE=str(password),
    )

    assert loaded.SECRET_KEY == "signing-key-from-a-file"
    assert loaded.POSTGRES_PASSWORD == "db-password-from-a-file"


def test_a_value_set_directly_wins_over_its_file(tmp_path: Path) -> None:
    secret = tmp_path / "secret_key"
    secret.write_text("from-the-file", encoding="utf-8")

    loaded = Settings(  # type: ignore[call-arg]
        _env_file=None, SECRET_KEY="set-directly", SECRET_KEY_FILE=str(secret)
    )

    assert loaded.SECRET_KEY == "set-directly"


def test_the_database_url_quotes_the_password() -> None:
    raw = "p@ss/w%rd:x?y#z"

    loaded = Settings(_env_file=None, POSTGRES_PASSWORD=raw)  # type: ignore[call-arg]

    url = make_url(loaded.DATABASE_URL)
    assert url.password == raw
    assert url.host == loaded.POSTGRES_HOST
    assert url.database == loaded.POSTGRES_DB


def test_a_server_refuses_the_example_secrets() -> None:
    for overrides in (
        {"SECRET_KEY": "change-me-generate-with-openssl-rand-hex-32"},
        {"SECRET_KEY": "too-short"},
        {"POSTGRES_PASSWORD": "change-me"},
    ):
        values = {"SECRET_KEY": "k" * 64, "POSTGRES_PASSWORD": "a-real-password", **overrides}
        with pytest.raises(ValidationError):
            Settings(_env_file=None, ENVIRONMENT="production", **values)  # type: ignore[call-arg]

    loaded = Settings(  # type: ignore[call-arg]
        _env_file=None, ENVIRONMENT="production", SECRET_KEY="k" * 64, POSTGRES_PASSWORD="real"
    )
    assert loaded.ENVIRONMENT == "production"


def test_development_keeps_the_example_secrets() -> None:
    loaded = Settings(  # type: ignore[call-arg]
        _env_file=None, ENVIRONMENT="development", SECRET_KEY="dev", POSTGRES_PASSWORD="change-me"
    )
    assert loaded.SECRET_KEY == "dev"


def test_production_is_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    loaded = Settings(_env_file=None, SECRET_KEY="k" * 64, POSTGRES_PASSWORD="real")  # type: ignore[call-arg]

    assert loaded.ENVIRONMENT == "production"
