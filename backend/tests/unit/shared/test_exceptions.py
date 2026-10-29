import httpx2
import psycopg
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from psycopg import errors as pg_errors
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.shared.exceptions import (
    EXCEPTION_HANDLERS,
    ConflictError,
    ErrorResponse,
    UnauthorizedError,
    error_responses,
)

DB_DOWN = OperationalError("SELECT 1", {}, psycopg.OperationalError("refused"))
UNIQUE_VIOLATION = IntegrityError("INSERT", {}, pg_errors.UniqueViolation("dup"))


def call_raising(error: Exception) -> httpx2.Response:
    api = FastAPI(exception_handlers=EXCEPTION_HANDLERS)

    @api.get("/fail")
    def fail() -> None:
        raise error

    return TestClient(api, raise_server_exceptions=False).get("/fail")


@pytest.mark.parametrize(
    ("error", "status_code", "code", "headers"),
    [
        (UnauthorizedError(), 401, "unauthorized", {"WWW-Authenticate": "Bearer"}),
        (
            ConflictError("Already registered", code="already_registered"),
            409,
            "already_registered",
            {},
        ),
        (
            StarletteHTTPException(405, headers={"Allow": "GET"}),
            405,
            "method_not_allowed",
            {"Allow": "GET"},
        ),
        (DB_DOWN, 503, "service_unavailable", {"Retry-After": "5"}),
        (
            OperationalError("SELECT 1", {}, pg_errors.LockNotAvailable("timeout")),
            503,
            "service_unavailable",
            {"Retry-After": "5"},
        ),
        (UNIQUE_VIOLATION, 409, "conflict", {}),
        (
            PoolTimeoutError("exhausted"),
            503,
            "service_unavailable",
            {"Retry-After": "5"},
        ),
    ],
    ids=[
        "app-error-headers",
        "app-error-custom-code",
        "http-exception",
        "db-down",
        "lock-timeout",
        "unique-violation",
        "pool-exhausted",
    ],
)
def test_maps_errors_to_common_schema(
    error: Exception, status_code: int, code: str, headers: dict[str, str]
) -> None:
    response = call_raising(error)

    assert response.status_code == status_code
    assert ErrorResponse.model_validate(response.json()).code == code
    assert {name: response.headers.get(name) for name in headers} == headers


@pytest.mark.parametrize(
    "error",
    [
        RuntimeError("secret internals"),
        IntegrityError("INSERT", {}, pg_errors.ForeignKeyViolation("secret internals")),
    ],
    ids=["unexpected", "unmapped-db-error"],
)
def test_unexpected_errors_return_generic_500(error: Exception) -> None:
    response = call_raising(error)

    assert response.status_code == 500
    assert response.json() == {
        "code": "internal_error",
        "message": "Internal server error",
        "details": None,
    }


@pytest.mark.parametrize(
    "error", [DB_DOWN, UNIQUE_VIOLATION], ids=["unavailable", "constraint"]
)
def test_db_errors_are_logged_with_request_context(
    error: Exception, caplog: pytest.LogCaptureFixture
) -> None:
    call_raising(error)

    [record] = [r for r in caplog.records if r.name == "app.shared.exceptions"]
    assert "GET /fail" in record.getMessage()
    assert record.exc_info is not None


class Payload(BaseModel):
    password: str
    age: int


def test_validation_errors_list_fields_without_echoing_input() -> None:
    api = FastAPI(exception_handlers=EXCEPTION_HANDLERS)

    @api.post("/payload")
    def create(payload: Payload) -> None: ...

    response = TestClient(api).post(
        "/payload", json={"password": "hunter2", "age": "abc"}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert [(d["field"], d["type"]) for d in body["details"]] == [
        ("body.age", "int_parsing")
    ]
    assert "hunter2" not in response.text


class SeatsTakenError(ConflictError):
    code = "seats_taken"
    message = "No seats left"
    description = "Every seat is taken."


class OverlapError(ConflictError):
    code = "overlap"
    description = "Another session uses the room."


def test_error_responses_document_each_error_class_under_its_status() -> None:
    responses = error_responses(404, SeatsTakenError, OverlapError)

    assert set(responses) == {404, 409, 422, 503}
    assert all(response["model"] is ErrorResponse for response in responses.values())
    assert responses[404] == {
        "model": ErrorResponse,
        "description": "Resource not found",
    }
    assert responses[409]["description"].endswith(
        "\n\n- `seats_taken`: Every seat is taken."
        "\n- `overlap`: Another session uses the room."
    )
    examples = responses[409]["content"]["application/json"]["examples"]
    assert examples["seats_taken"]["value"] == {
        "code": "seats_taken",
        "message": "No seats left",
        "details": None,
    }
    assert examples["overlap"]["value"]["message"] == ConflictError.message
