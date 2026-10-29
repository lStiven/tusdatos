from collections.abc import Collection, Sequence

from sqlalchemy import ColumnElement
from sqlmodel import Session, col, func, select

from app.modules.sessions.models import EventSession, SessionStatus
from app.modules.venues.models import Room, Venue
from app.shared.models import id_of


def get_venue(
    session: Session, venue_id: int, *, for_update: bool = False
) -> Venue | None:
    return session.get(Venue, venue_id, with_for_update=for_update)


def list_venues(session: Session, *, is_active: bool | None) -> Sequence[Venue]:
    statement = select(Venue).order_by(col(Venue.name), col(Venue.id))
    if is_active is not None:
        statement = statement.where(Venue.is_active == is_active)
    return session.exec(statement).all()


def get_room(
    session: Session, venue_id: int, room_id: int, *, for_update: bool = False
) -> Room | None:
    statement = select(Room).where(Room.id == room_id, Room.venue_id == venue_id)
    if for_update:
        statement = statement.with_for_update()
    return session.exec(statement).first()


def list_rooms(session: Session, venue_id: int) -> Sequence[Room]:
    statement = (
        select(Room)
        .where(Room.venue_id == venue_id)
        .order_by(col(Room.name), col(Room.id))
    )
    return session.exec(statement).all()


def lock_rooms(session: Session, venue_id: int) -> None:
    statement = (
        select(Room.id)
        .where(Room.venue_id == venue_id)
        .order_by(col(Room.id))
        .with_for_update()
    )
    session.exec(statement).all()


def lock_rooms_by_id(session: Session, room_ids: Collection[int]) -> dict[int, Room]:
    if not room_ids:
        return {}
    statement = (
        select(Room)
        .where(col(Room.id).in_(room_ids))
        .order_by(col(Room.id))
        .with_for_update()
    )
    return {id_of(room): room for room in session.exec(statement).all()}


def _upcoming_scheduled() -> tuple[ColumnElement[bool], ...]:
    return (
        col(EventSession.status) == SessionStatus.SCHEDULED,
        col(EventSession.ends_at) > func.now(),
    )


def venue_has_upcoming_sessions(session: Session, venue_id: int) -> bool:
    statement = (
        select(EventSession.id)
        .join(Room, col(EventSession.room_id) == col(Room.id))
        .where(Room.venue_id == venue_id, *_upcoming_scheduled())
        .limit(1)
    )
    return session.exec(statement).first() is not None


def largest_upcoming_session(session: Session, room_id: int) -> int | None:
    statement = select(func.max(EventSession.capacity)).where(
        EventSession.room_id == room_id, *_upcoming_scheduled()
    )
    return session.exec(statement).one()
