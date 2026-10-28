import logging
from collections.abc import Callable, Coroutine, Mapping
from http import HTTPStatus
from typing import Any

from fastapi import Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg import errors as pg_errors
from pydantic import BaseModel, Field
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

RETRY_AFTER_SECONDS = 5


class ErrorDetail(BaseModel):
    field: str = Field(description="Path to the invalid field", examples=["body.email"])
    message: str = Field(
        description="Human-readable reason", examples=["Field required"]
    )
    type: str = Field(description="Validation error type", examples=["missing"])


class ErrorResponse(BaseModel):
    code: str = Field(
        description="Stable snake_case code; clients branch on it, not on the message",
        examples=["not_found"],
    )
    message: str = Field(
        description="Human-readable message; may change",
        examples=["Resource not found"],
    )
    details: list[ErrorDetail] | None = Field(
        default=None, description="Per-field errors; only on 422"
    )


class AppError(Exception):
    status_code: int = HTTPStatus.BAD_REQUEST
    code: str = "bad_request"
    message: str = "Invalid request"
    description: str = ""
    headers: dict[str, str] | None = None

    def __init__(self, message: str | None = None, *, code: str | None = None):
        self.message = message or self.message
        self.code = code or self.code
        super().__init__(self.message)


class UnauthorizedError(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    code = "unauthorized"
    message = "Missing or invalid credentials"
    description = "Missing or invalid credentials."
    headers = {"WWW-Authenticate": "Bearer"}


class ForbiddenError(AppError):
    status_code = HTTPStatus.FORBIDDEN
    code = "forbidden"
    message = "You do not have permission to perform this action"
    description = "The user lacks the role this operation requires."


class NotFoundError(AppError):
    status_code = HTTPStatus.NOT_FOUND
    code = "not_found"
    message = "Resource not found"
    description = "The resource does not exist."


class ConflictError(AppError):
    status_code = HTTPStatus.CONFLICT
    code = "conflict"
    message = "The operation conflicts with the current state"
    description = "The operation conflicts with the current state."


class ServiceUnavailableError(AppError):
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    code = "service_unavailable"
    message = "Service temporarily unavailable; retry in a few seconds"
    description = "Temporarily unavailable; retry after `Retry-After`."
    headers = {"Retry-After": str(RETRY_AFTER_SECONDS)}


_CONFLICT_DB_ERRORS = (
    pg_errors.UniqueViolation,
    pg_errors.ExclusionViolation,
)


def _error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    details: list[ErrorDetail] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body = ErrorResponse(code=code, message=message, details=details)
    return JSONResponse(body.model_dump(), status_code=status_code, headers=headers)


async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    return _error_response(exc.status_code, exc.code, exc.message, headers=exc.headers)


async def _handle_http_exception(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    code = HTTPStatus(exc.status_code).name.lower()
    return _error_response(exc.status_code, code, str(exc.detail), headers=exc.headers)


async def _handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = [
        ErrorDetail(
            field=".".join(str(part) for part in error["loc"]),
            message=error["msg"],
            type=error["type"],
        )
        for error in exc.errors()
    ]
    return _error_response(
        HTTPStatus.UNPROCESSABLE_CONTENT,
        "validation_error",
        "Invalid input data",
        details=details,
    )


async def _handle_pool_timeout(request: Request, exc: PoolTimeoutError) -> JSONResponse:
    logger.warning(
        "Connection pool exhausted on %s %s", request.method, request.url.path
    )
    return await _handle_app_error(request, ServiceUnavailableError())


async def _handle_db_error(request: Request, exc: DBAPIError) -> JSONResponse:
    if isinstance(exc.orig, pg_errors.OperationalError):
        logger.warning(
            "Database unavailable on %s %s",
            request.method,
            request.url.path,
            exc_info=exc,
        )
        return await _handle_app_error(request, ServiceUnavailableError())
    if isinstance(exc.orig, _CONFLICT_DB_ERRORS):
        logger.warning(
            "Untranslated database constraint violation on %s %s: %s",
            request.method,
            request.url.path,
            exc.orig.diag.constraint_name,
            exc_info=exc,
        )
        return await _handle_app_error(request, ConflictError())
    raise exc


async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    return _error_response(
        HTTPStatus.INTERNAL_SERVER_ERROR, "internal_error", "Internal server error"
    )


type _Handler = Callable[[Request, Any], Coroutine[Any, Any, Response]]

EXCEPTION_HANDLERS: dict[int | type[Exception], _Handler] = {
    AppError: _handle_app_error,
    StarletteHTTPException: _handle_http_exception,
    RequestValidationError: _handle_validation_error,
    PoolTimeoutError: _handle_pool_timeout,
    DBAPIError: _handle_db_error,
    Exception: _handle_unexpected,
}

_DESCRIPTIONS = {
    400: "Request rejected by a business rule",
    401: "Not authenticated, or token invalid/expired",
    403: "Authenticated, but not allowed to access the resource",
    404: "Resource not found",
    409: "Conflict with the current state (duplicate, overlap, capacity…)",
    422: "Invalid input data; see `details`",
    503: "Service temporarily unavailable; retry after the `Retry-After` header",
}


type ErrorSpec = int | type[AppError]


def error_responses(*errors: ErrorSpec) -> dict[int | str, dict[str, Any]]:
    """Build the OpenAPI `responses` of an endpoint; 422 and 503 always apply.

    Pass a status code for a generic response, or an `AppError` subclass to list
    its `code` (explained by the class's own `description`) and add a named
    example with its default message.
    """
    by_status: dict[int, list[type[AppError]]] = {422: [], 503: []}
    for error in errors:
        if isinstance(error, int):
            by_status.setdefault(error, [])
        else:
            by_status.setdefault(int(error.status_code), []).append(error)
    return {
        status: _documented_response(status, by_status[status])
        for status in sorted(by_status)
    }


def _documented_response(status: int, errors: list[type[AppError]]) -> dict[str, Any]:
    response: dict[str, Any] = {
        "model": ErrorResponse,
        "description": _DESCRIPTIONS[status],
    }
    if errors:
        response["description"] += "\n\n" + "\n".join(
            f"- `{error.code}`: {error.description}" for error in errors
        )
        response["content"] = {
            "application/json": {
                "examples": {
                    error.code: {
                        "value": ErrorResponse(
                            code=error.code, message=error.message
                        ).model_dump()
                    }
                    for error in errors
                }
            }
        }
    return response


def violated_constraint(exc: IntegrityError) -> str | None:
    if isinstance(exc.orig, pg_errors.Error):
        return exc.orig.diag.constraint_name
    return None
