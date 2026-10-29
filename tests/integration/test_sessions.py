from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import create_access_token
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.events.models import Event, EventStatus
from app.modules.registrations.models import EventRegistration, RegistrationStatus
from app.modules.speakers.models import Speaker
from app.modules.users.models import RoleCode
from app.modules.venues.models import Room, Venue
from app.shared.datetimes import utc_now
from app.shared.models import id_of

START = (utc_now() + timedelta(days=1)).replace(microsecond=0)


def at(hour: float) -> str:
    return (START + timedelta(hours=hour)).isoformat()


@dataclass
class World:
    tokens: dict[str, str]
    event_id: int
    rival_event_id: int
    big_room: int
    small_room: int
    ada: int
    alan: int


def make_event(session: Session, owner_id: int, venue_id: int, end: datetime) -> int:
    event = Event(
        owner_id=owner_id,
        venue_id=venue_id,
        title="PyCon",
        capacity=2,
        status=EventStatus.PUBLISHED,
        starts_at=START,
        ends_at=end,
        timezone="America/Bogota",
        next_waitlist_order=2,
    )
    session.add(event)
    session.flush()
    return id_of(event)


@pytest.fixture
def world(session: Session) -> World:
    tokens, ids = {}, {}
    organizers = {"org", "rival"}
    for name in ("org", "rival", "ana", "carl", "bob"):
        user = auth_service.register(
            session,
            RegisterRequest(
                email=f"{name}@example.com", password="pw-123456", full_name=name
            ),
            roles=(RoleCode.ATTENDEE, RoleCode.ORGANIZER)
            if name in organizers
            else (RoleCode.ATTENDEE,),
        )
        tokens[name] = f"Bearer {create_access_token(id_of(user))}"
        ids[name] = id_of(user)
    venue = Venue(name="Main venue")
    speakers = [Speaker(full_name="Ada"), Speaker(full_name="Alan")]
    session.add_all([venue, *speakers])
    session.flush()
    rooms = [
        Room(venue_id=id_of(venue), name="Big", capacity=50),
        Room(venue_id=id_of(venue), name="Small", capacity=20),
    ]
    session.add_all(rooms)
    event_id = make_event(session, ids["org"], id_of(venue), START + timedelta(hours=8))
    rival_event_id = make_event(
        session, ids["rival"], id_of(venue), START + timedelta(hours=8)
    )
    session.add_all(
        [
            EventRegistration(
                event_id=event_id,
                user_id=ids[name],
                status=RegistrationStatus.CONFIRMED,
            )
            for name in ("ana", "carl")
        ]
        + [
            EventRegistration(
                event_id=event_id,
                user_id=ids["bob"],
                status=RegistrationStatus.WAITLISTED,
                waitlist_order=1,
                waitlisted_at=utc_now(),
            )
        ]
    )
    session.flush()
    return World(
        tokens,
        event_id,
        rival_event_id,
        id_of(rooms[0]),
        id_of(rooms[1]),
        id_of(speakers[0]),
        id_of(speakers[1]),
    )


def as_(client: TestClient, world: World, name: str) -> TestClient:
    client.headers["Authorization"] = world.tokens[name]
    return client


def create(
    client: TestClient, event_id: int, start: float, end: float, **fields: object
) -> dict[str, object]:
    response = client.post(
        f"/api/v1/events/{event_id}/sessions",
        json={
            "title": "Talk",
            "capacity": 10,
            "starts_at": at(start),
            "ends_at": at(end),
            **fields,
        },
    )
    assert response.status_code == 201, response.json()
    return response.json()


def test_rooms_and_speakers_never_overlap_across_events(
    client: TestClient, world: World
) -> None:
    mine = create(
        as_(client, world, "org"),
        world.event_id,
        1,
        2,
        room_id=world.big_room,
        speaker_ids=[world.ada],
    )
    scheduled = client.post(f"/api/v1/sessions/{mine['id']}/schedule").json()

    rival = as_(client, world, "rival")
    same_room = create(rival, world.rival_event_id, 1.5, 2.5, room_id=world.big_room)
    same_speaker = create(
        rival,
        world.rival_event_id,
        1.5,
        2.5,
        room_id=world.small_room,
        speaker_ids=[world.ada],
    )
    back_to_back = create(rival, world.rival_event_id, 2, 3, room_id=world.big_room)
    results = [
        rival.post(f"/api/v1/sessions/{created['id']}/schedule").json()
        for created in (same_room, same_speaker, back_to_back)
    ]
    moved = rival.patch(
        f"/api/v1/sessions/{back_to_back['id']}", json={"starts_at": at(1.5)}
    )

    assert scheduled["status"] == "SCHEDULED"
    assert [r.get("code", r.get("status")) for r in results] == [
        "room_not_available",
        "speaker_not_available",
        "SCHEDULED",
    ]
    assert moved.json()["code"] == "room_not_available"


def test_agenda_hides_drafts_and_reports_interest_against_capacity(
    client: TestClient, world: World
) -> None:
    org = as_(client, world, "org")
    talk = create(
        org,
        world.event_id,
        1,
        2,
        capacity=1,
        room_id=world.small_room,
        speaker_ids=[world.alan, world.ada],
    )
    draft = create(org, world.event_id, 3, 4)
    org.post(f"/api/v1/sessions/{talk['id']}/schedule")
    interest = f"/api/v1/sessions/{talk['id']}/interest"

    marks = [as_(client, world, name).put(interest) for name in ("ana", "carl")]
    again = client.put(interest)
    waitlisted = as_(client, world, "bob").put(interest)
    on_draft = as_(client, world, "ana").put(f"/api/v1/sessions/{draft['id']}/interest")
    agenda = client.get(f"/api/v1/events/{world.event_id}/sessions").json()
    client.delete(interest)
    after_withdraw = client.get(f"/api/v1/sessions/{talk['id']}").json()
    org_agenda = as_(client, world, "org").get(
        f"/api/v1/events/{world.event_id}/sessions"
    )

    assert [m.status_code for m in [*marks, again]] == [204, 204, 204]
    assert waitlisted.json()["code"] == "registration_not_confirmed"
    assert on_draft.json()["code"] == "session_not_found"
    assert [s["id"] for s in agenda] == [talk["id"]]
    assert {k: agenda[0][k] for k in ("interested", "overdemand", "is_interested")} == {
        "interested": 2,
        "overdemand": True,
        "is_interested": True,
    }
    assert agenda[0]["interest_percent"] == 200.0
    assert [s["full_name"] for s in agenda[0]["speakers"]] == ["Ada", "Alan"]
    assert agenda[0]["room"]["name"] == "Small"
    assert (after_withdraw["interested"], after_withdraw["is_interested"]) == (1, False)
    assert [s["status"] for s in org_agenda.json()] == ["SCHEDULED", "DRAFT"]


def test_unscheduling_keeps_interest_and_cancelling_withdraws_it(
    client: TestClient, world: World
) -> None:
    org = as_(client, world, "org")
    talk = create(org, world.event_id, 1, 2, room_id=world.big_room)
    url = f"/api/v1/sessions/{talk['id']}"
    org.post(f"{url}/schedule")
    as_(client, world, "ana").put(f"{url}/interest")

    org = as_(client, world, "org")
    org.post(f"{url}/unschedule")
    hidden = as_(client, world, "ana").get(url)
    org = as_(client, world, "org")
    rescheduled = org.post(f"{url}/schedule").json()
    cancelled = org.post(f"{url}/cancel").json()
    retried = org.post(f"{url}/cancel")
    edit = org.patch(url, json={"title": "Back"})
    seen = as_(client, world, "ana").get(url).json()

    assert hidden.json()["code"] == "session_not_found"
    assert rescheduled["interested"] == 1
    assert (cancelled["status"], cancelled["interested"]) == ("CANCELLED", 0)
    assert retried.status_code == 200
    assert edit.json()["code"] == "session_cancelled"
    assert seen["status"] == "CANCELLED"


def test_only_the_owner_or_an_admin_changes_sessions(
    client: TestClient, world: World
) -> None:
    talk = create(as_(client, world, "org"), world.event_id, 1, 2)
    url = f"/api/v1/sessions/{talk['id']}"

    by_rival = as_(client, world, "rival").patch(url, json={"title": "Mine"})
    created_by_rival = client.post(
        f"/api/v1/events/{world.event_id}/sessions",
        json={"title": "X", "capacity": 1, "starts_at": at(1), "ends_at": at(2)},
    )
    updated = as_(client, world, "org").patch(
        url, json={"speaker_ids": [world.ada], "room_id": world.big_room}
    )
    replaced = client.patch(url, json={"speaker_ids": [world.alan]})

    assert by_rival.json()["code"] == created_by_rival.json()["code"]
    assert by_rival.json()["code"] == "not_event_owner"
    assert updated.json()["room"]["id"] == world.big_room
    assert [s["full_name"] for s in replaced.json()["speakers"]] == ["Alan"]
