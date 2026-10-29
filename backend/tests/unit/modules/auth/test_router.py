import pytest
from fastapi.testclient import TestClient

from app.modules.auth import service as auth_service
from app.modules.auth.schemas import TokenResponse
from app.modules.users import service as users_service
from app.modules.users.models import RoleCode, User
from app.modules.users.schemas import UserRead

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
PROFILE = UserRead(
    id=1,
    email="ana@example.com",
    full_name="Ana",
    is_active=True,
    roles=[RoleCode.ATTENDEE],
)
REGISTRATION = {
    "email": "ana@example.com",
    "password": "correct horse",
    "full_name": "Ana",
}


def test_register_returns_201_with_the_profile(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth_service, "register", lambda session, data: USER)
    monkeypatch.setattr(users_service, "get_profile", lambda session, user: PROFILE)

    response = client.post("/api/v1/auth/register", json=REGISTRATION)

    assert response.status_code == 201
    assert response.json() == PROFILE.model_dump(mode="json")


@pytest.mark.parametrize(
    "password", ["7-chars", "x" * 129], ids=["too-short", "too-long"]
)
def test_register_enforces_the_password_length(
    client: TestClient, password: str
) -> None:
    response = client.post(
        "/api/v1/auth/register", json={**REGISTRATION, "password": password}
    )

    assert response.status_code == 422
    assert [d["field"] for d in response.json()["details"]] == ["body.password"]


def test_login_reads_form_data_and_returns_a_bearer_token(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: list[tuple[str, str]] = []

    def authenticate(session: object, email: str, password: str) -> User:
        received.append((email, password))
        return USER

    monkeypatch.setattr(auth_service, "authenticate", authenticate)
    monkeypatch.setattr(
        auth_service,
        "issue_token",
        lambda user: TokenResponse(access_token="jwt", expires_in=1800),
    )

    response = client.post(
        "/api/v1/auth/token", data={"username": "ana@example.com", "password": "pw"}
    )

    assert received == [("ana@example.com", "pw")]
    assert response.json() == {
        "access_token": "jwt",
        "token_type": "bearer",
        "expires_in": 1800,
    }


@pytest.mark.parametrize(
    ("path", "status_codes"),
    [
        ("/api/v1/auth/register", {"201", "409", "422", "503"}),
        ("/api/v1/auth/token", {"200", "401", "422", "503"}),
    ],
)
def test_is_documented_in_openapi(
    client: TestClient, path: str, status_codes: set[str]
) -> None:
    operation = client.get("/openapi.json").json()["paths"][path]["post"]

    assert operation["tags"] == ["auth"]
    assert set(operation["responses"]) == status_codes
