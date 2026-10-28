from pathlib import Path

import pytest
from sqlalchemy import make_url

from app.core.config import Settings

SETTINGS_VARS = (
    "APP_NAME",
    "DEBUG",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "POSTGRES_DB",
    "POSTGRES_TEST_DB",
    "JWT_SECRET_KEY",
)
JWT_SECRET_KEY = "jwt-test-secret-" + "x" * 16


@pytest.fixture(autouse=True)
def db_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in SETTINGS_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("POSTGRES_USER", "user")
    monkeypatch.setenv("POSTGRES_PASSWORD", "pg-pass")
    monkeypatch.setenv("POSTGRES_DB", "events")
    monkeypatch.setenv("JWT_SECRET_KEY", JWT_SECRET_KEY)


def load() -> Settings:
    return Settings(_env_file=None)  # pyright: ignore[reportCallIssue]


def test_builds_database_url_with_defaults() -> None:
    settings = load()

    assert settings.database_url.render_as_string(hide_password=False) == (
        "postgresql+psycopg://user:pg-pass@postgres:5432/events"
    )
    assert settings.test_database_url is None


def test_builds_test_database_url_with_custom_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POSTGRES_HOST", "localhost")
    monkeypatch.setenv("POSTGRES_PORT", "6543")
    monkeypatch.setenv("POSTGRES_TEST_DB", "events_test")

    url = load().test_database_url

    assert url is not None
    assert url.render_as_string(hide_password=False) == (
        "postgresql+psycopg://user:pg-pass@localhost:6543/events_test"
    )


def test_password_with_special_characters_survives_round_trip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    password = "p@ss:w/rd#?%!"
    monkeypatch.setenv("POSTGRES_PASSWORD", password)

    rendered = load().database_url.render_as_string(hide_password=False)

    assert make_url(rendered).password == password


def test_password_is_not_exposed() -> None:
    settings = load()

    assert "pg-pass" not in str(settings.database_url)
    for secret in ("pg-pass", JWT_SECRET_KEY):
        assert secret not in repr(settings)
        assert secret not in str(settings.model_dump())


def test_dotenv_file_is_read_and_environment_takes_precedence(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "POSTGRES_DB=from_file\n"
        "APP_NAME=Desde archivo\n"
        "DATABASE_URL=postgresql+psycopg://legacy:x@elsewhere/db\n"
    )
    monkeypatch.setenv("POSTGRES_DB", "from_env")

    settings = Settings(_env_file=env_file)  # pyright: ignore[reportCallIssue]

    assert settings.app_name == "Desde archivo"
    assert settings.database_url.database == "from_env"
