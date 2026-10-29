from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.dependencies import get_current_user
from app.modules.registrations import service as registrations_service
from app.modules.registrations.exceptions import RegistrationClosedError
from app.modules.registrations.models import RegistrationStatus
from app.modules.registrations.schemas import RegistrationRead
from app.modules.users.models import User
from app.shared.pagination import PageParams

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
REGISTRATION = RegistrationRead(
    id=81,
    event_id=42,
    status=RegistrationStatus.WAITLISTED,
    waitlist_position=3,
    requested_at=datetime(2026, 11, 1, 15, tzinfo=UTC),
    confirmed_at=None,
    cancelled_at=None,
)
REGISTRATION_JSON = REGISTRATION.model_dump(mode="json")


@pytest.fixture(autouse=True)
def as_user() -> None:
    app.dependency_overrides[get_current_user] = lambda: USER


@pytest.mark.parametrize(("created", "status_code"), [(True, 201), (False, 200)])
def test_register_answers_201_when_new_and_200_when_already_registered(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    created: bool,
    status_code: int,
) -> None:
    monkeypatch.setattr(
        registrations_service,
        "register",
        lambda session, user, event_id: (REGISTRATION, created),
    )

    response = client.post("/api/v1/events/42/registrations")

    assert (response.status_code, response.json()) == (status_code, REGISTRATION_JSON)


def test_register_reports_business_errors(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def closed(session: object, user: User, event_id: int) -> None:
        raise RegistrationClosedError()

    monkeypatch.setattr(registrations_service, "register", closed)

    response = client.post("/api/v1/events/42/registrations")

    assert (response.status_code, response.json()["code"]) == (
        409,
        "registration_closed",
    )


@pytest.mark.parametrize(
    ("path", "service_name"),
    [
        ("/api/v1/users/me/registrations?status=WAITLISTED&limit=1", "list_mine"),
        ("/api/v1/events/42/registrations?status=WAITLISTED&limit=1", "list_for_event"),
    ],
)
def test_lists_pass_the_status_filter_and_paginate(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, path: str, service_name: str
) -> None:
    received: list[tuple[RegistrationStatus | None, PageParams]] = []

    def listing(
        session: object,
        *args: object,
        status: RegistrationStatus | None,
        page: PageParams,
    ) -> tuple[list[RegistrationRead], int]:
        received.append((status, page))
        return [], 0

    monkeypatch.setattr(registrations_service, service_name, listing)

    response = client.get(path)

    assert received == [(RegistrationStatus.WAITLISTED, PageParams(limit=1))]
    assert response.json() == {"items": [], "total": 0, "limit": 1, "offset": 0}


def test_rejects_an_unknown_status_filter(client: TestClient) -> None:
    response = client.get("/api/v1/users/me/registrations?status=PENDING")

    assert response.status_code == 422
    assert [d["field"] for d in response.json()["details"]] == ["query.status"]


def test_every_operation_is_protected_and_documented(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    operations = {
        (method, path): operation
        for path, item in paths.items()
        for method, operation in item.items()
        if operation["tags"] == ["registrations"]
    }

    assert len(operations) == 6
    for operation in operations.values():
        assert operation["security"] == [{"OAuth2PasswordBearer": []}]
        assert "401" in operation["responses"]
    register = operations[("post", "/api/v1/events/{event_id}/registrations")]
    assert {"200", "201", "404", "409", "503"} <= set(register["responses"])
    listing = operations[("get", "/api/v1/events/{event_id}/registrations")]
    assert "not_event_owner" in listing["responses"]["403"]["description"]
