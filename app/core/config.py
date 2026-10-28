from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Mis Eventos API"
    debug: bool = False
    cors_origins: list[str] = []

    jwt_secret_key: SecretStr = Field(min_length=32)
    access_token_expire_minutes: int = 30

    postgres_user: str = ""
    postgres_password: SecretStr = SecretStr("")
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = ""
    postgres_test_db: str | None = None

    @property
    def database_url(self) -> URL:
        return self._postgres_url(self.postgres_db)

    @property
    def test_database_url(self) -> URL | None:
        if self.postgres_test_db is None:
            return None
        return self._postgres_url(self.postgres_test_db)

    def _postgres_url(self, database: str) -> URL:
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=database,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore
