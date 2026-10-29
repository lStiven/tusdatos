from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col

from app.modules.events import service as events_service
from app.modules.events.exceptions import EventNotFoundError
from app.modules.events.models import Event
from app.modules.registrations import repository as registrations_repository
from app.modules.registrations.models import RegistrationStatus
from app.modules.sessions import repository as sessions_repository
from app.modules.sessions.exceptions import (
    CapacityExceedsRoomError,
    InvalidSessionScheduleError,
    NotConfirmedError,
    RoomInactiveError,
    RoomNotAvailableError,
    RoomNotInEventVenueError,
    SessionCancelledError,
    SessionNotFoundError,
    SessionNotOpenError,
    SessionOutsideEventError,
    SessionRequiresRoomError,
    SpeakerNotAvailableError,
)
from app.modules.sessions.models import EventSession, SessionStatus
from app.modules.sessions.schemas import (
    RoomSummary,
    SessionCreate,
    SessionRead,
    SessionUpdate,
    SpeakerSummary,
)
from app.modules.speakers import repository as speakers_repository
from app.modules.speakers.exceptions import SpeakerNotFoundError
from app.modules.speakers.models import Speaker
from app.modules.users.models import User
from app.modules.venues import repository as venues_repository
from app.modules.venues.models import Room
from app.shared.datetimes import utc_now
from app.shared.exceptions import violated_constraint
from app.shared.models import id_of

_PUBLIC = (SessionStatus.SCHEDULED, SessionStatus.CANCELLED)


def list_sessions(session: Session, viewer: User, event_id: int) -> list[SessionRead]:
    event = events_service.get_event(session, viewer, event_id)
    return _read(
        session,
        viewer,
        col(EventSession.event_id) == event_id,
        *_draft_filter(session, viewer, event),
    )


def get_session(session: Session, viewer: User, session_id: int) -> SessionRead:
    event = _visible_event(session, viewer, session_id)
    found = _read(
        session,
        viewer,
        col(EventSession.id) == session_id,
        *_draft_filter(session, viewer, event),
    )
    if not found:
        raise SessionNotFoundError()
    return found[0]


def create_session(
    session: Session, actor: User, event_id: int, data: SessionCreate
) -> SessionRead:
    event = events_service.get_editable_event(session, actor, event_id)
    created = EventSession(
        event_id=event_id, **data.model_dump(exclude={"speaker_ids"})
    )
    speaker_ids = set(data.speaker_ids)
    _check(session, event, created, speaker_ids)
    session.add(created)
    _flush(session)
    sessions_repository.set_speakers(session, id_of(created), speaker_ids)
    session.commit()
    return get_session(session, actor, id_of(created))


def update_session(
    session: Session, actor: User, session_id: int, data: SessionUpdate
) -> SessionRead:
    event, target = _get_for_change(session, actor, session_id)
    events_service.ensure_editable(event)
    if target.status == SessionStatus.CANCELLED:
        raise SessionCancelledError()
    changes = data.model_dump(exclude_unset=True)
    current_speakers = sessions_repository.get_speaker_ids(session, session_id)
    new_speakers: set[int] | None = (
        set(changes.pop("speaker_ids")) if "speaker_ids" in changes else None
    )
    # Validated on a detached copy: a dirty `target` would be autoflushed
    # by the locking queries before its checks ran.
    _check(
        session,
        event,
        EventSession.model_validate({**target.model_dump(), **changes}),
        current_speakers if new_speakers is None else new_speakers,
        before=target,
        before_speakers=current_speakers,
    )
    target.sqlmodel_update(changes)
    _flush(session)
    if new_speakers is not None:
        sessions_repository.set_speakers(session, session_id, new_speakers)
    session.commit()
    return get_session(session, actor, session_id)


def schedule_session(session: Session, actor: User, session_id: int) -> SessionRead:
    event, target = _get_for_change(session, actor, session_id)
    if target.status != SessionStatus.SCHEDULED:
        _ensure_changeable(event, target)
        speakers = sessions_repository.get_speaker_ids(session, session_id)
        scheduled = EventSession.model_validate(
            {**target.model_dump(), "status": SessionStatus.SCHEDULED}
        )
        _check(session, event, scheduled, speakers, before=target)
        target.status = SessionStatus.SCHEDULED
        _flush(session)
        session.commit()
    return get_session(session, actor, session_id)


def unschedule_session(session: Session, actor: User, session_id: int) -> SessionRead:
    event, target = _get_for_change(session, actor, session_id)
    if target.status != SessionStatus.DRAFT:
        _ensure_changeable(event, target)
        target.status = SessionStatus.DRAFT
        session.commit()
    return get_session(session, actor, session_id)


def cancel_session(session: Session, actor: User, session_id: int) -> SessionRead:
    # Locked before withdrawing: marking interest reads the session FOR SHARE.
    event, target = _get_for_change(session, actor, session_id, for_update=True)
    if target.status != SessionStatus.CANCELLED:
        events_service.ensure_editable(event)
        target.status = SessionStatus.CANCELLED
        sessions_repository.withdraw_session_interests(session, session_id)
        session.commit()
    return get_session(session, actor, session_id)


def mark_interest(session: Session, user: User, session_id: int) -> None:
    event = _visible_event(session, user, session_id)
    # Registration first, then session: the order in which cancelling the event
    # updates them. FOR SHARE makes a concurrent cancellation of either wait.
    registration = registrations_repository.get_for_user(
        session, id_of(event), id_of(user), for_share=True
    )
    target = sessions_repository.get_session(session, session_id, for_share=True)
    if target is None or not _can_see(session, user, event, target):
        raise SessionNotFoundError()
    if target.status != SessionStatus.SCHEDULED or target.starts_at <= utc_now():
        raise SessionNotOpenError()
    if registration is None or registration.status != RegistrationStatus.CONFIRMED:
        raise NotConfirmedError()
    sessions_repository.add_interest(session, id_of(user), session_id)
    session.commit()


def withdraw_interest(session: Session, user: User, session_id: int) -> None:
    _visible_event(session, user, session_id)
    sessions_repository.withdraw_interest(session, id_of(user), session_id)
    session.commit()


def _check(
    session: Session,
    event: Event,
    candidate: EventSession,
    speaker_ids: set[int],
    *,
    before: EventSession | None = None,
    before_speakers: set[int] | None = None,
) -> None:
    """Validate `candidate` after locking rooms, then speakers, old and new alike."""
    if candidate.starts_at >= candidate.ends_at:
        raise InvalidSessionScheduleError()
    if candidate.starts_at < event.starts_at or candidate.ends_at > event.ends_at:
        raise SessionOutsideEventError()
    old_room_id = before.room_id if before else None
    rooms = venues_repository.lock_rooms_by_id(
        session,
        {
            room_id
            for room_id in (candidate.room_id, old_room_id)
            if room_id is not None
        },
    )
    room = rooms.get(candidate.room_id) if candidate.room_id is not None else None
    if candidate.room_id is not None and (
        room is None or room.venue_id != event.venue_id
    ):
        raise RoomNotInEventVenueError()
    known = speakers_repository.lock_speakers(
        session, speaker_ids | (before_speakers or set())
    )
    if missing := sorted(speaker_ids - known):
        raise SpeakerNotFoundError(f"Speakers not found: {missing}")
    if candidate.status == SessionStatus.SCHEDULED:
        _check_bookable(session, candidate, room, speaker_ids)


def _check_bookable(
    session: Session, candidate: EventSession, room: Room | None, speaker_ids: set[int]
) -> None:
    if room is None:
        raise SessionRequiresRoomError()
    venue = venues_repository.get_venue(session, room.venue_id)
    if not room.is_active or venue is None or not venue.is_active:
        raise RoomInactiveError()
    if candidate.capacity > room.capacity:
        raise CapacityExceedsRoomError(f"The room has {room.capacity} seats")
    busy = sessions_repository.busy_speakers(
        session,
        speaker_ids,
        candidate.starts_at,
        candidate.ends_at,
        exclude_session_id=id_of(candidate),
    )
    if busy:
        raise SpeakerNotAvailableError(
            f"Speakers {list(busy)} have another scheduled session at that time"
        )


def _flush(session: Session) -> None:
    """The room's exclusion constraint is the final word on its availability."""
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        if violated_constraint(exc) == "ex_sessions_room_schedule":
            raise RoomNotAvailableError() from exc
        raise


def _ensure_changeable(event: Event, target: EventSession) -> None:
    if target.status == SessionStatus.CANCELLED:
        raise SessionCancelledError()
    events_service.ensure_editable(event)


def _get_for_change(
    session: Session, actor: User, session_id: int, *, for_update: bool = False
) -> tuple[Event, EventSession]:
    """Lock the event, then load the session: every writer holds that lock."""
    event_id = sessions_repository.get_event_id(session, session_id)
    if event_id is None:
        raise SessionNotFoundError()
    try:
        event = events_service.get_managed_event(session, actor, event_id)
    except EventNotFoundError as exc:
        raise SessionNotFoundError() from exc
    target = sessions_repository.get_session(session, session_id, for_update=for_update)
    if target is None:
        raise SessionNotFoundError()
    return event, target


def _visible_event(session: Session, viewer: User, session_id: int) -> Event:
    event_id = sessions_repository.get_event_id(session, session_id)
    if event_id is None:
        raise SessionNotFoundError()
    try:
        return events_service.get_event(session, viewer, event_id)
    except EventNotFoundError as exc:
        raise SessionNotFoundError() from exc


def _can_see(
    session: Session, viewer: User, event: Event, target: EventSession
) -> bool:
    return target.status in _PUBLIC or events_service.can_see_drafts(
        session, viewer, event
    )


def _draft_filter(
    session: Session, viewer: User, event: Event
) -> list[ColumnElement[bool]]:
    if events_service.can_see_drafts(session, viewer, event):
        return []
    return [col(EventSession.status).in_(_PUBLIC)]


def _read(
    session: Session, viewer: User, *filters: ColumnElement[bool]
) -> list[SessionRead]:
    views = sessions_repository.list_views(session, id_of(viewer), *filters)
    speakers = sessions_repository.speakers_by_session(
        session, [id_of(view[0]) for view in views]
    )
    return [
        _to_read(target, room, interested, mine, speakers.get(id_of(target), []))
        for target, room, interested, mine in views
    ]


def _to_read(
    target: EventSession,
    room: Room | None,
    interested: int,
    mine: bool,
    speakers: list[Speaker],
) -> SessionRead:
    return SessionRead(
        id=id_of(target),
        event_id=target.event_id,
        title=target.title,
        description=target.description,
        capacity=target.capacity,
        status=target.status,
        starts_at=target.starts_at,
        ends_at=target.ends_at,
        room=RoomSummary.model_validate(room) if room else None,
        speakers=[SpeakerSummary.model_validate(speaker) for speaker in speakers],
        interested=interested,
        interest_percent=round(interested / target.capacity * 100, 1),
        overdemand=interested > target.capacity,
        is_interested=mine,
    )
