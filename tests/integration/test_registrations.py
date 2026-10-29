from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.security import create_access_token
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.events.models import Event, EventStatus
from app.modules.registrations.models import RegistrationStatusHistory
from app.modules.sessions.models import EventSession, SessionInterest, SessionStatus
from app.modules.users.models import RoleCode
from app.shared.datetimes import utc_now
from app.shared.models import id_of


@pytest.fixture
def tokens(session: Session) -> dict[str, str]:
    """Bearer headers for an organizer (who owns the event) and three attendees."""
    roles = {"org": (RoleCode.ORGANIZER,), "rival": (RoleCode.ORGANIZER,)}
    headers = {}
    for name in ("org", "rival", "ana", "bob", "carl"):
        user = auth_service.register(
            session,
            RegisterRequest(
                email=f"{name}@example.com", password="pw-123456", full_name=name
            ),
            roles=(RoleCode.ATTENDEE, *roles.get(name, ())),
        )
        headers[name] = f"Bearer {create_access_token(id_of(user))}"
        headers[f"{name}_id"] = str(id_of(user))
    return headers


def published_event(session: Session, owner_id: int, capacity: int) -> int:
    now = utc_now()
    event = Event(
        owner_id=owner_id,
        title="PyCon",
        capacity=capacity,
        status=EventStatus.PUBLISHED,
        starts_at=now + timedelta(days=1),
        ends_at=now + timedelta(days=2),
        timezone="America/Bogota",
    )
    session.add(event)
    session.flush()
    return id_of(event)


def as_(client: TestClient, tokens: dict[str, str], name: str) -> TestClient:
    client.headers["Authorization"] = tokens[name]
    return client


def test_waitlist_is_fifo_and_a_cancellation_promotes_the_first(
    client: TestClient, session: Session, tokens: dict[str, str]
) -> None:
    event_id = published_event(session, int(tokens["org_id"]), capacity=1)
    url = f"/api/v1/events/{event_id}/registrations"

    first = as_(client, tokens, "ana").post(url)
    retry = client.post(url)
    bob = as_(client, tokens, "bob").post(url).json()
    carl = as_(client, tokens, "carl").post(url).json()
    as_(client, tokens, "ana").post(f"{url}/me/cancel")
    back = client.post(url).json()

    assert (first.status_code, first.json()["status"]) == (201, "CONFIRMED")
    assert (retry.status_code, retry.json()["id"]) == (200, first.json()["id"])
    assert [(r["status"], r["waitlist_position"]) for r in (bob, carl)] == [
        ("WAITLISTED", 1),
        ("WAITLISTED", 2),
    ]
    assert (back["status"], back["waitlist_position"], back["id"]) == (
        "WAITLISTED",
        2,
        first.json()["id"],
    )
    bob_now = as_(client, tokens, "bob").get(f"{url}/me").json()
    carl_now = as_(client, tokens, "carl").get(f"{url}/me").json()
    assert bob_now["status"] == "CONFIRMED"
    assert (carl_now["status"], carl_now["waitlist_position"]) == ("WAITLISTED", 1)
    ana_id, bob_id, carl_id = (int(tokens[f"{n}_id"]) for n in ("ana", "bob", "carl"))
    history = [
        (
            h.registration_id,
            h.from_status,
            h.to_status,
            h.reason,
            h.waitlist_order,
            h.changed_by,
        )
        for h in session.exec(
            select(RegistrationStatusHistory).order_by(
                col(RegistrationStatusHistory.id)
            )
        ).all()
    ]
    assert history == [
        (back["id"], None, "CONFIRMED", "REGISTERED", None, ana_id),
        (bob["id"], None, "WAITLISTED", "EVENT_FULL", 1, bob_id),
        (carl["id"], None, "WAITLISTED", "EVENT_FULL", 2, carl_id),
        (back["id"], "CONFIRMED", "CANCELLED", "USER_CANCELLED", None, ana_id),
        (bob["id"], "WAITLISTED", "CONFIRMED", "PROMOTED", 1, None),
        (back["id"], "CANCELLED", "WAITLISTED", "EVENT_FULL", 3, ana_id),
    ]
    occupancy = client.get(f"/api/v1/events/{event_id}/occupancy").json()
    assert (occupancy["confirmed"], occupancy["waitlisted"]) == (1, 2)


def test_only_the_owner_or_an_admin_lists_the_registrations(
    client: TestClient, session: Session, tokens: dict[str, str]
) -> None:
    event_id = published_event(session, int(tokens["org_id"]), capacity=1)
    url = f"/api/v1/events/{event_id}/registrations"
    for name in ("bob", "ana"):
        as_(client, tokens, name).post(url)

    listing = as_(client, tokens, "org").get(url).json()
    rival = as_(client, tokens, "rival").get(url)
    attendee = as_(client, tokens, "ana").get(url)
    mine = client.get("/api/v1/users/me/registrations?status=WAITLISTED").json()

    assert [(r["user"]["email"], r["status"]) for r in listing["items"]] == [
        ("bob@example.com", "CONFIRMED"),
        ("ana@example.com", "WAITLISTED"),
    ]
    assert rival.json()["code"] == attendee.json()["code"] == "not_event_owner"
    assert [r["event_id"] for r in mine["items"]] == [event_id]


def test_cancelling_withdraws_the_users_interests(
    client: TestClient, session: Session, tokens: dict[str, str]
) -> None:
    event_id = published_event(session, int(tokens["org_id"]), capacity=5)
    url = f"/api/v1/events/{event_id}/registrations"
    as_(client, tokens, "ana").post(url)
    talk = EventSession(
        event_id=event_id,
        title="Talk",
        capacity=10,
        status=SessionStatus.DRAFT,
        starts_at=utc_now() + timedelta(days=1, hours=1),
        ends_at=utc_now() + timedelta(days=1, hours=2),
    )
    session.add(talk)
    session.flush()
    interest = SessionInterest(user_id=int(tokens["ana_id"]), session_id=id_of(talk))
    session.add(interest)
    session.flush()

    cancelled = client.post(f"{url}/me/cancel")
    session.refresh(interest)

    assert cancelled.json()["status"] == "CANCELLED"
    assert interest.withdrawn_at is not None
