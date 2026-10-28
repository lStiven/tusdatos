from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User
from app.modules.venues import service as venues_service
from app.modules.venues.models import Venue
from app.shared.pagination import PageParams

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
VENUE = Venue(id=7, name="Ágora", address=None, city="Bogotá", is_active=True)
VENUE_JSON = {
    "id": 7,
    "name": "Ágora",
    "address": None,
    "city": "Bogotá",
    "is_active": True,
}
WRITES = [
    ("post", "/api/v1/venues", {"name": "Ágora"}),
    ("patch", "/api/v1/venues/7", {"city": "Cali"}),
    ("post", "/api/v1/venues/7/rooms", {"name": "A1", "capacity": 10}),
    ("patch", "/api/v1/venues/7/rooms/12", {"capacity": 10}),
]


@pytest.fixture
def as_admin() -> Iterator[None]:
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[require_admin] = lambda: USER
    yield


@pytest.mark.parametrize(("method", "path", "body"), WRITES)
def test_writes_are_forbidden_without_the_admin_role(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    body: dict[str, object],
) -> None:
    app.dependency_overrides[get_current_user] = lambda: USER
    monkeypatch.setattr(
        users_repository,
        "get_role_codes",
        lambda session, user_id: [RoleCode.ORGANIZER],
    )

    response = client.request(method, path, json=body)

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


@pytest.mark.usefixtures("as_admin")
def test_create_venue_returns_201(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(venues_service, "create_venue", lambda session, data: VENUE)

    response = client.post("/api/v1/venues", json={"name": "Ágora"})

    assert response.status_code == 201
    assert response.json() == VENUE_JSON


@pytest.mark.usefixtures("as_admin")
def test_list_venues_passes_filters_and_returns_a_page(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: list[tuple[bool | None, PageParams]] = []

    def list_venues(
        session: object, *, is_active: bool | None, page: PageParams
    ) -> tuple[list[Venue], int]:
        received.append((is_active, page))
        return [VENUE], 3

    monkeypatch.setattr(venues_service, "list_venues", list_venues)

    response = client.get("/api/v1/venues?is_active=true&limit=1&offset=2")

    assert received == [(True, PageParams(limit=1, offset=2))]
    assert response.json() == {
        "items": [VENUE_JSON],
        "total": 3,
        "limit": 1,
        "offset": 2,
    }


@pytest.mark.usefixtures("as_admin")
@pytest.mark.parametrize(
    ("method", "path", "body", "field"),
    [
        ("patch", "/api/v1/venues/7", {"name": None}, "body.name"),
        (
            "post",
            "/api/v1/venues/7/rooms",
            {"name": "A1", "capacity": 0},
            "body.capacity",
        ),
        ("patch", "/api/v1/venues/7/rooms/12", {"is_active": None}, "body.is_active"),
        ("get", "/api/v1/venues?limit=101", None, "query.limit"),
    ],
    ids=["null-venue-name", "empty-room", "null-room-status", "page-too-big"],
)
def test_rejects_invalid_input(
    client: TestClient,
    method: str,
    path: str,
    body: dict[str, object] | None,
    field: str,
) -> None:
    response = client.request(method, path, json=body)

    assert response.status_code == 422
    assert [d["field"] for d in response.json()["details"]] == [field]


def test_every_operation_is_protected_and_documented(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    operations = {
        (method, path): operation
        for path, item in paths.items()
        if path.startswith("/api/v1/venues")
        for method, operation in item.items()
    }

    assert len(operations) == 7
    for (method, _), operation in operations.items():
        assert operation["tags"] == ["venues"]
        assert operation["security"] == [{"OAuth2PasswordBearer": []}]
        assert "401" in operation["responses"]
        assert ("403" in operation["responses"]) == (method in {"post", "patch"})
