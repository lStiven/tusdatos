from collections.abc import Callable
from unittest.mock import Mock

import pytest
from sqlmodel import Session

from app.modules.venues import repository as venues_repository
from app.modules.venues import service as venues_service
from app.modules.venues.models import Room, Venue
from app.modules.venues.schemas import RoomUpdate, VenueUpdate
from app.shared.exceptions import ConflictError, NotFoundError


def make_room() -> Room:
    return Room(id=12, venue_id=7, name="A1", capacity=100)


@pytest.mark.parametrize(
    ("changes", "largest", "code"),
    [
        ({"is_active": False}, 80, "room_has_scheduled_sessions"),
        ({"capacity": 79}, 80, "room_capacity_below_sessions"),
    ],
    ids=["deactivate", "shrink-below-session"],
)
def test_update_room_protects_upcoming_sessions(
    monkeypatch: pytest.MonkeyPatch, changes: dict[str, object], largest: int, code: str
) -> None:
    monkeypatch.setattr(venues_repository, "get_room", lambda *a, **k: make_room())
    monkeypatch.setattr(
        venues_repository, "largest_upcoming_session", lambda session, room_id: largest
    )

    with pytest.raises(ConflictError) as info:
        venues_service.update_room(
            Mock(spec=Session), 7, 12, RoomUpdate.model_validate(changes)
        )

    assert info.value.code == code


@pytest.mark.parametrize(
    ("changes", "largest"),
    [({"capacity": 80}, 80), ({"is_active": False}, None), ({"capacity": 150}, 120)],
    ids=["shrink-to-session-size", "deactivate-unused", "grow"],
)
def test_update_room_applies_changes_that_keep_sessions_valid(
    monkeypatch: pytest.MonkeyPatch, changes: dict[str, object], largest: int | None
) -> None:
    room, session = make_room(), Mock(spec=Session)
    monkeypatch.setattr(venues_repository, "get_room", lambda *a, **k: room)
    monkeypatch.setattr(
        venues_repository, "largest_upcoming_session", lambda session, room_id: largest
    )

    venues_service.update_room(session, 7, 12, RoomUpdate.model_validate(changes))

    assert room.model_dump(include=set(changes)) == changes
    session.commit.assert_called_once()


def test_deactivating_a_venue_locks_its_rooms_before_checking_sessions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(
        venues_repository, "get_venue", lambda *a, **k: Venue(id=7, name="Ágora")
    )
    monkeypatch.setattr(
        venues_repository, "lock_rooms", lambda *a: calls.append("lock_rooms")
    )

    def has_sessions(session: Session, venue_id: int) -> bool:
        calls.append("check_sessions")
        return True

    monkeypatch.setattr(venues_repository, "venue_has_upcoming_sessions", has_sessions)

    with pytest.raises(ConflictError) as info:
        venues_service.update_venue(Mock(spec=Session), 7, VenueUpdate(is_active=False))

    assert info.value.code == "venue_has_scheduled_sessions"
    assert calls == ["lock_rooms", "check_sessions"]


@pytest.mark.parametrize(
    ("update", "code"),
    [
        (lambda s: venues_service.update_venue(s, 7, VenueUpdate()), "venue_not_found"),
        (
            lambda s: venues_service.update_room(s, 7, 12, RoomUpdate()),
            "room_not_found",
        ),
    ],
    ids=["venue", "room"],
)
def test_missing_resources_raise_not_found(
    monkeypatch: pytest.MonkeyPatch, update: Callable[[Session], object], code: str
) -> None:
    monkeypatch.setattr(venues_repository, "get_venue", lambda *a, **k: None)
    monkeypatch.setattr(venues_repository, "get_room", lambda *a, **k: None)

    with pytest.raises(NotFoundError) as info:
        update(Mock(spec=Session))

    assert info.value.code == code
