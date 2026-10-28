import httpx2
from fastapi.testclient import TestClient


def register(client: TestClient, email: str = "Ana@Example.com") -> httpx2.Response:
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct horse", "full_name": "Ana"},
    )


def test_register_login_and_read_own_profile(client: TestClient) -> None:
    registered = register(client)
    token = client.post(
        "/api/v1/auth/token",
        data={"username": "ANA@example.com", "password": "correct horse"},
    ).json()["access_token"]

    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})

    assert registered.status_code == 201
    assert registered.json()["email"] == "ana@example.com"
    assert registered.json()["roles"] == ["ATTENDEE"]
    assert me.json() == registered.json()


def test_email_is_taken_regardless_of_case(client: TestClient) -> None:
    register(client)

    response = register(client, "ANA@EXAMPLE.COM")

    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"
