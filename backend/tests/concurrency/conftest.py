from collections.abc import Callable, Iterator, Sequence
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from itertools import count
from threading import Barrier

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, col, func, select

from app.core.config import get_settings
from app.core.database import build_engine
from app.modules.events.models import Event, EventStatus
from app.modules.registrations.models import EventRegistration, RegistrationStatus
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User, UserRole
from app.shared.datetimes import utc_now
from app.shared.models import id_of

WORKERS = 40
_DATA_TABLES = (
    "registration_status_history",
    "event_registrations",
    "session_interests",
    "session_speakers",
    "sessions",
    "events",
    "speakers",
    "rooms",
    "venues",
    "user_roles",
    "users",
)

_emails = count()

type Call[T] = Callable[[Session], T]


@pytest.fixture
def engine(test_engine: Engine) -> Iterator[Engine]:
    """An engine like the app's, with a connection per worker.

    These tests commit for real, so the data is wiped afterwards: the other
    database tests expect empty tables.
    """
    url = get_settings().test_database_url
    assert url is not None
    engine = build_engine(url, pool_size=WORKERS, max_overflow=0)
    yield engine
    engine.dispose()
    with test_engine.begin() as connection:
        connection.execute(
            text(f"TRUNCATE {', '.join(_DATA_TABLES)} RESTART IDENTITY CASCADE")
        )


def make_users(engine: Engine, how_many: int, *roles: RoleCode) -> list[int]:
    with Session(engine) as session:
        users = [
            User(
                email=f"user{next(_emails)}@example.com",
                password_hash="x",
                full_name="U",
            )
            for _ in range(how_many)
        ]
        session.add_all(users)
        session.flush()
        for code in roles:
            role = users_repository.get_role(session, code)
            session.add_all(
                UserRole(user_id=id_of(user), role_id=id_of(role)) for user in users
            )
        session.commit()
        return [id_of(user) for user in users]


def make_event(
    engine: Engine,
    *,
    capacity: int,
    confirmed: Sequence[int] = (),
    waitlisted: Sequence[int] = (),
    owner_id: int | None = None,
    venue_id: int | None = None,
) -> int:
    owner = owner_id or make_users(engine, 1, RoleCode.ORGANIZER)[0]
    now = utc_now()
    with Session(engine) as session:
        event = Event(
            owner_id=owner,
            venue_id=venue_id,
            title="Concurrency",
            capacity=capacity,
            status=EventStatus.PUBLISHED,
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=2),
            timezone="America/Bogota",
            next_waitlist_order=len(waitlisted) + 1,
        )
        session.add(event)
        session.flush()
        session.add_all(
            EventRegistration(
                event_id=id_of(event),
                user_id=user_id,
                status=RegistrationStatus.CONFIRMED,
                confirmed_at=now,
            )
            for user_id in confirmed
        )
        session.add_all(
            EventRegistration(
                event_id=id_of(event),
                user_id=user_id,
                status=RegistrationStatus.WAITLISTED,
                waitlist_order=order,
                waitlisted_at=now,
            )
            for order, user_id in enumerate(waitlisted, start=1)
        )
        session.commit()
        return id_of(event)


def run_together[T](engine: Engine, calls: Sequence[Call[T]]) -> list[T | Exception]:
    """Run each call in its own thread and transaction, all released at once.

    A lock timeout (the API's 503) is retried, as a client would: the
    operations are idempotent, so the final state must be the same.
    """
    barrier = Barrier(len(calls))

    def attempt(call: Call[T]) -> T | Exception:
        barrier.wait()
        for _ in range(5):
            with Session(engine) as session:
                try:
                    return call(session)
                except OperationalError:
                    session.rollback()
                except Exception as exc:
                    return exc
        raise AssertionError("still locked after 5 attempts")

    with ThreadPoolExecutor(max_workers=len(calls)) as pool:
        return list(pool.map(attempt, calls))


def user(session: Session, user_id: int) -> User:
    found = session.get(User, user_id)
    assert found is not None
    return found


def registrations(engine: Engine, event_id: int) -> dict[RegistrationStatus, list[int]]:
    """User ids per status; waitlisted ones in queue order."""
    with Session(engine) as session:
        rows = session.exec(
            select(EventRegistration.user_id, EventRegistration.status)
            .where(EventRegistration.event_id == event_id)
            .order_by(col(EventRegistration.waitlist_order), col(EventRegistration.id))
        ).all()
    grouped: dict[RegistrationStatus, list[int]] = {
        status: [] for status in RegistrationStatus
    }
    for user_id, status in rows:
        grouped[RegistrationStatus(status)].append(user_id)
    return grouped


def waitlist_orders(engine: Engine, event_id: int) -> list[int]:
    with Session(engine) as session:
        statement = (
            select(EventRegistration.waitlist_order)
            .where(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.WAITLISTED,
            )
            .order_by(col(EventRegistration.waitlist_order))
        )
        return [order for order in session.exec(statement).all() if order is not None]


def count_rows(engine: Engine, event_id: int) -> int:
    with Session(engine) as session:
        statement = select(func.count()).where(EventRegistration.event_id == event_id)
        return session.exec(statement).one()
