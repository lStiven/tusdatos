from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.modules.venues import repository as venues_repository
from app.modules.venues.exceptions import (
    RoomCapacityBelowSessionsError,
    RoomHasScheduledSessionsError,
    RoomNameTakenError,
    RoomNotFoundError,
    VenueHasScheduledSessionsError,
    VenueNotFoundError,
)
from app.modules.venues.models import Room, Venue
from app.modules.venues.schemas import RoomCreate, RoomUpdate, VenueCreate, VenueUpdate
from app.shared.exceptions import violated_constraint


def create_venue(session: Session, data: VenueCreate) -> Venue:
    venue = Venue(**data.model_dump())
    session.add(venue)
    session.commit()
    session.refresh(venue)
    return venue


def list_venues(session: Session, *, is_active: bool | None) -> Sequence[Venue]:
    return venues_repository.list_venues(session, is_active=is_active)


def get_venue(session: Session, venue_id: int, *, for_update: bool = False) -> Venue:
    venue = venues_repository.get_venue(session, venue_id, for_update=for_update)
    if venue is None:
        raise VenueNotFoundError()
    return venue


def update_venue(session: Session, venue_id: int, data: VenueUpdate) -> Venue:
    venue = get_venue(session, venue_id, for_update=True)
    changes = data.model_dump(exclude_unset=True)
    if venue.is_active and changes.get("is_active") is False:
        venues_repository.lock_rooms(session, venue_id)
        if venues_repository.venue_has_upcoming_sessions(session, venue_id):
            raise VenueHasScheduledSessionsError()
    venue.sqlmodel_update(changes)
    session.commit()
    session.refresh(venue)
    return venue


def list_rooms(session: Session, venue_id: int) -> Sequence[Room]:
    get_venue(session, venue_id)
    return venues_repository.list_rooms(session, venue_id)


def create_room(session: Session, venue_id: int, data: RoomCreate) -> Room:
    get_venue(session, venue_id)
    return _save_room(session, Room(venue_id=venue_id, **data.model_dump()))


def update_room(
    session: Session, venue_id: int, room_id: int, data: RoomUpdate
) -> Room:
    room = venues_repository.get_room(session, venue_id, room_id, for_update=True)
    if room is None:
        raise RoomNotFoundError()
    changes = data.model_dump(exclude_unset=True)
    deactivating = room.is_active and changes.get("is_active") is False
    new_capacity: int = changes.get("capacity", room.capacity)
    if deactivating or new_capacity < room.capacity:
        largest = venues_repository.largest_upcoming_session(session, room_id)
        if largest is not None and deactivating:
            raise RoomHasScheduledSessionsError()
        if largest is not None and new_capacity < largest:
            raise RoomCapacityBelowSessionsError(
                f"An upcoming session in this room needs {largest} seats"
            )
    room.sqlmodel_update(changes)
    return _save_room(session, room)


def _save_room(session: Session, room: Room) -> Room:
    session.add(room)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        if violated_constraint(exc) == "uq_rooms_venue_id_name":
            raise RoomNameTakenError() from exc
        raise
    session.commit()
    session.refresh(room)
    return room
