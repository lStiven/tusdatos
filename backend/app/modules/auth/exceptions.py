from app.shared.exceptions import ConflictError, UnauthorizedError


class EmailTakenError(ConflictError):
    code = "email_taken"
    message = "Email already registered"
    description = (
        "The email is already registered, in any letter case; offer to log in."
    )


class InvalidCredentialsError(UnauthorizedError):
    code = "invalid_credentials"
    message = "Invalid email or password"
    description = (
        "Wrong email, wrong password or inactive account; it never says which."
    )


class NotAuthenticatedError(UnauthorizedError):
    code = "unauthorized"
    message = "Not authenticated"
    description = "No `Authorization: Bearer` header was sent; log in first."


class TokenExpiredError(UnauthorizedError):
    code = "token_expired"
    message = "Token expired"
    description = "The token is past its `expires_in`; log in again."


class InvalidTokenError(UnauthorizedError):
    code = "invalid_token"
    message = "Invalid token"
    description = (
        "The token is malformed or forged, or its user was deleted or deactivated."
    )


AUTHENTICATION_ERRORS = (NotAuthenticatedError, TokenExpiredError, InvalidTokenError)
