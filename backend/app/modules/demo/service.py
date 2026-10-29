"""Optional demo data to try the API by hand (`just seed`).

Built only through the domain services, so it obeys the same rules as the API,
with every date relative to the moment it runs. Each scenario leaves a rule
ready to try; backend/README.md lists what to try with each one.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlmodel import Session

from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.events import service as events_service
from app.modules.events.models import Event, EventStatus
from app.modules.events.schemas import EventCreate, EventUpdate
from app.modules.registrations import service as registrations_service
from app.modules.sessions import service as sessions_service
from app.modules.sessions.schemas import SessionCreate
from app.modules.speakers import service as speakers_service
from app.modules.speakers.models import Speaker
from app.modules.speakers.schemas import SpeakerCreate
from app.modules.users import repository as users_repository
from app.modules.users import service as users_service
from app.modules.users.models import RoleCode, User
from app.modules.users.schemas import AssignableRole
from app.modules.venues import service as venues_service
from app.modules.venues.models import Room
from app.modules.venues.schemas import RoomCreate, VenueCreate, VenueUpdate
from app.shared.datetimes import utc_now
from app.shared.models import id_of

PASSWORD = "demo1234"
DOMAIN = "demo.example.com"
TIMEZONE = "America/Bogota"

# Login name -> full name; accents on purpose, for search and display.
ACCOUNTS = {
    "admin": "Admin Demo",
    "ana": "Ana Gómez",
    "bruno": "Bruno Díaz",
    "irene": "Irene Castro",
    "carla": "Carla Peña",
    "diego": "Diego Ruiz",
    "elena": "Elena Muñoz",
    "felipe": "Felipe Arango",
    "gabriela": "Gabriela Ortiz",
    "hugo": "Hugo Salas",
}
ORGANIZERS = ("ana", "bruno", "irene")


@dataclass(frozen=True)
class SeededAccount:
    email: str
    roles: list[RoleCode]


@dataclass(frozen=True)
class SeededEvent:
    id: int
    title: str
    status: EventStatus


@dataclass(frozen=True)
class DemoData:
    accounts: list[SeededAccount]
    events: list[SeededEvent]


def email_of(name: str) -> str:
    return f"{name}@{DOMAIN}"


@dataclass
class _Demo:
    session: Session
    now: datetime
    users: dict[str, User]
    rooms: dict[str, Room]
    speakers: dict[str, Speaker]

    def at(self, day: int, hour: int) -> datetime:
        """`hour` o'clock UTC (Bogotá is UTC-5), `day` days from today."""
        midnight = self.now.replace(hour=0, minute=0, second=0, microsecond=0)
        return midnight + timedelta(days=day, hours=hour)


def seed(session: Session) -> DemoData | None:
    """Create the demo data, or return None if it already exists."""
    if users_repository.get_by_email(session, email_of("admin")) is not None:
        return None
    demo = _Demo(session, utc_now(), _create_users(session), {}, {})
    _create_places(demo)
    _create_speakers(demo)
    events = [
        _pydata(demo),
        _architecture_summit(demo),
        _devops_day(demo),
        _fastapi_meetup(demo),
        _hackathon(demo),
        _lightning_talks(demo),
        _former_organizer_workshop(demo),
    ]
    roles = users_repository.get_role_codes_by_user(
        session, [id_of(user) for user in demo.users.values()]
    )
    return DemoData(
        accounts=[
            SeededAccount(user.email, roles[id_of(user)])
            for user in demo.users.values()
        ],
        events=[
            SeededEvent(id_of(event), event.title, event.status) for event in events
        ],
    )


def _create_users(session: Session) -> dict[str, User]:
    users = {
        name: auth_service.register(
            session,
            RegisterRequest(email=email_of(name), password=PASSWORD, full_name=full),
            roles=(RoleCode.ATTENDEE, RoleCode.ADMIN)
            if name == "admin"
            else (RoleCode.ATTENDEE,),
        )
        for name, full in ACCOUNTS.items()
    }
    for name in ORGANIZERS:
        users_service.grant_role(
            session, users["admin"], id_of(users[name]), AssignableRole.ORGANIZER
        )
    return users


def _create_places(demo: _Demo) -> None:
    venue = venues_service.create_venue(
        demo.session,
        VenueCreate(
            name="Ágora Convention Center", address="Cra 7 #12-30", city="Bogotá"
        ),
    )
    for name, capacity in (
        ("Main Auditorium", 200),
        ("Room B", 60),
        ("Workshop Lab", 20),
    ):
        demo.rooms[name] = venues_service.create_room(
            demo.session, id_of(venue), RoomCreate(name=name, capacity=capacity)
        )
    # Closed for renovation: no event or session can use it.
    closed = venues_service.create_venue(
        demo.session, VenueCreate(name="North Campus", city="Medellín")
    )
    venues_service.create_room(
        demo.session, id_of(closed), RoomCreate(name="Hall 1", capacity=80)
    )
    venues_service.update_venue(
        demo.session, id_of(closed), VenueUpdate(is_active=False)
    )


def _create_speakers(demo: _Demo) -> None:
    for key, full_name, bio in (
        ("maria", "María José Núñez", "Data engineer and PyData organizer."),
        ("andres", "Andrés Peña", "Teaches pandas and SQL to analysts."),
        ("lucia", "Lucía Fernández", "Software architect, writes about modularity."),
        ("tomas", "Tomás O'Connor", "Distributed systems and messaging."),
        # Never assigned to a session: the only one that can be deleted.
        ("sofia", "Sofía Ramírez", "Joins the agenda once her talk is confirmed."),
    ):
        demo.speakers[key] = speakers_service.create_speaker(
            demo.session, SpeakerCreate(full_name=full_name, bio=bio)
        )


def _pydata(demo: _Demo) -> Event:
    """Full event: waitlist, promotion, re-registration and overdemand."""
    event = _event(
        demo,
        "ana",
        "PyData Bogotá",
        "Data science day. Only 3 seats on purpose: it is full and has a waitlist.",
        capacity=3,
        starts_at=demo.at(30, 14),
        ends_at=demo.at(30, 23),
    )
    keynote = _talk(
        demo,
        event,
        "Keynote: the state of Python data",
        capacity=150,
        starts_at=demo.at(30, 14),
        ends_at=demo.at(30, 15),
        room="Main Auditorium",
        speakers=("maria", "andres"),
    )
    # Starts when the keynote ends: back-to-back is not an overlap for Andrés.
    workshop = _talk(
        demo,
        event,
        "Hands-on pandas workshop",
        capacity=2,
        starts_at=demo.at(30, 15),
        ends_at=demo.at(30, 17),
        room="Workshop Lab",
        speakers=("andres",),
    )
    # Same time as the workshop, in another room with another speaker.
    dataviz = _talk(
        demo,
        event,
        "Dataviz with Altair",
        capacity=60,
        starts_at=demo.at(30, 15),
        ends_at=demo.at(30, 16),
        room="Room B",
        speakers=("lucia",),
    )
    _talk(
        demo,
        event,
        "Open Q&A (not scheduled yet)",
        capacity=40,
        starts_at=demo.at(30, 17),
        ends_at=demo.at(30, 18),
        schedule=False,
    )
    panel = _talk(
        demo,
        event,
        "MLOps panel",
        capacity=60,
        starts_at=demo.at(30, 18),
        ends_at=demo.at(30, 19),
        room="Room B",
        speakers=("maria", "lucia"),
    )

    _register(demo, event, "carla", "diego", "elena", "felipe", "gabriela")
    _interest(demo, workshop, "carla", "elena", "diego")
    _interest(demo, dataviz, "carla")  # overlaps the workshop: still allowed
    _interest(demo, keynote, "diego")
    _interest(demo, panel, "carla")
    sessions_service.cancel_session(demo.session, demo.users["ana"], panel)
    # Diego frees his seat and loses his interests: Felipe is promoted.
    registrations_service.cancel(demo.session, demo.users["diego"], id_of(event))
    _interest(demo, workshop, "felipe")  # 3 interested, 2 seats: overdemand
    # Same registration reactivated, at the back of the queue behind Gabriela.
    _register(demo, event, "diego")
    return event


def _architecture_summit(demo: _Demo) -> Event:
    """Free seats; its owner and another organizer attend it too."""
    event = _event(
        demo,
        "ana",
        "Software Architecture Summit",
        "Two days about modular design. Plenty of seats left.",
        capacity=50,
        starts_at=demo.at(45, 14),
        ends_at=demo.at(46, 23),
    )
    _talk(
        demo,
        event,
        "Event-driven architecture in practice",
        capacity=180,
        starts_at=demo.at(45, 15),
        ends_at=demo.at(45, 16),
        room="Main Auditorium",
        speakers=("tomas",),
    )
    _talk(
        demo,
        event,
        "Modular monoliths",
        capacity=60,
        starts_at=demo.at(45, 15),
        ends_at=demo.at(45, 16),
        room="Room B",
        speakers=("lucia",),
    )
    _register(demo, event, "ana", "bruno", "carla", "hugo")
    registrations_service.cancel(demo.session, demo.users["hugo"], id_of(event))
    return event


def _devops_day(demo: _Demo) -> Event:
    """Same day and venue as the summit; registration already closed."""
    event = _event(
        demo,
        "bruno",
        "DevOps Day",
        "Shares the venue and the day with the summit. Registration closed early.",
        capacity=100,
        starts_at=demo.at(45, 14),
        ends_at=demo.at(45, 23),
    )
    _talk(
        demo,
        event,
        "CI/CD pipelines that scale",
        capacity=20,
        starts_at=demo.at(45, 16),
        ends_at=demo.at(45, 17),
        room="Workshop Lab",
        speakers=("andres",),
    )
    _register(demo, event, "elena")
    events_service.update_event(
        demo.session,
        demo.users["bruno"],
        id_of(event),
        EventUpdate(registration_closes_at=utc_now()),
    )
    return event


def _fastapi_meetup(demo: _Demo) -> Event:
    """Draft without a venue, in another time zone."""
    event = _event(
        demo,
        "ana",
        "FastAPI Meetup",
        "Still being planned: without a venue it cannot be published.",
        capacity=80,
        starts_at=demo.at(60, 14),
        ends_at=demo.at(60, 20),
        timezone="America/Mexico_City",
        venue=False,
        publish=False,
    )
    _talk(
        demo,
        event,
        "Dependency injection deep dive",
        capacity=80,
        starts_at=demo.at(60, 15),
        ends_at=demo.at(60, 16),
        schedule=False,
    )
    return event


def _hackathon(demo: _Demo) -> Event:
    """Cancelled with confirmed, waitlisted and interested attendees."""
    event = _event(
        demo,
        "bruno",
        "Hackathon 2026",
        "Cancelled by its organizer: its registrations and sessions too.",
        capacity=2,
        starts_at=demo.at(50, 14),
        ends_at=demo.at(51, 23),
    )
    kickoff = _talk(
        demo,
        event,
        "Kickoff",
        capacity=100,
        starts_at=demo.at(50, 14),
        ends_at=demo.at(50, 15),
        room="Main Auditorium",
        speakers=("tomas",),
    )
    _register(demo, event, "carla", "diego", "elena")
    _interest(demo, kickoff, "carla")
    return events_service.cancel_event(demo.session, demo.users["bruno"], id_of(event))


def _lightning_talks(demo: _Demo) -> Event:
    """Starts 2 minutes after seeding and ends 3 minutes later."""
    starts_at = demo.now + timedelta(minutes=2)
    ends_at = starts_at + timedelta(minutes=3)
    event = _event(
        demo,
        "ana",
        "Lightning Talks",
        "Starts 2 minutes after the demo data is created and lasts 3 minutes.",
        capacity=30,
        starts_at=starts_at,
        ends_at=ends_at,
    )
    talks = _talk(
        demo,
        event,
        "Five-minute talks",
        capacity=30,
        starts_at=starts_at,
        ends_at=ends_at,
        room="Room B",
        speakers=("lucia",),
    )
    _register(demo, event, "carla", "elena")
    _interest(demo, talks, "carla")
    return event


def _former_organizer_workshop(demo: _Demo) -> Event:
    """Draft whose owner lost the ORGANIZER role: only an admin can change it."""
    event = _event(
        demo,
        "irene",
        "Data Visualization Workshop",
        "Its owner is no longer an organizer: she still sees it, an admin edits it.",
        capacity=25,
        starts_at=demo.at(70, 14),
        ends_at=demo.at(70, 18),
        publish=False,
    )
    users_service.revoke_role(
        demo.session, id_of(demo.users["irene"]), AssignableRole.ORGANIZER
    )
    return event


def _event(
    demo: _Demo,
    owner: str,
    title: str,
    description: str,
    *,
    capacity: int,
    starts_at: datetime,
    ends_at: datetime,
    timezone: str = TIMEZONE,
    venue: bool = True,
    publish: bool = True,
) -> Event:
    event = events_service.create_event(
        demo.session,
        demo.users[owner],
        EventCreate(
            title=title,
            description=description,
            capacity=capacity,
            starts_at=starts_at,
            ends_at=ends_at,
            timezone=timezone,
            venue_id=demo.rooms["Main Auditorium"].venue_id if venue else None,
        ),
    )
    if publish:
        events_service.publish_event(demo.session, demo.users[owner], id_of(event))
    return event


def _talk(
    demo: _Demo,
    event: Event,
    title: str,
    *,
    capacity: int,
    starts_at: datetime,
    ends_at: datetime,
    room: str | None = None,
    speakers: Sequence[str] = (),
    schedule: bool = True,
) -> int:
    """Create a session as the event's owner and, by default, schedule it."""
    owner = next(user for user in demo.users.values() if user.id == event.owner_id)
    created = sessions_service.create_session(
        demo.session,
        owner,
        id_of(event),
        SessionCreate(
            title=title,
            capacity=capacity,
            starts_at=starts_at,
            ends_at=ends_at,
            room_id=id_of(demo.rooms[room]) if room else None,
            speaker_ids=[id_of(demo.speakers[key]) for key in speakers],
        ),
    )
    if schedule:
        sessions_service.schedule_session(demo.session, owner, created.id)
    return created.id


def _register(demo: _Demo, event: Event, *names: str) -> None:
    for name in names:
        registrations_service.register(demo.session, demo.users[name], id_of(event))


def _interest(demo: _Demo, session_id: int, *names: str) -> None:
    for name in names:
        sessions_service.mark_interest(demo.session, demo.users[name], session_id)
