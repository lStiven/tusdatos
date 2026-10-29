from fastapi import APIRouter
from fastapi import status as http_status

from app.modules.auth.dependencies import CurrentUserDep
from app.modules.auth.exceptions import AUTHENTICATION_ERRORS
from app.modules.events.exceptions import (
    EventNotEditableError,
    EventNotFoundError,
    NotEventOwnerError,
)
from app.modules.sessions import service as sessions_service
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
from app.modules.sessions.schemas import SessionCreate, SessionRead, SessionUpdate
from app.modules.speakers.exceptions import SpeakerNotFoundError
from app.shared.dependencies import SessionDep
from app.shared.exceptions import error_responses

router = APIRouter(tags=["sessions"])

_BOOKING_ERRORS = (
    SessionRequiresRoomError,
    RoomInactiveError,
    CapacityExceedsRoomError,
    RoomNotAvailableError,
    SpeakerNotAvailableError,
)
_CHANGE_ERRORS = (
    *AUTHENTICATION_ERRORS,
    NotEventOwnerError,
    SessionNotFoundError,
    EventNotEditableError,
    SessionCancelledError,
)


@router.post(
    "/events/{event_id}/sessions",
    response_model=SessionRead,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create a session",
    responses=error_responses(
        *AUTHENTICATION_ERRORS,
        NotEventOwnerError,
        EventNotFoundError,
        EventNotEditableError,
        InvalidSessionScheduleError,
        SessionOutsideEventError,
        RoomNotInEventVenueError,
        SpeakerNotFoundError,
    ),
)
def create_session(
    event_id: int, data: SessionCreate, user: CurrentUserDep, session: SessionDep
) -> SessionRead:
    """Create a talk in an event, as a `DRAFT`. Only the event's organizer owner
    or an admin can do it.

    **Rules**
    - The event must be `DRAFT` or `PUBLISHED`, and the session must start and
      end within it.
    - A draft does not reserve its room nor check speakers' availability; that
      happens on `POST /sessions/{session_id}/schedule`. `room_id`, if sent, must
      be a room of the event's venue.
    - Drafts are only visible to the event owner and admins.
    """
    return sessions_service.create_session(session, user, event_id, data)


@router.get(
    "/events/{event_id}/sessions",
    response_model=list[SessionRead],
    summary="List the sessions of an event",
    responses=error_responses(*AUTHENTICATION_ERRORS, EventNotFoundError),
)
def list_sessions(
    event_id: int, user: CurrentUserDep, session: SessionDep
) -> list[SessionRead]:
    """The event agenda, ordered by start time, with interest metrics per session.

    **Rules**
    - Attendees see `SCHEDULED` and `CANCELLED` sessions; the event owner and
      admins also see drafts.
    - Not paginated: an event has a bounded number of sessions.
    - `interested` is an estimate from attendees' interest, not reserved seats;
      `overdemand` flags sessions where it exceeds `capacity`.
    """
    return sessions_service.list_sessions(session, user, event_id)


@router.get(
    "/sessions/{session_id}",
    response_model=SessionRead,
    summary="Get a session",
    responses=error_responses(*AUTHENTICATION_ERRORS, SessionNotFoundError),
)
def get_session(
    session_id: int, user: CurrentUserDep, session: SessionDep
) -> SessionRead:
    """Return a session with its interest metrics. Drafts are only visible to the
    event owner and admins (`404` for anyone else)."""
    return sessions_service.get_session(session, user, session_id)


@router.patch(
    "/sessions/{session_id}",
    response_model=SessionRead,
    summary="Update a session",
    responses=error_responses(
        *_CHANGE_ERRORS,
        InvalidSessionScheduleError,
        SessionOutsideEventError,
        RoomNotInEventVenueError,
        SpeakerNotFoundError,
        *_BOOKING_ERRORS,
    ),
)
def update_session(
    session_id: int, data: SessionUpdate, user: CurrentUserDep, session: SessionDep
) -> SessionRead:
    """Partially update a session. Only the event's organizer owner or an admin
    can do it.

    **Rules**
    - Omitted fields keep their value. `description` accepts `null`; so does
      `room_id`, but only in drafts. `speaker_ids` replaces the whole list.
    - The event must be `DRAFT` or `PUBLISHED`; `CANCELLED` sessions are final.
    - If the session is `SCHEDULED`, the result must still be bookable: the
      same checks as scheduling apply, and the change is rejected otherwise.
    """
    return sessions_service.update_session(session, user, session_id, data)


@router.post(
    "/sessions/{session_id}/schedule",
    response_model=SessionRead,
    summary="Schedule a session",
    responses=error_responses(
        *_CHANGE_ERRORS,
        InvalidSessionScheduleError,
        SessionOutsideEventError,
        RoomNotInEventVenueError,
        *_BOOKING_ERRORS,
    ),
)
def schedule_session(
    session_id: int, user: CurrentUserDep, session: SessionDep
) -> SessionRead:
    """Move a draft to `SCHEDULED`, which reserves its room.

    **Rules**
    - Requires a room of the event's venue, active and with an active venue,
      with at least `capacity` seats.
    - The room cannot host another scheduled session at an overlapping time, in
      any event; back-to-back sessions are fine.
    - No speaker can be in another scheduled session at an overlapping time, in
      any event.
    - Scheduling an already scheduled session returns it unchanged.
    """
    return sessions_service.schedule_session(session, user, session_id)


@router.post(
    "/sessions/{session_id}/unschedule",
    response_model=SessionRead,
    summary="Move a session back to draft",
    responses=error_responses(*_CHANGE_ERRORS),
)
def unschedule_session(
    session_id: int, user: CurrentUserDep, session: SessionDep
) -> SessionRead:
    """Move a scheduled session back to `DRAFT`, releasing its room.

    **Rules**
    - Attendees stop seeing it, but their interest is kept for when it is
      scheduled again.
    - Unscheduling a draft returns it unchanged.
    """
    return sessions_service.unschedule_session(session, user, session_id)


@router.post(
    "/sessions/{session_id}/cancel",
    response_model=SessionRead,
    summary="Cancel a session",
    responses=error_responses(
        *AUTHENTICATION_ERRORS,
        NotEventOwnerError,
        SessionNotFoundError,
        EventNotEditableError,
    ),
)
def cancel_session(
    session_id: int, user: CurrentUserDep, session: SessionDep
) -> SessionRead:
    """Cancel a session; this is final.

    **Rules**
    - Releases its room and withdraws every active interest in it.
    - Attendees still see it in the agenda, as `CANCELLED`.
    - Cancelling a cancelled session returns it unchanged.
    """
    return sessions_service.cancel_session(session, user, session_id)


@router.put(
    "/sessions/{session_id}/interest",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Mark interest in a session",
    responses=error_responses(
        *AUTHENTICATION_ERRORS,
        SessionNotFoundError,
        SessionNotOpenError,
        NotConfirmedError,
    ),
)
def mark_interest(session_id: int, user: CurrentUserDep, session: SessionDep) -> None:
    """Tell the organizers the current user plans to attend this session.

    **Rules**
    - Only for attendees with a `CONFIRMED` registration to the event; waitlisted
      ones can once promoted.
    - Only on `SCHEDULED` sessions that have not started.
    - Interest is informative: it reserves no seat, and may be marked on sessions
      at the same time or beyond the session capacity.
    - Idempotent: marking it again changes nothing.
    """
    sessions_service.mark_interest(session, user, session_id)


@router.delete(
    "/sessions/{session_id}/interest",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Withdraw interest in a session",
    responses=error_responses(*AUTHENTICATION_ERRORS, SessionNotFoundError),
)
def withdraw_interest(
    session_id: int, user: CurrentUserDep, session: SessionDep
) -> None:
    """Withdraw the current user's interest.

    **Rules**
    - Always allowed, whatever the session status; without interest it does
      nothing.
    - Cancelling the event registration withdraws all the user's interests in
      the event.
    """
    sessions_service.withdraw_interest(session, user, session_id)
