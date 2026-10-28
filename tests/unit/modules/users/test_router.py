import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.dependencies import get_current_user
from app.modules.users import service as users_service
from app.modules.users.models import RoleCode, User
from app.modules.users.schemas import UserRead

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
PROFILE = UserRead(
    id=1, email="ana@example.com", full_name="Ana", roles=[RoleCode.ATTENDEE]
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
