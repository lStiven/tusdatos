from collections.abc import Iterator

from sqlmodel import Session, create_engine

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
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


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
