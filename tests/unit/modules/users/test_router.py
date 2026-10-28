import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.users import repository as users_repository
from app.modules.users import service as users_service
from app.modules.users.exceptions import LastAdminError
from app.modules.users.models import RoleCode, User
from app.modules.users.schemas import AssignableRole, UserRead
from app.shared.pagination import PageParams

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
PROFILE = UserRead(
    id=1,
    email="ana@example.com",
    full_name="Ana",
    is_active=True,
    roles=[RoleCode.ATTENDEE],
)


def test_me_rejects_requests_without_a_bearer_token(client: TestClient) -> None:
    response = client.get("/api/v1/users/me")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.json()["code"] == "unauthorized"


def test_me_returns_the_current_user_profile(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    app.dependency_overrides[get_current_user] = lambda: USER
    monkeypatch.setattr(users_service, "get_profile", lambda session, user: PROFILE)

    response = client.get("/api/v1/users/me")

    assert response.json() == PROFILE.model_dump(mode="json")


def test_me_is_documented_as_protected_in_openapi(client: TestClient) -> None:
    operation = client.get("/openapi.json").json()["paths"]["/api/v1/users/me"]["get"]

    assert operation["tags"] == ["users"]
    assert operation["security"] == [{"OAuth2PasswordBearer": []}]
    assert set(operation["responses"]) == {"200", "401", "422", "503"}


@pytest.fixture
def as_admin() -> None:
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[require_admin] = lambda: USER


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/v1/users"),
        ("get", "/api/v1/users/2"),
        ("put", "/api/v1/users/2/roles/ORGANIZER"),
        ("delete", "/api/v1/users/2/roles/ADMIN"),
    ],
)
def test_user_management_is_forbidden_without_the_admin_role(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, method: str, path: str
) -> None:
    app.dependency_overrides[get_current_user] = lambda: USER
    monkeypatch.setattr(
        users_repository,
        "get_role_codes",
        lambda session, user_id: [RoleCode.ORGANIZER],
    )

    response = client.request(method, path)

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


@pytest.mark.usefixtures("as_admin")
def test_list_users_passes_filters_and_returns_a_page(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: list[tuple[str | None, RoleCode | None, PageParams]] = []

    def list_users(
        session: object, *, email: str | None, role: RoleCode | None, page: PageParams
    ) -> tuple[list[UserRead], int]:
        received.append((email, role, page))
        return [PROFILE], 3

    monkeypatch.setattr(users_service, "list_users", list_users)

    response = client.get("/api/v1/users?email=ana&role=ADMIN&limit=1&offset=2")

    assert received == [("ana", RoleCode.ADMIN, PageParams(limit=1, offset=2))]
    assert response.json() == {
        "items": [PROFILE.model_dump(mode="json")],
        "total": 3,
        "limit": 1,
        "offset": 2,
    }


@pytest.mark.usefixtures("as_admin")
def test_grant_and_revoke_call_the_service_with_the_role(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[tuple[str, int, AssignableRole]] = []

    def grant(
        session: object, actor: User, user_id: int, role: AssignableRole
    ) -> UserRead:
        calls.append(("grant", user_id, role))
        return PROFILE

    monkeypatch.setattr(users_service, "grant_role", grant)

    def revoke(session: object, user_id: int, role: AssignableRole) -> UserRead:
        raise LastAdminError()

    monkeypatch.setattr(users_service, "revoke_role", revoke)

    granted = client.put("/api/v1/users/2/roles/ORGANIZER")
    last = client.delete("/api/v1/users/2/roles/ADMIN")

    assert (granted.status_code, calls) == (
        200,
        [("grant", 2, AssignableRole.ORGANIZER)],
    )
    assert (last.status_code, last.json()["code"]) == (409, "last_admin")


@pytest.mark.usefixtures("as_admin")
@pytest.mark.parametrize(
    ("method", "path", "field"),
    [
        ("put", "/api/v1/users/2/roles/ATTENDEE", "path.role"),
        ("get", "/api/v1/users?role=ROOT", "query.role"),
    ],
    ids=["attendee-not-assignable", "unknown-role"],
)
def test_rejects_invalid_roles(
    client: TestClient, method: str, path: str, field: str
) -> None:
    response = client.request(method, path)

    assert response.status_code == 422
    assert [d["field"] for d in response.json()["details"]] == [field]


def test_admin_operations_are_documented(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    operations = {
        (method, path): operation
        for path, item in paths.items()
        if path.startswith("/api/v1/users") and path != "/api/v1/users/me"
        for method, operation in item.items()
    }

    assert len(operations) == 4
    for operation in operations.values():
        assert operation["tags"] == ["users"]
        assert operation["security"] == [{"OAuth2PasswordBearer": []}]
        assert {"401", "403"} <= set(operation["responses"])
    revoke = operations[("delete", "/api/v1/users/{user_id}/roles/{role}")]
    assert "last_admin" in revoke["responses"]["409"]["description"]
