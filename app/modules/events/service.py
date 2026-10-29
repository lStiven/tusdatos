from collections.abc import Sequence
from datetime import datetime

from sqlmodel import Session

from app.modules.events import repository as events_repository
from app.modules.events.exceptions import (
    CapacityBelowConfirmedError,
    EventAlreadyStartedError,
    EventHasScheduledSessionsError,
    EventNotEditableError,
    EventNotEndedError,
    EventNotFoundError,
    EventRequiresVenueError,
    InvalidEventScheduleError,
    InvalidStatusTransitionError,
    NotEventOwnerError,
    SessionsOutsideEventError,
    VenueInactiveError,
)
from app.modules.events.models import Event, EventStatus
from app.modules.events.schemas import EventCreate, EventUpdate
from app.modules.registrations import repository as registrations_repository
from app.modules.registrations.models import RegistrationReason
from app.modules.sessions import repository as sessions_repository
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User
from app.modules.venues import service as venues_service
from app.shared.datetimes import utc_now
from app.shared.models import id_of
from app.shared.pagination import PageParams

_EDITABLE = (EventStatus.DRAFT, EventStatus.PUBLISHED)
_ALLOWED_SOURCES = {
    EventStatus.PUBLISHED: {EventStatus.DRAFT},
    EventStatus.COMPLETED: {EventStatus.PUBLISHED},
    EventStatus.CANCELLED: {EventStatus.DRAFT, EventStatus.PUBLISHED},
}


def list_events(
    session: Session,
    viewer: User,
    *,
    title: str | None,
    status: EventStatus | None,
    mine: bool,
    page: PageParams,
) -> tuple[Sequence[Event], int]:
    return events_repository.list_events(
        session,
        viewer_id=None if _is_admin(session, viewer) else id_of(viewer),
        title=title,
        status=status,
        owner_id=id_of(viewer) if mine else None,
        limit=page.limit,
        offset=page.offset,
    )


def get_event(
    session: Session, viewer: User, event_id: int, *, for_update: bool = False
) -> Event:
    event = events_repository.get_event(session, event_id, for_update=for_update)
    if event is None or not _can_see(event, viewer, _is_admin(session, viewer)):
        raise EventNotFoundError()
    return event


def create_event(session: Session, owner: User, data: EventCreate) -> Event:
    _check_schedule(data.starts_at, data.ends_at, data.registration_closes_at)
    if data.venue_id is not None:
        _check_venue(session, data.venue_id)
    event = Event(owner_id=id_of(owner), **data.model_dump())
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


def update_event(
    session: Session, actor: User, event_id: int, data: EventUpdate
) -> Event:
    event = get_managed_event(session, actor, event_id)
    if event.status not in _EDITABLE:
        raise EventNotEditableError()
    changes = data.model_dump(exclude_unset=True)
    starts_at: datetime = changes.get("starts_at", event.starts_at)
    ends_at: datetime = changes.get("ends_at", event.ends_at)
    _check_schedule(
        starts_at,
        ends_at,
        changes.get("registration_closes_at", event.registration_closes_at),
    )
    if (
        starts_at != event.starts_at or ends_at != event.ends_at
    ) and sessions_repository.has_sessions_outside(
        session, id_of(event), starts_at, ends_at
    ):
        raise SessionsOutsideEventError()
    if "venue_id" in changes and changes["venue_id"] != event.venue_id:
        _check_venue_change(session, event, changes["venue_id"])
    free_seats = _free_seats_after(session, event, changes.get("capacity"))
    event.sqlmodel_update(changes)
    if free_seats:
        registrations_repository.promote_waitlisted(
            session, id_of(event), limit=free_seats
        )
    session.commit()
    session.refresh(event)
    return event


def publish_event(session: Session, actor: User, event_id: int) -> Event:
    event = get_managed_event(session, actor, event_id)
    if not _starts_transition(event, EventStatus.PUBLISHED):
        return event
    if event.venue_id is None:
        raise EventRequiresVenueError()
    _check_venue(session, event.venue_id)
    if event.starts_at <= utc_now():
        raise EventAlreadyStartedError()
    return _save_status(session, event, EventStatus.PUBLISHED)


def complete_event(session: Session, actor: User, event_id: int) -> Event:
    event = get_managed_event(session, actor, event_id)
    if not _starts_transition(event, EventStatus.COMPLETED):
        return event
    if utc_now() < event.ends_at:
        raise EventNotEndedError()
    return _save_status(session, event, EventStatus.COMPLETED)


def cancel_event(session: Session, actor: User, event_id: int) -> Event:
    event = get_managed_event(session, actor, event_id)
    if not _starts_transition(event, EventStatus.CANCELLED):
        return event
    registrations_repository.cancel_active(
        session,
        id_of(event),
        changed_by=id_of(actor),
        reason=RegistrationReason.EVENT_CANCELLED,
    )
    sessions_repository.cancel_for_event(session, id_of(event))
    return _save_status(session, event, EventStatus.CANCELLED)


def get_managed_event(
    session: Session, actor: User, event_id: int, *, for_update: bool = True
) -> Event:
    """Return the event if the actor may manage it: an admin or its organizer owner."""
    event = events_repository.get_event(session, event_id, for_update=for_update)
    roles = users_repository.get_role_codes(session, id_of(actor))
    is_admin = RoleCode.ADMIN in roles
    if event is None or not _can_see(event, actor, is_admin):
        raise EventNotFoundError()
    is_organizer_owner = event.owner_id == actor.id and RoleCode.ORGANIZER in roles
    if not (is_admin or is_organizer_owner):
        raise NotEventOwnerError()
    return event


def _starts_transition(event: Event, target: EventStatus) -> bool:
    """Return False when the event is already in `target`, so retries succeed."""
    if event.status == target:
        return False
    if event.status not in _ALLOWED_SOURCES[target]:
        raise InvalidStatusTransitionError(
            f"A {event.status} event cannot move to {target}"
        )
    return True


def _save_status(session: Session, event: Event, status: EventStatus) -> Event:
    event.status = status
    session.commit()
    session.refresh(event)
    return event


def _check_schedule(
    starts_at: datetime, ends_at: datetime, registration_closes_at: datetime | None
) -> None:
    if starts_at >= ends_at:
        raise InvalidEventScheduleError("starts_at must be before ends_at")
    if registration_closes_at is not None and registration_closes_at > ends_at:
        raise InvalidEventScheduleError(
            "registration_closes_at cannot be after ends_at"
        )


def _check_venue(session: Session, venue_id: int) -> None:
    if not venues_service.get_venue(session, venue_id).is_active:
        raise VenueInactiveError()


def _check_venue_change(session: Session, event: Event, venue_id: int | None) -> None:
    if venue_id is None and event.status == EventStatus.PUBLISHED:
        raise EventRequiresVenueError()
    if sessions_repository.has_scheduled(session, id_of(event)):
        raise EventHasScheduledSessionsError()
    if venue_id is not None:
        _check_venue(session, venue_id)


def _free_seats_after(session: Session, event: Event, capacity: int | None) -> int:
    """Seats to hand to the waitlist after a capacity change; 0 if it shrinks."""
    if capacity is None or capacity == event.capacity:
        return 0
    confirmed = registrations_repository.count_confirmed(session, id_of(event))
    if capacity < confirmed:
        raise CapacityBelowConfirmedError(
            f"The event has {confirmed} confirmed registrations"
        )
    return max(capacity - confirmed, 0) if capacity > event.capacity else 0


def _can_see(event: Event, viewer: User, is_admin: bool) -> bool:
    return event.status != EventStatus.DRAFT or event.owner_id == viewer.id or is_admin


def _is_admin(session: Session, user: User) -> bool:
    return RoleCode.ADMIN in users_repository.get_role_codes(session, id_of(user))
