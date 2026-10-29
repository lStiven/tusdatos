"""Scheduling and interest under concurrency: docs/01 §13 and docs/04 §11."""

from collections.abc import Collection, Sequence
from contextlib import suppress
from datetime import datetime, timedelta
from threading import Barrier, BrokenBarrierError

import pytest
from sqlalchemy import Engine
from sqlmodel import Session, col, select

from app.modules.registrations import service as registrations_service
from app.modules.sessions import repository as sessions_repository
from app.modules.sessions import service as sessions_service
from app.modules.sessions.exceptions import (
    RoomNotAvailableError,
    SpeakerNotAvailableError,
)
from app.modules.sessions.models import (
    EventSession,
    SessionInterest,
    SessionSpeaker,
    SessionStatus,
)
from app.modules.speakers.models import Speaker
from app.modules.users.models import RoleCode
from app.modules.venues.models import Room, Venue
from app.shared.datetimes import utc_now
from app.shared.models import id_of
from tests.concurrency.conftest import Call, make_event, make_users, run_together, user

SCHEDULED = SessionStatus.SCHEDULED
CONTENDERS = 10
SLOT = utc_now() + timedelta(days=1, hours=1)


def make_venue(engine: Engine, rooms: int) -> tuple[int, list[int]]:
    with Session(engine) as session:
        venue = Venue(name="Venue")
        session.add(venue)
        session.flush()
        made = [
            Room(venue_id=id_of(venue), name=f"Room {n}", capacity=100)
            for n in range(rooms)
        ]
        session.add_all(made)
        session.commit()
        return id_of(venue), [id_of(room) for room in made]


def make_sessions(
    engine: Engine,
    event_ids: Sequence[int],
    room_ids: Sequence[int],
    *,
    speaker_id: int | None = None,
    status: SessionStatus = SessionStatus.DRAFT,
) -> list[int]:
    """One session per (event, room) pair, all at the same time."""
    with Session(engine) as session:
        made = [
            EventSession(
                event_id=event_id,
                room_id=room_id,
                title="Talk",
                capacity=10,
                status=status,
                starts_at=SLOT,
                ends_at=SLOT + timedelta(hours=1),
            )
            for event_id, room_id in zip(event_ids, room_ids, strict=True)
        ]
        session.add_all(made)
        session.flush()
        if speaker_id is not None:
            session.add_all(
                SessionSpeaker(session_id=id_of(talk), speaker_id=speaker_id)
                for talk in made
            )
        session.commit()
        return [id_of(talk) for talk in made]


def make_speaker(engine: Engine) -> int:
    with Session(engine) as session:
        speaker = Speaker(full_name="Ada")
        session.add(speaker)
        session.commit()
        return id_of(speaker)


def schedule(admin_id: int, session_id: int) -> Call[SessionStatus]:
    return lambda session: (
        sessions_service.schedule_session(
            session, user(session, admin_id), session_id
        ).status
    )


def test_one_room_is_never_booked_twice_at_the_same_time(engine: Engine) -> None:
    (admin,) = make_users(engine, 1, RoleCode.ADMIN)
    venue_id, (room,) = make_venue(engine, 1)
    events = [make_event(engine, capacity=5, venue_id=venue_id) for _ in range(10)]
    talks = make_sessions(engine, events, [room] * 10)

    results = run_together(engine, [schedule(admin, talk) for talk in talks])

    assert results.count(SCHEDULED) == 1
    assert [type(r) for r in results if r != SCHEDULED] == [RoomNotAvailableError] * 9


def test_a_speaker_is_never_in_two_rooms_at_the_same_time(
    engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    (admin,) = make_users(engine, 1, RoleCode.ADMIN)
    venue_id, rooms = make_venue(engine, CONTENDERS)
    # One event per session, so only the speaker's lock serializes them.
    events = [
        make_event(engine, capacity=5, venue_id=venue_id) for _ in range(CONTENDERS)
    ]
    talks = make_sessions(engine, events, rooms, speaker_id=make_speaker(engine))
    checked = Barrier(CONTENDERS)
    busy_speakers = sessions_repository.busy_speakers

    def check_then_wait_for_the_others(
        session: Session,
        speaker_ids: Collection[int],
        starts_at: datetime,
        ends_at: datetime,
        *,
        exclude_session_id: int,
    ) -> Sequence[int]:
        # Holds every check open until all have run: without the lock they would
        # all see the speaker free. With it, only one gets here at a time, so
        # the wait times out once and the rest go through.
        busy = busy_speakers(
            session,
            speaker_ids,
            starts_at,
            ends_at,
            exclude_session_id=exclude_session_id,
        )
        with suppress(BrokenBarrierError):
            checked.wait(timeout=0.5)
        return busy

    monkeypatch.setattr(
        sessions_repository, "busy_speakers", check_then_wait_for_the_others
    )

    results = run_together(engine, [schedule(admin, talk) for talk in talks])

    assert results.count(SCHEDULED) == 1
    assert [type(r) for r in results if r != SCHEDULED] == (
        [SpeakerNotAvailableError] * (CONTENDERS - 1)
    )


def test_a_cancelled_registration_never_keeps_an_active_interest(
    engine: Engine,
) -> None:
    attendees = make_users(engine, 20)
    venue_id, (room,) = make_venue(engine, 1)
    event = make_event(engine, capacity=20, confirmed=attendees, venue_id=venue_id)
    (talk,) = make_sessions(engine, [event], [room], status=SCHEDULED)

    def mark(user_id: int) -> Call[None]:
        return lambda session: sessions_service.mark_interest(
            session, user(session, user_id), talk
        )

    def cancel(user_id: int) -> Call[object]:
        return lambda session: registrations_service.cancel(
            session, user(session, user_id), event
        )

    run_together(
        engine, [call for uid in attendees for call in (mark(uid), cancel(uid))]
    )

    with Session(engine) as session:
        active = session.exec(
            select(SessionInterest.user_id).where(
                SessionInterest.session_id == talk,
                col(SessionInterest.withdrawn_at).is_(None),
            )
        ).all()
    assert active == []
