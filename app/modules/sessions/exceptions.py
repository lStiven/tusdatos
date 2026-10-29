from app.shared.exceptions import AppError, ConflictError, NotFoundError


class SessionNotFoundError(NotFoundError):
    code = "session_not_found"
    message = "Session not found"
    description = (
        "The session does not exist, its event is not visible to the user, or it "
        "is a draft and the user is neither the event owner nor an admin."
    )


class InvalidSessionScheduleError(AppError):
    code = "invalid_session_schedule"
    message = "starts_at must be before ends_at"
    description = (
        "`starts_at` must be before `ends_at`; on updates the values sent are "
        "combined with the current ones."
    )


class SessionOutsideEventError(ConflictError):
    code = "session_outside_event"
    message = "The session must take place within the event dates"
    description = "The session must start and end within the event dates."


class SessionCancelledError(ConflictError):
    code = "session_cancelled"
    message = "Cancelled sessions cannot be changed"
    description = "The session is `CANCELLED`, which is final; create a new one."


class RoomNotInEventVenueError(ConflictError):
    code = "room_not_in_event_venue"
    message = "The room does not belong to the event's venue"
    description = (
        "The room does not exist in the event's venue, or the event has no venue "
        "yet; pick one of its rooms or set the event's venue first."
    )


class SessionRequiresRoomError(ConflictError):
    code = "session_requires_room"
    message = "A scheduled session needs a room"
    description = (
        "Scheduling reserves a room, so `room_id` must be set. A scheduled session "
        "cannot drop its room: move it back to draft first."
    )


class RoomInactiveError(ConflictError):
    code = "room_inactive"
    message = "The room or its venue is inactive"
    description = (
        "The room, or the venue it belongs to, is deactivated and does not accept "
        "scheduled sessions; pick another room."
    )


class CapacityExceedsRoomError(ConflictError):
    code = "capacity_exceeds_room"
    message = "The session needs more seats than the room has"
    description = (
        "A scheduled session cannot have more capacity than its room; the message "
        "states the room capacity."
    )


class RoomNotAvailableError(ConflictError):
    code = "room_not_available"
    message = "The room has another scheduled session at that time"
    description = (
        "Another scheduled session, of this or any other event, uses the room at an "
        "overlapping time. Back-to-back sessions (one ends when the next starts) "
        "are allowed."
    )


class SpeakerNotAvailableError(ConflictError):
    code = "speaker_not_available"
    message = "A speaker has another scheduled session at that time"
    description = (
        "A speaker is in another scheduled session, of any event, at an overlapping "
        "time; the message names the speakers."
    )


class SessionNotOpenError(ConflictError):
    code = "session_not_open"
    message = "Interest is only accepted for scheduled sessions not yet started"
    description = (
        "Interest can only be marked on a `SCHEDULED` session before it starts. "
        "Withdrawing it is always possible."
    )


class NotConfirmedError(ConflictError):
    code = "registration_not_confirmed"
    message = "Only attendees with a confirmed registration can mark interest"
    description = (
        "The user has no `CONFIRMED` registration for the session's event. A "
        "waitlisted user can mark interest once promoted."
    )
