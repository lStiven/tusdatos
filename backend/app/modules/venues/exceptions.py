from app.shared.exceptions import ConflictError, NotFoundError


class VenueNotFoundError(NotFoundError):
    code = "venue_not_found"
    message = "Venue not found"
    description = "The venue does not exist."


class RoomNotFoundError(NotFoundError):
    code = "room_not_found"
    message = "Room not found"
    description = (
        "The room does not exist in this venue (it may belong to another one)."
    )


class RoomNameTakenError(ConflictError):
    code = "room_name_taken"
    message = "The venue already has a room with this name"
    description = (
        "The venue already has a room with that name; names repeat only across venues."
    )


class RoomHasScheduledSessionsError(ConflictError):
    code = "room_has_scheduled_sessions"
    message = "The room has upcoming scheduled sessions"
    description = (
        "The room has scheduled sessions that have not ended; reschedule or "
        "cancel them before deactivating it."
    )


class RoomCapacityBelowSessionsError(ConflictError):
    code = "room_capacity_below_sessions"
    message = "An upcoming session in this room needs more seats"
    description = (
        "The new capacity is below an upcoming scheduled session in the room; "
        "the message states the minimum allowed."
    )


class VenueHasScheduledSessionsError(ConflictError):
    code = "venue_has_scheduled_sessions"
    message = "The venue has upcoming scheduled sessions"
    description = (
        "A room of the venue has scheduled sessions that have not ended; "
        "reschedule or cancel them before deactivating the venue."
    )
