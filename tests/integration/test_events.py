from datetime import timedelta
from itertools import count

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.security import create_access_token
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.events.models import Event, EventStatus
from app.modules.registrations.models import (
    EventRegistration,
    RegistrationStatus,
    RegistrationStatusHistory,
)
from app.modules.sessions.models import EventSession, SessionInterest, SessionStatus
from app.modules.users.models import RoleCode
from app.modules.venues.models import Room, Venue
from app.shared.datetimes import utc_now
from app.shared.models import id_of


def login_as(client: TestClient, session: Session, email: str, role: RoleCode) -> int:
    user = auth_service.register(
        session,
        RegisterRequest(email=email, password="pw-123456", full_name="U"),
        roles=(role,),
    )
    client.headers["Authorization"] = f"Bearer {create_access_token(id_of(user))}"
    return id_of(user)


@pytest.fixture
def events(session: Session) -> dict[str, int]:
    owner = auth_service.register(
        session,
        RegisterRequest(email="org@example.com", password="pw-123456", full_name="O"),
        roles=(RoleCode.ORGANIZER,),
    )
    now = utc_now()
    rows = {
        "PyCon 100%": EventStatus.PUBLISHED,
        "Python draft": EventStatus.DRAFT,
        "Rust meetup": EventStatus.CANCELLED,
    }
    created: dict[str, int] = {}
    for days, (title, status) in enumerate(rows.items()):
        event = Event(
            owner_id=id_of(owner),
            title=title,
            capacity=100,
            status=status,
            starts_at=now + timedelta(days=days + 1),
            ends_at=now + timedelta(days=days + 2),
            timezone="America/Bogota",
        )
        session.add(event)
        session.flush()
        created[title] = id_of(event)
    return created


def titles(client: TestClient, query: str = "") -> list[str]:
    page = client.get(f"/api/v1/events?{query}").json()
    return [item["title"] for item in page["items"]]


def test_drafts_are_hidden_from_other_users(
    client: TestClient, session: Session, events: dict[str, int]
) -> None:
    login_as(client, session, "ana@example.com", RoleCode.ATTENDEE)

    assert titles(client) == ["PyCon 100%", "Rust meetup"]
    assert titles(client, "title=PY") == ["PyCon 100%"]
    assert titles(client, "title=%25") == ["PyCon 100%"]
    draft = client.get(f"/api/v1/events/{events['Python draft']}")
    assert draft.json()["code"] == "event_not_found"


def test_admins_see_every_draft_and_mine_filters_by_owner(
    client: TestClient, session: Session, events: dict[str, int]
) -> None:
    login_as(client, session, "boss@example.com", RoleCode.ADMIN)

    assert titles(client, "status=DRAFT") == ["Python draft"]
    assert client.get(f"/api/v1/events/{events['Python draft']}").status_code == 200
    assert titles(client, "mine=true") == []


def published_event(session: Session, owner_id: int, capacity: int) -> Event:
    venue = Venue(name="Ágora")
    session.add(venue)
    session.flush()
    now = utc_now()
    event = Event(
        owner_id=owner_id,
        venue_id=id_of(venue),
        title="PyCon",
        capacity=capacity,
        status=EventStatus.PUBLISHED,
        starts_at=now + timedelta(days=1),
        ends_at=now + timedelta(days=2),
        timezone="America/Bogota",
    )
    session.add(event)
    session.flush()
    return event


_attendees = count()


def register(
    session: Session, event: Event, status: RegistrationStatus, order: int | None
) -> EventRegistration:
    user = auth_service.register(
        session,
        RegisterRequest(
            email=f"attendee{next(_attendees)}@example.com",
            password="pw-123456",
            full_name="U",
        ),
    )
    registration = EventRegistration(
        event_id=id_of(event),
        user_id=id_of(user),
        status=status,
        waitlist_order=order,
        waitlisted_at=utc_now() if order else None,
    )
    session.add(registration)
    session.flush()
    return registration


def history(session: Session, registration: EventRegistration) -> list[tuple[str, str]]:
    rows = session.exec(
        select(RegistrationStatusHistory).where(
            RegistrationStatusHistory.registration_id == registration.id
        )
    ).all()
    return [(row.reason, row.to_status) for row in rows]


def test_organizer_creates_publishes_and_only_they_can_edit(
    client: TestClient, session: Session
) -> None:
    venue = Venue(name="Ágora")
    session.add(venue)
    session.flush()
    login_as(client, session, "org@example.com", RoleCode.ORGANIZER)
    now = utc_now()
    body = {
        "title": "PyCon",
        "capacity": 100,
        "starts_at": (now + timedelta(days=1)).isoformat(),
        "ends_at": (now + timedelta(days=2)).isoformat(),
        "timezone": "America/Bogota",
    }

    event = client.post("/api/v1/events", json=body).json()
    no_venue = client.post(f"/api/v1/events/{event['id']}/publish")
    client.patch(f"/api/v1/events/{event['id']}", json={"venue_id": id_of(venue)})
    published = client.post(f"/api/v1/events/{event['id']}/publish")
    login_as(client, session, "rival@example.com", RoleCode.ORGANIZER)
    rival = client.patch(f"/api/v1/events/{event['id']}", json={"title": "Mine"})

    assert event["status"] == "DRAFT"
    assert no_venue.json()["code"] == "event_requires_venue"
    assert published.json()["status"] == "PUBLISHED"
    assert rival.json()["code"] == "not_event_owner"


def test_raising_capacity_promotes_the_waitlist_in_order(
    client: TestClient, session: Session
) -> None:
    owner = login_as(client, session, "org@example.com", RoleCode.ORGANIZER)
    event = published_event(session, owner, capacity=2)
    for _ in range(2):
        register(session, event, RegistrationStatus.CONFIRMED, None)
    queue = [
        register(session, event, RegistrationStatus.WAITLISTED, order)
        for order in (1, 2, 3)
    ]
    url = f"/api/v1/events/{id_of(event)}"

    too_small = client.patch(url, json={"capacity": 1})
    grown = client.patch(url, json={"capacity": 4})

    assert too_small.json()["code"] == "capacity_below_confirmed"
    assert grown.json()["capacity"] == 4
    for registration in queue:
        session.refresh(registration)
    assert [r.status for r in queue] == ["CONFIRMED", "CONFIRMED", "WAITLISTED"]
    assert history(session, queue[0]) == [("PROMOTED", "CONFIRMED")]
    assert history(session, queue[2]) == []


def test_cancelling_an_event_cascades_once(
    client: TestClient, session: Session
) -> None:
    owner = login_as(client, session, "org@example.com", RoleCode.ORGANIZER)
    event = published_event(session, owner, capacity=1)
    confirmed = register(session, event, RegistrationStatus.CONFIRMED, None)
    waiting = register(session, event, RegistrationStatus.WAITLISTED, 1)
    assert event.venue_id is not None
    room = Room(venue_id=event.venue_id, name="A1", capacity=50)
    session.add(room)
    session.flush()
    talk = EventSession(
        event_id=id_of(event),
        room_id=id_of(room),
        title="Talk",
        capacity=50,
        status=SessionStatus.SCHEDULED,
        starts_at=event.starts_at,
        ends_at=event.starts_at + timedelta(hours=1),
    )
    session.add(talk)
    session.flush()
    interest = SessionInterest(user_id=confirmed.user_id, session_id=id_of(talk))
    session.add(interest)
    session.flush()
    url = f"/api/v1/events/{id_of(event)}"

    cancelled = client.post(f"{url}/cancel")
    retried = client.post(f"{url}/cancel")
    edit = client.patch(url, json={"title": "Back"})

    assert (cancelled.json()["status"], retried.status_code) == ("CANCELLED", 200)
    assert edit.json()["code"] == "event_not_editable"
    for row in (confirmed, waiting, talk, interest):
        session.refresh(row)
    assert (confirmed.status, waiting.status, talk.status) == ("CANCELLED",) * 3
    assert waiting.waitlist_order is None
    assert interest.withdrawn_at is not None
    assert history(session, waiting) == [("EVENT_CANCELLED", "CANCELLED")]
