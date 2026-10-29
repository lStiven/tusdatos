from sqlmodel import Session

from app.modules.events import service as events_service
from app.modules.events.models import Event, EventStatus
from app.modules.registrations import repository as registrations_repository
from app.modules.registrations.exceptions import (
    CancellationClosedError,
    EventNotOpenError,
    RegistrationClosedError,
    RegistrationNotFoundError,
)
from app.modules.registrations.models import (
    EventRegistration,
    RegistrationReason,
    RegistrationStatus,
)
from app.modules.registrations.schemas import (
    Attendee,
    EventRegistrationRead,
    Occupancy,
    RegistrationRead,
)
from app.modules.sessions import repository as sessions_repository
from app.modules.users.models import User
from app.shared.datetimes import utc_now
from app.shared.models import id_of
from app.shared.pagination import PageParams

_ACTIVE = (RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED)


def register(
    session: Session, user: User, event_id: int
) -> tuple[RegistrationRead, bool]:
    """Register the user; the flag is False when an active registration already existed."""
    event = events_service.get_event(session, user, event_id, for_update=True)
    registration = registrations_repository.get_for_user(session, event_id, id_of(user))
    if registration is not None and registration.status in _ACTIVE:
        return _read(session, event_id, user), False
    if event.status != EventStatus.PUBLISHED:
        raise EventNotOpenError()
    if utc_now() >= (event.registration_closes_at or event.starts_at):
        raise RegistrationClosedError()

    free_seats = event.capacity - registrations_repository.count_confirmed(
        session, event_id
    )
    if free_seats > 0:
        # The queue goes first: a newcomer never takes a seat someone waits for.
        free_seats -= registrations_repository.promote_waitlisted(
            session, event_id, limit=free_seats
        )
    previous = registration.status if registration else None
    if registration is None:
        registration = EventRegistration(
            event_id=event_id,
            user_id=id_of(user),
            status=RegistrationStatus.WAITLISTED,
        )
        session.add(registration)
    reason = _admit(registration, event, has_seat=free_seats > 0)
    session.flush()
    registrations_repository.add_history(
        session,
        registration,
        from_status=previous,
        reason=reason,
        waitlist_order=registration.waitlist_order,
        changed_by=id_of(user),
    )
    session.commit()
    return _read(session, event_id, user), True


def cancel(session: Session, user: User, event_id: int) -> RegistrationRead:
    event = events_service.get_event(session, user, event_id, for_update=True)
    registration = registrations_repository.get_for_user(session, event_id, id_of(user))
    if registration is None:
        raise RegistrationNotFoundError()
    if registration.status == RegistrationStatus.CANCELLED:
        return _read(session, event_id, user)
    if utc_now() >= event.starts_at:
        raise CancellationClosedError()

    previous, waitlist_order = registration.status, registration.waitlist_order
    registration.status = RegistrationStatus.CANCELLED
    registration.cancelled_at = utc_now()
    registration.waitlist_order = None
    session.flush()
    registrations_repository.add_history(
        session,
        registration,
        from_status=previous,
        reason=RegistrationReason.USER_CANCELLED,
        waitlist_order=waitlist_order,
        changed_by=id_of(user),
    )
    sessions_repository.withdraw_interests(session, event_id, id_of(user))
    if previous == RegistrationStatus.CONFIRMED:
        free_seats = event.capacity - registrations_repository.count_confirmed(
            session, event_id
        )
        if free_seats > 0:
            registrations_repository.promote_waitlisted(
                session, event_id, limit=free_seats
            )
    session.commit()
    return _read(session, event_id, user)


def get_mine(session: Session, user: User, event_id: int) -> RegistrationRead:
    events_service.get_event(session, user, event_id)
    return _read(session, event_id, user)


def list_mine(
    session: Session, user: User, *, status: RegistrationStatus | None, page: PageParams
) -> tuple[list[RegistrationRead], int]:
    rows, total = registrations_repository.list_for_user(
        session, id_of(user), status=status, limit=page.limit, offset=page.offset
    )
    return [_to_read(registration, position) for registration, position in rows], total


def list_for_event(
    session: Session,
    actor: User,
    event_id: int,
    *,
    status: RegistrationStatus | None,
    page: PageParams,
) -> tuple[list[EventRegistrationRead], int]:
    events_service.get_managed_event(session, actor, event_id, for_update=False)
    rows, total = registrations_repository.list_for_event(
        session, event_id, status=status, limit=page.limit, offset=page.offset
    )
    items = [
        EventRegistrationRead(
            **_to_read(registration, position).model_dump(),
            user=Attendee(id=id_of(user), email=user.email, full_name=user.full_name),
        )
        for registration, position, user in rows
    ]
    return items, total


def get_occupancy(session: Session, viewer: User, event_id: int) -> Occupancy:
    event = events_service.get_event(session, viewer, event_id)
    counts = registrations_repository.count_by_status(session, event_id)
    confirmed = counts[RegistrationStatus.CONFIRMED]
    return Occupancy(
        event_id=event_id,
        capacity=event.capacity,
        confirmed=confirmed,
        available=max(event.capacity - confirmed, 0),
        waitlisted=counts[RegistrationStatus.WAITLISTED],
        occupancy_percent=round(confirmed / event.capacity * 100, 1),
    )


def _admit(
    registration: EventRegistration, event: Event, *, has_seat: bool
) -> RegistrationReason:
    now = utc_now()
    registration.requested_at = now
    if has_seat:
        registration.status = RegistrationStatus.CONFIRMED
        registration.confirmed_at = now
        registration.waitlist_order = None
        return RegistrationReason.REGISTERED
    # A new request always goes to the back, even if it waited before cancelling.
    registration.status = RegistrationStatus.WAITLISTED
    registration.waitlisted_at = now
    registration.waitlist_order = event.next_waitlist_order
    event.next_waitlist_order += 1
    return RegistrationReason.EVENT_FULL


def _read(session: Session, event_id: int, user: User) -> RegistrationRead:
    row = registrations_repository.get_with_position(session, event_id, id_of(user))
    if row is None:
        raise RegistrationNotFoundError()
    return _to_read(*row)


def _to_read(registration: EventRegistration, position: int | None) -> RegistrationRead:
    return RegistrationRead(
        id=id_of(registration),
        event_id=registration.event_id,
        status=registration.status,
        waitlist_position=position,
        requested_at=registration.requested_at,  # pyright: ignore[reportArgumentType]
        confirmed_at=registration.confirmed_at,
        cancelled_at=registration.cancelled_at,
    )
