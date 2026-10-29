from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.dependencies import get_current_user
from app.modules.sessions import service as sessions_service
from app.modules.sessions.exceptions import RoomNotAvailableError
from app.modules.sessions.models import SessionStatus
from app.modules.sessions.schemas import SessionRead
from app.modules.users.models import User

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
SESSION = SessionRead(
    id=57,
    event_id=42,
    title="Async SQL",
    description=None,
    capacity=80,
    status=SessionStatus.SCHEDULED,
    starts_at=datetime(2026, 11, 20, 15, tzinfo=UTC),
    ends_at=datetime(2026, 11, 20, 16, tzinfo=UTC),
    room=None,
    speakers=[],
    interested=96,
    interest_percent=120.0,
    overdemand=True,
    is_interested=False,
)
SESSION_JSON = SESSION.model_dump(mode="json")
NEW = {
    "title": "Async SQL",
    "capacity": 80,
    "starts_at": "2026-11-20T10:00:00-05:00",
    "ends_at": "2026-11-20T11:00:00-05:00",
}


@pytest.fixture(autouse=True)
def as_user() -> None:
    app.dependency_overrides[get_current_user] = lambda: USER


@pytest.mark.parametrize(
    ("method", "path", "body", "service_name", "status_code", "returned"),
    [
        ("post", "/events/42/sessions", NEW, "create_session", 201, SESSION),
        ("get", "/events/42/sessions", None, "list_sessions", 200, [SESSION]),
        ("get", "/sessions/57", None, "get_session", 200, SESSION),
        ("patch", "/sessions/57", {"title": "X"}, "update_session", 200, SESSION),
        ("post", "/sessions/57/schedule", None, "schedule_session", 200, SESSION),
        ("post", "/sessions/57/unschedule", None, "unschedule_session", 200, SESSION),
        ("post", "/sessions/57/cancel", None, "cancel_session", 200, SESSION),
        ("put", "/sessions/57/interest", None, "mark_interest", 204, None),
        ("delete", "/sessions/57/interest", None, "withdraw_interest", 204, None),
    ],
)
def test_each_operation_calls_its_service(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    body: dict[str, object] | None,
    service_name: str,
    status_code: int,
    returned: object,
) -> None:
    received: list[tuple[object, ...]] = []

    def service(session: object, user: User, *args: object) -> object:
        received.append((user, *args))
        return returned

    monkeypatch.setattr(sessions_service, service_name, service)

    response = client.request(method, f"/api/v1{path}", json=body)

    assert response.status_code == status_code
    assert received[0][:2] == (USER, 42 if path.startswith("/events") else 57)
    if returned is not None:
        expected = [SESSION_JSON] if isinstance(returned, list) else SESSION_JSON
        assert response.json() == expected


def test_business_errors_keep_their_code(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def taken(*args: object) -> None:
        raise RoomNotAvailableError()

    monkeypatch.setattr(sessions_service, "schedule_session", taken)

    response = client.post("/api/v1/sessions/57/schedule")

    assert (response.status_code, response.json()["code"]) == (
        409,
        "room_not_available",
    )


@pytest.mark.parametrize("field", ["title", "capacity", "starts_at", "speaker_ids"])
def test_update_rejects_null_where_a_value_is_required(
    client: TestClient, field: str
) -> None:
    response = client.patch("/api/v1/sessions/57", json={field: None})

    assert response.status_code == 422
    assert [d["field"] for d in response.json()["details"]] == [f"body.{field}"]


def test_every_operation_is_protected_and_documented(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    operations = {
        (method, path): operation
        for path, item in paths.items()
        for method, operation in item.items()
        if operation["tags"] == ["sessions"]
    }

    assert len(operations) == 9
    for operation in operations.values():
        assert operation["security"] == [{"OAuth2PasswordBearer": []}]
        assert "401" in operation["responses"]
    create = operations[("post", "/api/v1/events/{event_id}/sessions")]
    assert {"201", "403", "404", "409"} <= set(create["responses"])
    schedule = operations[("post", "/api/v1/sessions/{session_id}/schedule")]
    conflicts = schedule["responses"]["409"]["description"]
    assert "room_not_available" in conflicts
    assert "speaker_not_available" in conflicts
