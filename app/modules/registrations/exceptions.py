from app.shared.exceptions import ConflictError, NotFoundError


class RegistrationNotFoundError(NotFoundError):
    code = "registration_not_found"
    message = "You are not registered for this event"
    description = "The user has never registered for this event."


class EventNotOpenError(ConflictError):
    code = "event_not_open"
    message = "The event does not accept registrations"
    description = (
        "Only `PUBLISHED` events accept registrations; this one is cancelled or "
        "completed."
    )


class RegistrationClosedError(ConflictError):
    code = "registration_closed"
    message = "Registration for this event is closed"
    description = (
        "The deadline has passed: `registration_closes_at`, or `starts_at` when "
        "the event sets no deadline."
    )


class CancellationClosedError(ConflictError):
    code = "cancellation_closed"
    message = "The event has already started"
    description = "Registrations can be cancelled only before the event starts."
