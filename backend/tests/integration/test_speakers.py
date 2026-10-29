from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import create_access_token
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.events.models import Event
from app.modules.sessions.models import EventSession, SessionSpeaker, SessionStatus
from app.modules.users.models import RoleCode
from app.shared.datetimes import utc_now
from app.shared.models import id_of


@pytest.fixture
def organizer(client: TestClient, session: Session) -> TestClient:
    user = auth_service.register(
        session,
        RegisterRequest(email="org@example.com", password="pw-123456", full_name="O"),
        roles=(RoleCode.ORGANIZER,),
    )
    client.headers["Authorization"] = f"Bearer {create_access_token(id_of(user))}"
    return client


def create_speaker(client: TestClient, full_name: str) -> int:
    return client.post("/api/v1/speakers", json={"full_name": full_name}).json()["id"]


def test_search_matches_part_of_the_name_and_escapes_wildcards(
    organizer: TestClient,
) -> None:
    for name in ("Grace Hopper", "Ada Lovelace", "Adam 100%"):
        create_speaker(organizer, name)

    def names(query: str) -> list[str]:
        page = organizer.get("/api/v1/speakers", params={"name": query}).json()
        return [item["full_name"] for item in page["items"]]

    assert names("ADA") == ["Ada Lovelace", "Adam 100%"]
    assert names("%") == ["Adam 100%"]
    assert names("_") == []


def test_speakers_assigned_to_a_session_cannot_be_deleted(
    organizer: TestClient, session: Session
) -> None:
    assigned, free = create_speaker(organizer, "Ada"), create_speaker(organizer, "Bob")
    now = utc_now()
    event = Event(
        owner_id=organizer.get("/api/v1/users/me").json()["id"],
        title="PyCon",
        capacity=500,
        starts_at=now,
        ends_at=now + timedelta(days=1),
        timezone="America/Bogota",
    )
    session.add(event)
    session.flush()
    talk = EventSession(
        event_id=id_of(event),
        title="Talk",
        capacity=50,
        status=SessionStatus.CANCELLED,
        starts_at=now,
        ends_at=now + timedelta(hours=1),
    )
    session.add(talk)
    session.flush()
    session.add(SessionSpeaker(session_id=id_of(talk), speaker_id=assigned))
    session.flush()

    blocked = organizer.delete(f"/api/v1/speakers/{assigned}")
    deleted = organizer.delete(f"/api/v1/speakers/{free}")

    assert blocked.json()["code"] == "speaker_has_sessions"
    assert organizer.get(f"/api/v1/speakers/{assigned}").status_code == 200
    assert deleted.status_code == 204
    assert organizer.get(f"/api/v1/speakers/{free}").status_code == 404
