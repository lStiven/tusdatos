from collections.abc import Callable
from datetime import datetime, timedelta
from unittest.mock import Mock

import pytest
from psycopg import errors as pg_errors
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.modules.events import service as events_service
from app.modules.events.exceptions import EventNotFoundError
from app.modules.events.models import Event, EventStatus
from app.modules.registrations import repository as registrations_repository
from app.modules.registrations.models import EventRegistration, RegistrationStatus
from app.modules.sessions import repository as sessions_repository
from app.modules.sessions import service as sessions_service
from app.modules.sessions.models import EventSession, SessionStatus
from app.modules.sessions.schemas import SessionCreate, SessionUpdate
from app.modules.speakers import repository as speakers_repository
from app.modules.users.models import User
from app.modules.venues import repository as venues_repository
from app.modules.venues.models import Room, Venue
from app.shared.datetimes import utc_now
from app.shared.exceptions import AppError

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
START = utc_now() + timedelta(days=5)
DRAFT, SCHEDULED, CANCELLED = (
    SessionStatus.DRAFT,
    SessionStatus.SCHEDULED,
    SessionStatus.CANCELLED,
)


def at(hours: float) -> datetime:
    return START + timedelta(hours=hours)


class Fake:
    """An event at venue 7 with room 12 (50 seats) and speaker 3."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.event = Event(
            id=42,
            owner_id=9,
            venue_id=7,
            title="PyCon",
            capacity=100,
            status=EventStatus.PUBLISHED,
            starts_at=START,
            ends_at=at(8),
            timezone="UTC",
        )
        self.target = EventSession(
            id=57,
            event_id=42,
            room_id=12,
            title="Talk",
            capacity=10,
            status=DRAFT,
            starts_at=at(1),
            ends_at=at(2),
        )
        self.room = Room(id=12, venue_id=7, name="Big", capacity=50, is_active=True)
        self.venue = Venue(id=7, name="Main", is_active=True)
        self.registration: EventRegistration | None = EventRegistration(
            event_id=42, user_id=1, status=RegistrationStatus.CONFIRMED
        )
        self.busy: list[int] = []
        self.manager = True
        self.interested = 0
        self.calls: list[str] = []
        self.session = Mock(spec=Session)
        patch = monkeypatch.setattr
        patch(events_service, "get_managed_event", lambda *a: self.event)
        patch(events_service, "get_event", lambda *a: self.event)
        patch(events_service, "can_see_drafts", lambda *a: self.manager)
        patch(sessions_repository, "get_event_id", lambda *a: 42)
        patch(sessions_repository, "get_session", self._get_session)
        patch(sessions_repository, "get_speaker_ids", lambda *a: {3})
        patch(sessions_repository, "busy_speakers", self._busy)
        patch(sessions_repository, "speakers_by_session", lambda *a: {})
        patch(sessions_repository, "list_views", self._views)
        for name in ("set_speakers", "add_interest", "withdraw_session_interests"):
            patch(sessions_repository, name, self._recorder(name))
        patch(venues_repository, "lock_rooms_by_id", self._lock_rooms)
        patch(venues_repository, "get_venue", lambda *a: self.venue)
        patch(speakers_repository, "lock_speakers", lambda s, ids: {3} & set(ids))
        patch(registrations_repository, "get_for_user", self._get_registration)

    def _recorder(self, name: str) -> Callable[..., None]:
        return lambda *args: self.calls.append(f"{name}{list(args[2:])}")

    def _get_session(
        self, session: Session, session_id: int, **lock: bool
    ) -> EventSession:
        self.calls.append(f"get_session{sorted(k for k, v in lock.items() if v)}")
        return self.target

    def _get_registration(
        self, *args: object, for_share: bool = False
    ) -> EventRegistration | None:
        self.calls.append(f"get_for_user{['for_share'] if for_share else []}")
        return self.registration

    def _lock_rooms(self, session: Session, room_ids: set[int]) -> dict[int, Room]:
        return {12: self.room} if 12 in room_ids else {}

    def _busy(self, *args: object, **kwargs: object) -> list[int]:
        self.calls.append("busy_speakers")
        return self.busy

    def _views(self, *args: object) -> list[tuple[EventSession, Room, int, bool]]:
        return [(self.target, self.room, self.interested, False)]


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> Fake:
    return Fake(monkeypatch)


def create(fake: Fake, **fields: object) -> object:
    data = SessionCreate.model_validate(
        {"title": "Talk", "capacity": 10, "starts_at": at(1), "ends_at": at(2)} | fields
    )
    return sessions_service.create_session(fake.session, USER, 42, data)


def test_create_saves_a_draft_without_booking_checks(fake: Fake) -> None:
    fake.session.add.side_effect = lambda created: setattr(created, "id", 58)

    create(fake, room_id=12, speaker_ids=[3, 3])

    added = fake.session.add.call_args.args[0]
    assert (added.status, added.room_id) == (DRAFT, 12)
    assert fake.calls[0] == "set_speakers[{3}]"
    assert "busy_speakers" not in fake.calls
    fake.session.commit.assert_called_once()


@pytest.mark.parametrize(
    ("fields", "venue_id", "code"),
    [
        ({"starts_at": at(2), "ends_at": at(1)}, 7, "invalid_session_schedule"),
        ({"starts_at": at(-1)}, 7, "session_outside_event"),
        ({"ends_at": at(9)}, 7, "session_outside_event"),
        ({"room_id": 99}, 7, "room_not_in_event_venue"),
        ({"room_id": 12}, None, "room_not_in_event_venue"),
        ({"speaker_ids": [3, 4]}, 7, "speaker_not_found"),
    ],
)
def test_create_validates_dates_room_and_speakers(
    fake: Fake, fields: dict[str, object], venue_id: int | None, code: str
) -> None:
    fake.event.venue_id = venue_id

    with pytest.raises(AppError) as raised:
        create(fake, **fields)

    assert raised.value.code == code
    fake.session.commit.assert_not_called()


@pytest.mark.parametrize(
    ("setup", "code"),
    [
        (lambda f: setattr(f.target, "room_id", None), "session_requires_room"),
        (lambda f: setattr(f.room, "is_active", False), "room_inactive"),
        (lambda f: setattr(f.venue, "is_active", False), "room_inactive"),
        (lambda f: setattr(f.target, "capacity", 51), "capacity_exceeds_room"),
        (lambda f: f.busy.append(3), "speaker_not_available"),
    ],
)
def test_schedule_checks_the_room_and_the_speakers(
    fake: Fake, setup: Callable[[Fake], None], code: str
) -> None:
    setup(fake)

    with pytest.raises(AppError) as raised:
        schedule(fake)

    assert raised.value.code == code
    assert fake.target.status == DRAFT


def test_schedule_books_the_room_and_a_retry_changes_nothing(fake: Fake) -> None:
    schedule(fake)
    schedule(fake)

    assert fake.target.status == SCHEDULED
    assert fake.calls.count("busy_speakers") == 1
    fake.session.commit.assert_called_once()


def integrity_error(constraint: str) -> IntegrityError:
    orig = Mock(spec=pg_errors.ExclusionViolation)
    orig.diag.constraint_name = constraint
    return IntegrityError("UPDATE", {}, orig)


def test_the_room_exclusion_constraint_means_room_not_available(fake: Fake) -> None:
    fake.session.flush.side_effect = integrity_error("ex_sessions_room_schedule")

    with pytest.raises(AppError) as raised:
        schedule(fake)

    assert raised.value.code == "room_not_available"
    fake.session.rollback.assert_called_once()


@pytest.mark.parametrize(
    ("changes", "code"),
    [
        ({"room_id": None}, "session_requires_room"),
        ({"capacity": 60}, "capacity_exceeds_room"),
    ],
)
def test_update_of_a_scheduled_session_is_checked_again(
    fake: Fake, changes: dict[str, object], code: str
) -> None:
    fake.target.status = SCHEDULED

    with pytest.raises(AppError) as raised:
        sessions_service.update_session(
            fake.session, USER, 57, SessionUpdate.model_validate(changes)
        )

    assert raised.value.code == code
    fake.session.commit.assert_not_called()


@pytest.mark.parametrize(
    ("changes", "calls"),
    [({"speaker_ids": []}, ["set_speakers[set()]"]), ({"title": "New"}, [])],
)
def test_update_replaces_the_speakers_only_when_sent(
    fake: Fake, changes: dict[str, object], calls: list[str]
) -> None:
    sessions_service.update_session(
        fake.session, USER, 57, SessionUpdate.model_validate(changes)
    )

    assert [c for c in fake.calls if c.startswith("set_speakers")] == calls
    fake.session.commit.assert_called_once()


type Operation = Callable[[Fake], object]


def update(fake: Fake) -> object:
    return sessions_service.update_session(
        fake.session, USER, 57, SessionUpdate(title="New")
    )


def schedule(fake: Fake) -> object:
    return sessions_service.schedule_session(fake.session, USER, 57)


def unschedule(fake: Fake) -> object:
    return sessions_service.unschedule_session(fake.session, USER, 57)


def cancel(fake: Fake) -> object:
    return sessions_service.cancel_session(fake.session, USER, 57)


def get(fake: Fake) -> object:
    return sessions_service.get_session(fake.session, USER, 57)


def mark(fake: Fake) -> object:
    return sessions_service.mark_interest(fake.session, USER, 57)


@pytest.mark.parametrize("operation", [update, schedule, unschedule])
def test_cancelled_sessions_are_final(fake: Fake, operation: Operation) -> None:
    fake.target.status = CANCELLED

    with pytest.raises(AppError) as raised:
        operation(fake)

    assert raised.value.code == "session_cancelled"


@pytest.mark.parametrize("operation", [update, schedule, cancel])
def test_changes_need_an_editable_event(fake: Fake, operation: Operation) -> None:
    fake.event.status = EventStatus.COMPLETED

    with pytest.raises(AppError) as raised:
        operation(fake)

    assert raised.value.code == "event_not_editable"


def test_cancel_locks_the_session_and_withdraws_interests_once(fake: Fake) -> None:
    cancel(fake)
    cancel(fake)

    assert fake.target.status == CANCELLED
    assert fake.calls.count("get_session['for_update']") == 2
    assert fake.calls.count("withdraw_session_interests[]") == 1
    fake.session.commit.assert_called_once()


def test_unschedule_releases_the_room_and_a_retry_changes_nothing(fake: Fake) -> None:
    fake.target.status = SCHEDULED

    unschedule(fake)
    unschedule(fake)

    assert fake.target.status == DRAFT
    fake.session.commit.assert_called_once()


@pytest.mark.parametrize("operation", [get, update, mark])
def test_a_session_of_a_hidden_event_is_not_found(
    fake: Fake, monkeypatch: pytest.MonkeyPatch, operation: Operation
) -> None:
    def hidden(*args: object) -> Event:
        raise EventNotFoundError()

    monkeypatch.setattr(events_service, "get_event", hidden)
    monkeypatch.setattr(events_service, "get_managed_event", hidden)

    with pytest.raises(AppError) as raised:
        operation(fake)

    assert raised.value.code == "session_not_found"


def test_mark_interest_locks_the_registration_before_the_session(fake: Fake) -> None:
    fake.target.status = SCHEDULED

    mark(fake)

    assert fake.calls == [
        "get_for_user['for_share']",
        "get_session['for_share']",
        "add_interest[57]",
    ]
    fake.session.commit.assert_called_once()


@pytest.mark.parametrize(
    ("setup", "code"),
    [
        (lambda f: setattr(f, "manager", False), "session_not_found"),
        (lambda f: None, "session_not_open"),
        (lambda f: setattr(f.target, "status", CANCELLED), "session_not_open"),
        (
            lambda f: (
                setattr(f.target, "status", SCHEDULED),
                setattr(f.target, "starts_at", utc_now() - timedelta(minutes=1)),
            ),
            "session_not_open",
        ),
        (
            lambda f: (
                setattr(f.target, "status", SCHEDULED),
                setattr(f, "registration", None),
            ),
            "registration_not_confirmed",
        ),
        (
            lambda f: (
                setattr(f.target, "status", SCHEDULED),
                setattr(f.registration, "status", RegistrationStatus.WAITLISTED),
            ),
            "registration_not_confirmed",
        ),
    ],
)
def test_interest_needs_a_confirmed_attendee_and_an_open_session(
    fake: Fake, setup: Callable[[Fake], object], code: str
) -> None:
    setup(fake)

    with pytest.raises(AppError) as raised:
        mark(fake)

    assert raised.value.code == code
    assert "add_interest[57]" not in fake.calls


@pytest.mark.parametrize(
    ("interested", "percent", "overdemand"),
    [(0, 0.0, False), (10, 100.0, False), (11, 110.0, True)],
)
def test_overdemand_means_more_interest_than_session_capacity(
    fake: Fake, interested: int, percent: float, overdemand: bool
) -> None:
    fake.interested = interested

    read = sessions_service.get_session(fake.session, USER, 57)

    assert (read.interest_percent, read.overdemand) == (percent, overdemand)
