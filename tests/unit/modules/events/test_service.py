from collections.abc import Callable
from datetime import datetime, timedelta
from unittest.mock import Mock

import pytest
from sqlmodel import Session

from app.modules.events import repository as events_repository
from app.modules.events import service as events_service
from app.modules.events.models import Event, EventStatus
from app.modules.events.schemas import EventUpdate
from app.modules.registrations import repository as registrations_repository
from app.modules.registrations.models import RegistrationReason
from app.modules.sessions import repository as sessions_repository
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User
from app.modules.venues import service as venues_service
from app.modules.venues.models import Venue
from app.shared.datetimes import utc_now
from app.shared.exceptions import AppError, NotFoundError
from app.shared.pagination import PageParams

VIEWER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
FUTURE = utc_now() + timedelta(days=30)


def make_event(
    status: EventStatus = EventStatus.DRAFT,
    owner_id: int = 1,
    *,
    starts_at: datetime = FUTURE,
    venue_id: int | None = 7,
) -> Event:
    return Event(
        id=42,
        owner_id=owner_id,
        venue_id=venue_id,
        title="PyCon",
        capacity=100,
        status=status,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(days=1),
        timezone="America/Bogota",
    )


def grant(monkeypatch: pytest.MonkeyPatch, *roles: RoleCode) -> None:
    monkeypatch.setattr(
        users_repository, "get_role_codes", lambda session, user_id: list(roles)
    )


@pytest.fixture
def stored(monkeypatch: pytest.MonkeyPatch) -> Callable[[Event], Event]:
    """Make the repository return the given event, as its owner (an organizer)."""
    grant(monkeypatch, RoleCode.ORGANIZER)
    monkeypatch.setattr(sessions_repository, "has_sessions_outside", lambda *a: False)
    monkeypatch.setattr(sessions_repository, "has_scheduled", lambda *a: False)
    monkeypatch.setattr(
        venues_service, "get_venue", lambda *a: Venue(id=8, name="B", is_active=True)
    )

    def store(event: Event) -> Event:
        monkeypatch.setattr(events_repository, "get_event", lambda *a, **k: event)
        return event

    return store


@pytest.mark.parametrize(
    ("status", "owner_id", "roles", "visible"),
    [
        (EventStatus.CANCELLED, 9, (RoleCode.ATTENDEE,), True),
        (EventStatus.DRAFT, 1, (RoleCode.ORGANIZER,), True),
        (EventStatus.DRAFT, 9, (RoleCode.ADMIN,), True),
        (EventStatus.DRAFT, 9, (RoleCode.ORGANIZER,), False),
    ],
    ids=["not-draft", "own-draft", "admin", "someone-elses-draft"],
)
def test_get_event_hides_other_peoples_drafts(
    monkeypatch: pytest.MonkeyPatch,
    status: EventStatus,
    owner_id: int,
    roles: tuple[RoleCode, ...],
    visible: bool,
) -> None:
    event = make_event(status, owner_id)
    monkeypatch.setattr(events_repository, "get_event", lambda *a, **k: event)
    grant(monkeypatch, *roles)

    if visible:
        assert events_service.get_event(Mock(spec=Session), VIEWER, 42) is event
    else:
        with pytest.raises(NotFoundError) as info:
            events_service.get_event(Mock(spec=Session), VIEWER, 42)
        assert info.value.code == "event_not_found"


@pytest.mark.parametrize(
    ("roles", "mine", "viewer_id", "owner_id"),
    [
        ((RoleCode.ORGANIZER,), False, 1, None),
        ((RoleCode.ADMIN,), False, None, None),
        ((RoleCode.ADMIN,), True, None, 1),
    ],
    ids=["non-admin-sees-own-drafts", "admin-sees-all", "mine"],
)
def test_list_events_scopes_drafts_to_the_viewer(
    monkeypatch: pytest.MonkeyPatch,
    roles: tuple[RoleCode, ...],
    mine: bool,
    viewer_id: int | None,
    owner_id: int | None,
) -> None:
    received: list[tuple[int | None, int | None]] = []

    def list_events(
        session: Session, *, viewer_id: int | None, owner_id: int | None, **_: object
    ) -> tuple[list[Event], int]:
        received.append((viewer_id, owner_id))
        return [], 0

    monkeypatch.setattr(events_repository, "list_events", list_events)
    grant(monkeypatch, *roles)

    events_service.list_events(
        Mock(spec=Session),
        VIEWER,
        title=None,
        status=None,
        mine=mine,
        page=PageParams(),
    )

    assert received == [(viewer_id, owner_id)]


@pytest.mark.parametrize(
    ("owner_id", "roles", "allowed"),
    [
        (1, (RoleCode.ORGANIZER,), True),
        (9, (RoleCode.ORGANIZER,), False),
        (1, (RoleCode.ATTENDEE,), False),
        (9, (RoleCode.ADMIN,), True),
    ],
    ids=["organizer-owner", "other-organizer", "owner-without-role", "admin"],
)
def test_only_an_organizer_owner_or_an_admin_can_change_an_event(
    monkeypatch: pytest.MonkeyPatch,
    stored: Callable[[Event], Event],
    owner_id: int,
    roles: tuple[RoleCode, ...],
    allowed: bool,
) -> None:
    stored(make_event(EventStatus.PUBLISHED, owner_id=owner_id))
    grant(monkeypatch, *roles)
    session = Mock(spec=Session)

    if allowed:
        events_service.update_event(session, VIEWER, 42, EventUpdate(title="New"))
        session.commit.assert_called_once()
    else:
        with pytest.raises(AppError) as info:
            events_service.update_event(session, VIEWER, 42, EventUpdate(title="New"))
        assert info.value.code == "not_event_owner"
        session.commit.assert_not_called()


@pytest.mark.parametrize(
    ("status", "action", "code"),
    [
        (EventStatus.PUBLISHED, events_service.complete_event, "event_not_ended"),
        (
            EventStatus.COMPLETED,
            events_service.publish_event,
            "invalid_status_transition",
        ),
        (EventStatus.DRAFT, events_service.complete_event, "invalid_status_transition"),
        (
            EventStatus.COMPLETED,
            events_service.cancel_event,
            "invalid_status_transition",
        ),
        (EventStatus.CANCELLED, events_service.update_event, "event_not_editable"),
    ],
    ids=["complete-early", "republish", "complete-draft", "cancel-done", "edit-final"],
)
def test_rejects_disallowed_status_changes(
    stored: Callable[[Event], Event],
    status: EventStatus,
    action: Callable[..., Event],
    code: str,
) -> None:
    stored(make_event(status))
    args = (EventUpdate(),) if action is events_service.update_event else ()

    with pytest.raises(AppError) as info:
        action(Mock(spec=Session), VIEWER, 42, *args)

    assert info.value.code == code


@pytest.mark.parametrize(
    "action",
    [
        events_service.publish_event,
        events_service.complete_event,
        events_service.cancel_event,
    ],
)
def test_repeating_a_transition_returns_the_event_unchanged(
    stored: Callable[[Event], Event], action: Callable[..., Event]
) -> None:
    target = {
        events_service.publish_event: EventStatus.PUBLISHED,
        events_service.complete_event: EventStatus.COMPLETED,
        events_service.cancel_event: EventStatus.CANCELLED,
    }[action]
    event, session = stored(make_event(target)), Mock(spec=Session)

    assert action(session, VIEWER, 42) is event
    session.commit.assert_not_called()


@pytest.mark.parametrize(
    ("event", "venue_active", "code"),
    [
        (make_event(venue_id=None), True, "event_requires_venue"),
        (make_event(), False, "venue_inactive"),
        (
            make_event(starts_at=utc_now() - timedelta(hours=1)),
            True,
            "event_already_started",
        ),
    ],
    ids=["no-venue", "inactive-venue", "started"],
)
def test_publish_requires_an_active_venue_and_a_future_start(
    monkeypatch: pytest.MonkeyPatch,
    stored: Callable[[Event], Event],
    event: Event,
    venue_active: bool,
    code: str,
) -> None:
    stored(event)
    monkeypatch.setattr(
        venues_service,
        "get_venue",
        lambda *a: Venue(id=7, name="A", is_active=venue_active),
    )

    with pytest.raises(AppError) as info:
        events_service.publish_event(Mock(spec=Session), VIEWER, 42)

    assert info.value.code == code


def test_publish_moves_a_ready_draft_to_published(
    stored: Callable[[Event], Event],
) -> None:
    event, session = stored(make_event()), Mock(spec=Session)

    events_service.publish_event(session, VIEWER, 42)

    assert event.status == EventStatus.PUBLISHED
    session.commit.assert_called_once()


def test_cancel_cancels_registrations_and_sessions_in_the_same_transaction(
    monkeypatch: pytest.MonkeyPatch, stored: Callable[[Event], Event]
) -> None:
    event, session, calls = stored(make_event(EventStatus.PUBLISHED)), Mock(), []
    monkeypatch.setattr(
        registrations_repository,
        "cancel_active",
        lambda session, event_id, **kwargs: calls.append(("registrations", kwargs)),
    )
    monkeypatch.setattr(
        sessions_repository,
        "cancel_for_event",
        lambda session, event_id: calls.append(("sessions", event_id)),
    )
    session.commit.side_effect = lambda: calls.append(("commit", event.status))

    events_service.cancel_event(session, VIEWER, 42)

    assert calls == [
        (
            "registrations",
            {"changed_by": 1, "reason": RegistrationReason.EVENT_CANCELLED},
        ),
        ("sessions", 42),
        ("commit", EventStatus.CANCELLED),
    ]


@pytest.mark.parametrize(
    ("changes", "status", "outside", "scheduled", "code"),
    [
        (
            {"ends_at": FUTURE},
            EventStatus.DRAFT,
            False,
            False,
            "invalid_event_schedule",
        ),
        (
            {"registration_closes_at": FUTURE + timedelta(days=2)},
            EventStatus.DRAFT,
            False,
            False,
            "invalid_event_schedule",
        ),
        (
            {"starts_at": FUTURE + timedelta(hours=1)},
            EventStatus.DRAFT,
            True,
            False,
            "sessions_outside_event",
        ),
        (
            {"venue_id": None},
            EventStatus.PUBLISHED,
            False,
            False,
            "event_requires_venue",
        ),
        (
            {"venue_id": 8},
            EventStatus.DRAFT,
            False,
            True,
            "event_has_scheduled_sessions",
        ),
    ],
    ids=[
        "end-before-start",
        "closes-after-end",
        "sessions-outside",
        "drop-venue",
        "move-venue",
    ],
)
def test_update_guards_dates_and_venue(
    monkeypatch: pytest.MonkeyPatch,
    stored: Callable[[Event], Event],
    changes: dict[str, object],
    status: EventStatus,
    outside: bool,
    scheduled: bool,
    code: str,
) -> None:
    event = stored(make_event(status))
    monkeypatch.setattr(sessions_repository, "has_sessions_outside", lambda *a: outside)
    monkeypatch.setattr(sessions_repository, "has_scheduled", lambda *a: scheduled)

    with pytest.raises(AppError) as info:
        events_service.update_event(
            Mock(spec=Session), VIEWER, 42, EventUpdate.model_validate(changes)
        )

    assert info.value.code == code
    assert event.venue_id == 7


@pytest.mark.parametrize(
    ("capacity", "confirmed", "promoted"),
    [(120, 90, [30]), (90, 90, []), (70, 60, [])],
    ids=["grow-promotes-free-seats", "shrink-to-confirmed", "shrink-keeps-room"],
)
def test_capacity_changes_promote_the_waitlist_only_when_growing(
    monkeypatch: pytest.MonkeyPatch,
    stored: Callable[[Event], Event],
    capacity: int,
    confirmed: int,
    promoted: list[int],
) -> None:
    event = stored(make_event(EventStatus.PUBLISHED))
    monkeypatch.setattr(
        registrations_repository, "count_confirmed", lambda *a: confirmed
    )
    limits: list[int] = []
    monkeypatch.setattr(
        registrations_repository,
        "promote_waitlisted",
        lambda session, event_id, *, limit, **_: limits.append(limit),
    )

    events_service.update_event(
        Mock(spec=Session), VIEWER, 42, EventUpdate(capacity=capacity)
    )

    assert (event.capacity, limits) == (capacity, promoted)


def test_capacity_cannot_drop_below_confirmed(
    monkeypatch: pytest.MonkeyPatch, stored: Callable[[Event], Event]
) -> None:
    event = stored(make_event(EventStatus.PUBLISHED))
    monkeypatch.setattr(registrations_repository, "count_confirmed", lambda *a: 90)

    with pytest.raises(AppError) as info:
        events_service.update_event(
            Mock(spec=Session), VIEWER, 42, EventUpdate(capacity=89)
        )

    assert (info.value.code, info.value.message) == (
        "capacity_below_confirmed",
        "The event has 90 confirmed registrations",
    )
    assert event.capacity == 100
