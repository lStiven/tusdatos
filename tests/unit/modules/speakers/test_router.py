import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.dependencies import get_current_user
from app.modules.speakers import service as speakers_service
from app.modules.speakers.exceptions import SpeakerHasSessionsError
from app.modules.speakers.models import Speaker
from app.modules.speakers.router import require_speaker_manager
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User
from app.shared.pagination import PageParams

USER = User(id=1, email="ana@example.com", password_hash="hash", full_name="Ana")
SPEAKER = Speaker(id=3, full_name="Ada Lovelace", email=None, bio="Mathematician")
SPEAKER_JSON = {
    "id": 3,
    "full_name": "Ada Lovelace",
    "email": None,
    "bio": "Mathematician",
}
WRITES = [
    ("post", "/api/v1/speakers", {"full_name": "Ada"}),
    ("patch", "/api/v1/speakers/3", {"bio": None}),
    ("delete", "/api/v1/speakers/3", None),
]


@pytest.fixture
def as_manager() -> None:
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[require_speaker_manager] = lambda: USER


@pytest.mark.parametrize(("method", "path", "body"), WRITES)
def test_writes_are_forbidden_to_attendees(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    body: dict[str, object] | None,
) -> None:
    app.dependency_overrides[get_current_user] = lambda: USER
    monkeypatch.setattr(
        users_repository, "get_role_codes", lambda session, user_id: [RoleCode.ATTENDEE]
    )

    response = client.request(method, path, json=body)

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


@pytest.mark.usefixtures("as_manager")
def test_create_speaker_returns_201(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        speakers_service, "create_speaker", lambda session, data: SPEAKER
    )

    response = client.post("/api/v1/speakers", json={"full_name": "Ada Lovelace"})

    assert response.status_code == 201
    assert response.json() == SPEAKER_JSON


@pytest.mark.usefixtures("as_manager")
def test_list_speakers_passes_filters_and_returns_a_page(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: list[tuple[str | None, PageParams]] = []

    def list_speakers(
        session: object, *, name: str | None, page: PageParams
    ) -> tuple[list[Speaker], int]:
        received.append((name, page))
        return [SPEAKER], 3

    monkeypatch.setattr(speakers_service, "list_speakers", list_speakers)

    response = client.get("/api/v1/speakers?name=ada&limit=1&offset=2")

    assert received == [("ada", PageParams(limit=1, offset=2))]
    assert response.json() == {
        "items": [SPEAKER_JSON],
        "total": 3,
        "limit": 1,
        "offset": 2,
    }


@pytest.mark.usefixtures("as_manager")
def test_delete_speaker_returns_204_or_409_when_assigned(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def delete_speaker(session: object, speaker_id: int) -> None:
        if speaker_id == 4:
            raise SpeakerHasSessionsError()

    monkeypatch.setattr(speakers_service, "delete_speaker", delete_speaker)

    deleted = client.delete("/api/v1/speakers/3")
    assigned = client.delete("/api/v1/speakers/4")

    assert (deleted.status_code, deleted.content) == (204, b"")
    assert assigned.status_code == 409
    assert assigned.json()["code"] == "speaker_has_sessions"


@pytest.mark.usefixtures("as_manager")
@pytest.mark.parametrize(
    ("method", "path", "body", "field"),
    [
        ("post", "/api/v1/speakers", {"full_name": ""}, "body.full_name"),
        ("post", "/api/v1/speakers", {"full_name": "A", "email": "x"}, "body.email"),
        ("patch", "/api/v1/speakers/3", {"full_name": None}, "body.full_name"),
        ("get", "/api/v1/speakers?limit=101", None, "query.limit"),
    ],
    ids=["empty-name", "invalid-email", "null-name", "page-too-big"],
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
        if path.startswith("/api/v1/speakers")
        for method, operation in item.items()
    }

    assert len(operations) == 5
    for (method, _), operation in operations.items():
        assert operation["tags"] == ["speakers"]
        assert operation["security"] == [{"OAuth2PasswordBearer": []}]
        assert "401" in operation["responses"]
        assert ("403" in operation["responses"]) == (method != "get")
