from app.shared.exceptions import AppError, ConflictError, ForbiddenError, NotFoundError


class EventNotFoundError(NotFoundError):
    code = "event_not_found"
    message = "Event not found"
    description = (
        "The event does not exist, or it is a draft and the user is neither its "
        "owner nor an admin."
    )


class NotEventOwnerError(ForbiddenError):
    code = "not_event_owner"
    message = "Only the owner of the event or an admin can change it"
    description = (
        "The event belongs to another organizer; only they or an admin can change it."
    )


class InvalidEventScheduleError(AppError):
    code = "invalid_event_schedule"
    message = "The event dates are not consistent"
    description = (
        "`starts_at` must be before `ends_at`, and `registration_closes_at` cannot "
        "be after `ends_at`; on updates the values sent are combined with the "
        "current ones. The message names the broken rule."
    )


class EventNotEditableError(ConflictError):
    code = "event_not_editable"
    message = "Cancelled or completed events cannot be changed"
    description = "The event is `CANCELLED` or `COMPLETED`; both statuses are final."


class InvalidStatusTransitionError(ConflictError):
    code = "invalid_status_transition"
    message = "The event cannot move to that status"
    description = (
        "The current status does not allow this action; the message names both "
        "statuses. Allowed: `DRAFT`→`PUBLISHED`, `PUBLISHED`→`COMPLETED`, "
        "`DRAFT`/`PUBLISHED`→`CANCELLED`."
    )


class EventRequiresVenueError(ConflictError):
    code = "event_requires_venue"
    message = "A published event needs a venue"
    description = (
        "Publishing needs a venue, and a published event cannot drop it; set "
        "`venue_id` first."
    )


class VenueInactiveError(ConflictError):
    code = "venue_inactive"
    message = "The venue is inactive"
    description = (
        "The venue is deactivated and does not accept new events; pick another one."
    )


class EventAlreadyStartedError(ConflictError):
    code = "event_already_started"
    message = "The event has already started"
    description = (
        "Only events that have not started can be published; move `starts_at` first."
    )


class EventNotEndedError(ConflictError):
    code = "event_not_ended"
    message = "The event has not ended yet"
    description = "An event can be completed only after its `ends_at`."


class CapacityBelowConfirmedError(ConflictError):
    code = "capacity_below_confirmed"
    message = "The capacity cannot go below the confirmed registrations"
    description = (
        "The new capacity is below the confirmed registrations; the message states "
        "the minimum allowed."
    )


class SessionsOutsideEventError(ConflictError):
    code = "sessions_outside_event"
    message = "Some sessions would fall outside the event dates"
    description = (
        "A session that is not cancelled would end up outside the new dates; "
        "reschedule or cancel it first."
    )


class EventHasScheduledSessionsError(ConflictError):
    code = "event_has_scheduled_sessions"
    message = "The event has scheduled sessions in its venue"
    description = (
        "Scheduled sessions use rooms of the current venue; move them back to "
        "`DRAFT` or cancel them before changing the venue."
    )
