from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.dependencies import get_current_user
from app.modules.events import service as events_service
from app.modules.events.exceptions import EventNotFoundError
from app.modules.events.models import Event, EventStatus
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User
from app.shared.pagination import PageParams

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
EVENT = Event(
    id=42,
    owner_id=5,
    venue_id=None,
    title="PyCon",
    description=None,
    capacity=500,
    status=EventStatus.PUBLISHED,
    starts_at=datetime(2026, 11, 20, 14, tzinfo=UTC),
    ends_at=datetime(2026, 11, 22, 23, tzinfo=UTC),
    registration_closes_at=None,
    timezone="America/Bogota",
)
EVENT_JSON = {
    "id": 42,
    "owner_id": 5,
    "venue_id": None,
    "title": "PyCon",
    "description": None,
    "capacity": 500,
    "status": "PUBLISHED",
    "starts_at": "2026-11-20T14:00:00Z",
    "ends_at": "2026-11-22T23:00:00Z",
    "registration_closes_at": None,
    "timezone": "America/Bogota",
}


@pytest.fixture(autouse=True)
def as_user() -> None:
    app.dependency_overrides[get_current_user] = lambda: USER


def test_list_events_passes_filters_and_returns_a_page(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: list[dict[str, object]] = []

    def list_events(
        session: object, viewer: User, **filters: object
    ) -> tuple[list[Event], int]:
        received.append({"viewer": viewer, **filters})
        return [EVENT], 3

    monkeypatch.setattr(events_service, "list_events", list_events)

    response = client.get(
        "/api/v1/events?title=py&status=PUBLISHED&mine=true&limit=1&offset=2"
    )

    assert received == [
        {
            "viewer": USER,
            "title": "py",
            "status": EventStatus.PUBLISHED,
            "mine": True,
            "page": PageParams(limit=1, offset=2),
        }
    ]
    assert response.json() == {
        "items": [EVENT_JSON],
        "total": 3,
        "limit": 1,
        "offset": 2,
    }


def test_get_event_returns_it_or_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def get_event(session: object, viewer: User, event_id: int) -> Event:
        if event_id != 42:
            raise EventNotFoundError()
        return EVENT

    monkeypatch.setattr(events_service, "get_event", get_event)

    found = client.get("/api/v1/events/42")
    missing = client.get("/api/v1/events/43")

    assert found.json() == EVENT_JSON
    assert missing.status_code == 404
    assert missing.json()["code"] == "event_not_found"


NEW_EVENT = {
    "title": "PyCon",
    "capacity": 500,
    "starts_at": "2026-11-20T09:00:00-05:00",
    "ends_at": "2026-11-22T18:00:00-05:00",
    "timezone": "America/Bogota",
}


def test_create_event_returns_201_for_organizers_and_403_for_attendees(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    roles = [RoleCode.ORGANIZER]
    monkeypatch.setattr(
        users_repository, "get_role_codes", lambda session, user_id: roles
    )
    monkeypatch.setattr(
        events_service, "create_event", lambda session, owner, data: EVENT
    )

    created = client.post("/api/v1/events", json=NEW_EVENT)
    roles[:] = [RoleCode.ATTENDEE]
    forbidden = client.post("/api/v1/events", json=NEW_EVENT)

    assert (created.status_code, created.json()) == (201, EVENT_JSON)
    assert forbidden.status_code == 403
    assert forbidden.json()["code"] == "forbidden"


@pytest.mark.parametrize("action", ["publish", "complete", "cancel"])
def test_status_actions_call_their_service(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, action: str
) -> None:
    received: list[tuple[User, int]] = []

    def change(session: object, actor: User, event_id: int) -> Event:
        received.append((actor, event_id))
        return EVENT

    monkeypatch.setattr(events_service, f"{action}_event", change)

    response = client.post(f"/api/v1/events/42/{action}")

    assert (response.status_code, response.json()) == (200, EVENT_JSON)
    assert received == [(USER, 42)]


@pytest.mark.parametrize(
    ("method", "path", "body", "field"),
    [
        ("get", "/api/v1/events?status=OPEN", None, "query.status"),
        ("get", "/api/v1/events?limit=101", None, "query.limit"),
        (
            "post",
            "/api/v1/events",
            {**NEW_EVENT, "starts_at": "2026-11-20T09:00:00"},
            "body.starts_at",
        ),
        (
            "post",
            "/api/v1/events",
            {**NEW_EVENT, "timezone": "Mars/Olympus"},
            "body.timezone",
        ),
        ("patch", "/api/v1/events/42", {"capacity": None}, "body.capacity"),
    ],
    ids=["unknown-status", "page-too-big", "naive-datetime", "bad-zone", "null-cap"],
)
def test_rejects_invalid_input(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    body: dict[str, object] | None,
    field: str,
) -> None:
    monkeypatch.setattr(
        users_repository, "get_role_codes", lambda session, user_id: [RoleCode.ADMIN]
    )

    response = client.request(method, path, json=body)

    assert response.status_code == 422
    assert [d["field"] for d in response.json()["details"]] == [field]


def test_every_operation_is_protected_and_documented(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    operations = {
        (method, path): operation
        for path, item in paths.items()
        if path.startswith("/api/v1/events")
        for method, operation in item.items()
    }

    assert len(operations) == 7
    for (method, _), operation in operations.items():
        assert operation["tags"] == ["events"]
        assert operation["security"] == [{"OAuth2PasswordBearer": []}]
        assert "401" in operation["responses"]
        assert ("403" in operation["responses"]) == (method != "get")
