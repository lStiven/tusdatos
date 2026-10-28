from app.shared.exceptions import ConflictError, NotFoundError


class UserNotFoundError(NotFoundError):
    code = "user_not_found"
    message = "User not found"
    description = "The user does not exist."


class LastAdminError(ConflictError):
    code = "last_admin"
    message = "The last active admin cannot lose the ADMIN role"
    description = (
        "Removing the role would leave no active admin; grant `ADMIN` to someone "
        "else first."
    )
