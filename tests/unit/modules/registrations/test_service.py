from datetime import datetime, timedelta
from unittest.mock import Mock

import pytest
from sqlmodel import Session

from app.modules.events import service as events_service
from app.modules.events.models import Event, EventStatus
from app.modules.registrations import repository as registrations_repository
from app.modules.registrations import service as registrations_service
from app.modules.registrations.models import (
    EventRegistration,
    RegistrationReason,
    RegistrationStatus,
)
from app.modules.sessions import repository as sessions_repository
from app.modules.users.models import User
from app.shared.datetimes import utc_now
from app.shared.exceptions import AppError

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")


def make_event(
    *,
    status: EventStatus = EventStatus.PUBLISHED,
    starts_at: datetime | None = None,
    registration_closes_at: datetime | None = None,
) -> Event:
    starts_at = starts_at or utc_now() + timedelta(days=5)
    return Event(
        id=42,
        owner_id=9,
        title="PyCon",
        capacity=10,
        status=status,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(days=1),
        registration_closes_at=registration_closes_at,
        timezone="America/Bogota",
        next_waitlist_order=7,
    )


def make_registration(
    status: RegistrationStatus, order: int | None = None
) -> EventRegistration:
    return EventRegistration(
        id=81,
        event_id=42,
        user_id=1,
        status=status,
        waitlist_order=order,
        requested_at=utc_now(),
    )


class Fake:
    """Records what the service asks the repositories to do."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.event = make_event()
        self.registration: EventRegistration | None = None
        self.confirmed = 0
        self.waiting = 0
        self.history: list[dict[str, object]] = []
        self.promoted: list[int] = []
        self.withdrawn: list[tuple[int, int]] = []
        self.session = Mock(spec=Session)
        self.session.add.side_effect = self._add
        patch = monkeypatch.setattr
        patch(events_service, "get_event", lambda *a, **k: self.event)
        patch(registrations_repository, "get_for_user", lambda *a: self.registration)
        patch(registrations_repository, "count_confirmed", lambda *a: self.confirmed)
        patch(registrations_repository, "promote_waitlisted", self._promote)
        patch(registrations_repository, "add_history", self._history)
        patch(
            registrations_repository,
            "get_with_position",
            lambda *a: (self.registration, None),
        )
        patch(
            sessions_repository,
            "withdraw_interests",
            lambda session, event_id, user_id: self.withdrawn.append(
                (event_id, user_id)
            ),
        )

    def _add(self, registration: EventRegistration) -> None:
        registration.id = 81
        registration.requested_at = utc_now()
        self.registration = registration

    def _promote(self, session: Session, event_id: int, *, limit: int) -> int:
        self.promoted.append(limit)
        promoted = min(limit, self.waiting)
        self.waiting -= promoted
        return promoted

    def _history(
        self, session: Session, registration: EventRegistration, **kwargs: object
    ) -> None:
        self.history.append({"to_status": registration.status, **kwargs})


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> Fake:
    return Fake(monkeypatch)


@pytest.mark.parametrize(
    ("confirmed", "waiting", "status", "reason", "order"),
    [
        (9, 0, RegistrationStatus.CONFIRMED, RegistrationReason.REGISTERED, None),
        (10, 0, RegistrationStatus.WAITLISTED, RegistrationReason.EVENT_FULL, 7),
        (9, 1, RegistrationStatus.WAITLISTED, RegistrationReason.EVENT_FULL, 7),
    ],
    ids=["free-seat", "full", "queue-takes-the-free-seat-first"],
)
def test_register_confirms_or_waitlists(
    fake: Fake,
    confirmed: int,
    waiting: int,
    status: RegistrationStatus,
    reason: RegistrationReason,
    order: int | None,
) -> None:
    fake.confirmed, fake.waiting = confirmed, waiting

    registration, created = registrations_service.register(fake.session, USER, 42)

    assert (created, registration.status) == (True, status)
    assert fake.history == [
        {
            "to_status": status,
            "from_status": None,
            "reason": reason,
            "waitlist_order": order,
            "changed_by": 1,
        }
    ]
    assert fake.event.next_waitlist_order == (8 if order else 7)
    fake.session.commit.assert_called_once()


def test_re_registering_after_cancelling_goes_to_the_back_of_the_queue(
    fake: Fake,
) -> None:
    fake.registration = make_registration(RegistrationStatus.CANCELLED)
    fake.confirmed = 10

    registrations_service.register(fake.session, USER, 42)

    assert (fake.registration.status, fake.registration.waitlist_order) == (
        RegistrationStatus.WAITLISTED,
        7,
    )
    assert fake.history[0]["from_status"] == RegistrationStatus.CANCELLED
    fake.session.add.assert_not_called()


@pytest.mark.parametrize(
    "status", [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED]
)
def test_retrying_returns_the_active_registration_even_after_closing(
    fake: Fake, status: RegistrationStatus
) -> None:
    fake.registration = make_registration(status, 3 if status == "WAITLISTED" else None)
    fake.event = make_event(status=EventStatus.COMPLETED)

    registration, created = registrations_service.register(fake.session, USER, 42)

    assert (created, registration.status) == (False, status)
    assert fake.history == []
    fake.session.commit.assert_not_called()


@pytest.mark.parametrize(
    ("event", "code"),
    [
        (make_event(status=EventStatus.CANCELLED), "event_not_open"),
        (make_event(status=EventStatus.DRAFT), "event_not_open"),
        (
            make_event(registration_closes_at=utc_now() - timedelta(minutes=1)),
            "registration_closed",
        ),
        (make_event(starts_at=utc_now() - timedelta(minutes=1)), "registration_closed"),
    ],
    ids=["cancelled", "draft", "deadline-passed", "started-without-deadline"],
)
def test_register_requires_an_open_published_event(
    fake: Fake, event: Event, code: str
) -> None:
    fake.event = event

    with pytest.raises(AppError) as info:
        registrations_service.register(fake.session, USER, 42)

    assert info.value.code == code
    assert fake.registration is None


@pytest.mark.parametrize(
    ("status", "order", "promoted"),
    [(RegistrationStatus.CONFIRMED, None, [1]), (RegistrationStatus.WAITLISTED, 4, [])],
    ids=["confirmed-frees-a-seat", "waitlisted-just-leaves"],
)
def test_cancel_frees_the_seat_for_the_queue_and_withdraws_interests(
    fake: Fake, status: RegistrationStatus, order: int | None, promoted: list[int]
) -> None:
    fake.registration = make_registration(status, order)
    fake.confirmed = 9

    registration = registrations_service.cancel(fake.session, USER, 42)

    assert (registration.status, fake.registration.waitlist_order) == (
        RegistrationStatus.CANCELLED,
        None,
    )
    assert fake.history[0] | {"to_status": None} == {
        "to_status": None,
        "from_status": status,
        "reason": RegistrationReason.USER_CANCELLED,
        "waitlist_order": order,
        "changed_by": 1,
    }
    assert (fake.promoted, fake.withdrawn) == (promoted, [(42, 1)])
    fake.session.commit.assert_called_once()


def test_cancel_after_registration_closed_but_before_start_is_allowed(
    fake: Fake,
) -> None:
    fake.registration = make_registration(RegistrationStatus.CONFIRMED)
    fake.event = make_event(registration_closes_at=utc_now() - timedelta(days=1))

    registration = registrations_service.cancel(fake.session, USER, 42)

    assert registration.status == RegistrationStatus.CANCELLED


@pytest.mark.parametrize(
    ("registration", "event", "code"),
    [
        (None, make_event(), "registration_not_found"),
        (
            make_registration(RegistrationStatus.CONFIRMED),
            make_event(starts_at=utc_now() - timedelta(minutes=1)),
            "cancellation_closed",
        ),
    ],
    ids=["never-registered", "event-started"],
)
def test_cancel_rejects(
    fake: Fake, registration: EventRegistration | None, event: Event, code: str
) -> None:
    fake.registration, fake.event = registration, event

    with pytest.raises(AppError) as info:
        registrations_service.cancel(fake.session, USER, 42)

    assert info.value.code == code
    fake.session.commit.assert_not_called()


def test_cancelling_twice_returns_the_cancelled_registration(fake: Fake) -> None:
    fake.registration = make_registration(RegistrationStatus.CANCELLED)

    registration = registrations_service.cancel(fake.session, USER, 42)

    assert registration.status == RegistrationStatus.CANCELLED
    assert fake.history == []
    fake.session.commit.assert_not_called()


def test_occupancy_derives_the_figures_from_the_counts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(events_service, "get_event", lambda *a, **k: make_event())
    monkeypatch.setattr(
        registrations_repository,
        "count_by_status",
        lambda *a: {
            RegistrationStatus.CONFIRMED: 3,
            RegistrationStatus.WAITLISTED: 2,
            RegistrationStatus.CANCELLED: 5,
        },
    )

    occupancy = registrations_service.get_occupancy(Mock(spec=Session), USER, 42)

    assert occupancy.model_dump() == {
        "event_id": 42,
        "capacity": 10,
        "confirmed": 3,
        "available": 7,
        "waitlisted": 2,
        "occupancy_percent": 30.0,
    }
