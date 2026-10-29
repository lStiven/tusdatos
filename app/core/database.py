from collections.abc import Iterator

from sqlalchemy import URL, Engine
from sqlmodel import Session, create_engine

from app.core.config import get_settings

settings = get_settings()


def build_engine(url: URL, *, pool_size: int = 5, max_overflow: int = 10) -> Engine:
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=10,
        pool_recycle=1800,
        hide_parameters=True,
        connect_args={
            "connect_timeout": 5,
            "application_name": settings.app_name,
            "options": (
                "-c statement_timeout=15s"
                " -c lock_timeout=5s"
                " -c idle_in_transaction_session_timeout=30s"
            ),
        },
    )


engine = build_engine(settings.database_url)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
