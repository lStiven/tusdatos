from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import create_access_token
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.events.models import Event
from app.modules.sessions.models import EventSession, SessionStatus
from app.modules.users.models import RoleCode
from app.shared.datetimes import utc_now
from app.shared.models import id_of


@pytest.fixture
def admin(client: TestClient, session: Session) -> TestClient:
    user = auth_service.register(
        session,
        RegisterRequest(email="boss@example.com", password="pw-123456", full_name="B"),
        roles=(RoleCode.ADMIN,),
    )
    client.headers["Authorization"] = f"Bearer {create_access_token(id_of(user))}"
    return client


def create_venue(client: TestClient, name: str) -> int:
    return client.post("/api/v1/venues", json={"name": name}).json()["id"]


def test_room_names_are_unique_within_each_venue(admin: TestClient) -> None:
    first, second = create_venue(admin, "Ágora"), create_venue(admin, "Movistar")
    room = {"name": "A1", "capacity": 50}

    created = admin.post(f"/api/v1/venues/{first}/rooms", json=room)
    repeated = admin.post(f"/api/v1/venues/{first}/rooms", json=room)
    elsewhere = admin.post(f"/api/v1/venues/{second}/rooms", json=room)

    assert created.status_code == 201
    assert repeated.status_code == 409
    assert repeated.json()["code"] == "room_name_taken"
    assert elsewhere.status_code == 201


def test_lists_venues_by_name_filtered_by_status(admin: TestClient) -> None:
    for name in ("Beta", "Alfa"):
        create_venue(admin, name)
    closed = create_venue(admin, "Cerrada")
    admin.patch(f"/api/v1/venues/{closed}", json={"is_active": False})

    active = admin.get("/api/v1/venues?is_active=true").json()

    assert [venue["name"] for venue in active] == ["Alfa", "Beta"]


def test_only_upcoming_scheduled_sessions_bind_a_room(
    admin: TestClient, session: Session
) -> None:
    venue_id = create_venue(admin, "Ágora")
    room = admin.post(
        f"/api/v1/venues/{venue_id}/rooms", json={"name": "A1", "capacity": 100}
    ).json()
    now = utc_now()
    event = Event(
        owner_id=admin.get("/api/v1/users/me").json()["id"],
        title="PyCon",
        capacity=500,
        starts_at=now - timedelta(days=2),
        ends_at=now + timedelta(days=2),
        timezone="America/Bogota",
    )
    session.add(event)
    session.flush()
    for capacity, start in (
        (100, now - timedelta(days=1)),
        (80, now + timedelta(days=1)),
    ):
        session.add(
            EventSession(
                event_id=id_of(event),
                room_id=room["id"],
                title="Talk",
                capacity=capacity,
                status=SessionStatus.SCHEDULED,
                starts_at=start,
                ends_at=start + timedelta(hours=1),
            )
        )
    session.flush()
    room_url = f"/api/v1/venues/{venue_id}/rooms/{room['id']}"

    too_small = admin.patch(room_url, json={"capacity": 79})
    fits = admin.patch(room_url, json={"capacity": 80})
    room_off = admin.patch(room_url, json={"is_active": False})
    venue_off = admin.patch(f"/api/v1/venues/{venue_id}", json={"is_active": False})

    assert too_small.json()["code"] == "room_capacity_below_sessions"
    assert fits.json()["capacity"] == 80
    assert room_off.json()["code"] == "room_has_scheduled_sessions"
    assert venue_off.json()["code"] == "venue_has_scheduled_sessions"
