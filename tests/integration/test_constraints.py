from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

import psycopg
import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel

from app.modules.events.models import Event
from app.modules.registrations.models import EventRegistration, RegistrationStatus
from app.modules.sessions.models import EventSession, SessionStatus
from app.modules.users.models import User
from app.modules.venues.models import Room, Venue
from app.shared.models import IdModel


def at(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, 27, hour, minute, tzinfo=UTC)


def id_of(row: IdModel) -> int:
    assert row.id is not None
    return row.id


@dataclass
class World:
    user_id: int
    other_user_id: int
    event_id: int
    room_id: int
    other_room_id: int


@pytest.fixture
def world(session: Session) -> World:
    users = [
        User(email=f"user{n}@example.com", password_hash="hash", full_name="User")
        for n in range(2)
    ]
    venue = Venue(name="Main venue")
    session.add_all([*users, venue])
    session.flush()
    rooms = [Room(venue_id=id_of(venue), name=name, capacity=50) for name in "AB"]
    event = Event(
        owner_id=id_of(users[0]),
        venue_id=id_of(venue),
        title="PyCon",
        capacity=100,
        starts_at=at(8),
        ends_at=at(18),
        timezone="America/Bogota",
    )
    session.add_all([*rooms, event])
    session.flush()
    return World(
        id_of(users[0]), id_of(users[1]), id_of(event), id_of(rooms[0]), id_of(rooms[1])
    )


def registration(
    w: World, user_id: int, status: RegistrationStatus, order: int | None = None
) -> EventRegistration:
    return EventRegistration(
        event_id=w.event_id,
        user_id=user_id,
        status=status,
        waitlist_order=order,
        waitlisted_at=at(9) if order else None,
    )


def talk(
    w: World, room_id: int | None, start: datetime, end: datetime, status: SessionStatus
) -> EventSession:
    return EventSession(
        event_id=w.event_id,
        room_id=room_id,
        title="Talk",
        capacity=10,
        status=status,
        starts_at=start,
        ends_at=end,
    )


SCHEDULED = SessionStatus.SCHEDULED
WAITLISTED = RegistrationStatus.WAITLISTED

Rows = Callable[[World], list[SQLModel]]


@pytest.mark.parametrize(
    ("rows", "constraint"),
    [
        (
            lambda w: [
                User(email="USER0@Example.com", password_hash="h", full_name="X")
            ],
            "uq_users_email_ci",
        ),
        (
            lambda w: [Room(venue_id=1, name="C", capacity=0)],
            "ck_rooms_capacity_positive",
        ),
        (
            lambda w: [
                Event(
                    owner_id=w.user_id,
                    title="Backwards",
                    capacity=1,
                    starts_at=at(10),
                    ends_at=at(9),
                    timezone="UTC",
                )
            ],
            "ck_events_valid_interval",
        ),
        (
            lambda w: [
                registration(w, w.user_id, RegistrationStatus.CONFIRMED),
                registration(w, w.user_id, RegistrationStatus.CONFIRMED),
            ],
            "uq_event_registrations_event_id_user_id",
        ),
        (
            lambda w: [registration(w, w.user_id, WAITLISTED)],
            "ck_event_registrations_waitlisted_has_order",
        ),
        (
            lambda w: [
                registration(w, w.user_id, WAITLISTED, order=1),
                registration(w, w.other_user_id, WAITLISTED, order=1),
            ],
            "uq_event_registrations_waitlist_order",
        ),
        (
            lambda w: [talk(w, None, at(9), at(10), SCHEDULED)],
            "ck_sessions_scheduled_has_room",
        ),
        (
            lambda w: [
                talk(w, w.room_id, at(9), at(10), SCHEDULED),
                talk(w, w.room_id, at(9, 30), at(10, 30), SCHEDULED),
            ],
            "ex_sessions_room_schedule",
        ),
    ],
    ids=[
        "email-case-insensitive",
        "room-capacity",
        "event-interval",
        "duplicate-registration",
        "waitlisted-without-order",
        "duplicate-waitlist-position",
        "scheduled-without-room",
        "room-overlap",
    ],
)
def test_database_rejects_rows_that_break_a_rule(
    session: Session, world: World, rows: Rows, constraint: str
) -> None:
    session.add_all(rows(world))

    with pytest.raises(IntegrityError) as exc_info:
        session.flush()

    assert isinstance(exc_info.value.orig, psycopg.Error)
    assert exc_info.value.orig.diag.constraint_name == constraint


@pytest.mark.parametrize(
    "rows",
    [
        lambda w: [
            talk(w, w.room_id, at(9), at(10), SCHEDULED),
            talk(w, w.room_id, at(10), at(11), SCHEDULED),
        ],
        lambda w: [
            talk(w, w.room_id, at(9), at(10), SCHEDULED),
            talk(w, w.other_room_id, at(9), at(10), SCHEDULED),
        ],
        lambda w: [
            talk(w, w.room_id, at(9), at(10), SCHEDULED),
            talk(w, w.room_id, at(9), at(10), SessionStatus.DRAFT),
        ],
        lambda w: [
            registration(w, w.user_id, WAITLISTED, order=1),
            registration(w, w.other_user_id, RegistrationStatus.CANCELLED, order=1),
        ],
    ],
    ids=[
        "back-to-back-same-room",
        "simultaneous-other-room",
        "draft-does-not-reserve-room",
        "cancelled-frees-waitlist-position",
    ],
)
def test_database_accepts_rows_the_rules_allow(
    session: Session, world: World, rows: Rows
) -> None:
    session.add_all(rows(world))

    session.flush()
