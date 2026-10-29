from app.shared.exceptions import ConflictError, NotFoundError


class SpeakerNotFoundError(NotFoundError):
    code = "speaker_not_found"
    message = "Speaker not found"
    description = "The speaker does not exist."


class SpeakerHasSessionsError(ConflictError):
    code = "speaker_has_sessions"
    message = "The speaker is assigned to sessions"
    description = (
        "The speaker appears in at least one session, cancelled or past ones "
        "included; it is kept for the history and cannot be deleted."
    )
