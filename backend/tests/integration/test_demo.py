import pytest
from sqlmodel import Session

from app.modules.demo import service as demo_service
from app.modules.events import service as events_service
from app.modules.events.exceptions import EventNotFoundError, NotEventOwnerError
from app.modules.events.models import EventStatus
from app.modules.events.schemas import EventUpdate
from app.modules.registrations import service as registrations_service
from app.modules.registrations.exceptions import RegistrationClosedError
from app.modules.registrations.models import RegistrationStatus
from app.modules.sessions import service as sessions_service
from app.modules.sessions.models import SessionStatus
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User
from app.shared.pagination import PageParams


@pytest.fixture
def demo(session: Session) -> demo_service.DemoData:
    data = demo_service.seed(session)
    assert data is not None
    return data


def user(session: Session, name: str) -> User:
    found = users_repository.get_by_email(session, demo_service.email_of(name))
    assert found is not None
    return found


def event_ids(data: demo_service.DemoData) -> dict[str, int]:
    return {event.title: event.id for event in data.events}


def test_builds_every_documented_state(
    session: Session, demo: demo_service.DemoData
) -> None:
    assert {event.title: event.status for event in demo.events} == {
        "PyData Bogotá": EventStatus.PUBLISHED,
        "Software Architecture Summit": EventStatus.PUBLISHED,
        "DevOps Day": EventStatus.PUBLISHED,
        "FastAPI Meetup": EventStatus.DRAFT,
        "Hackathon 2026": EventStatus.CANCELLED,
        "Lightning Talks": EventStatus.PUBLISHED,
        "Data Visualization Workshop": EventStatus.DRAFT,
    }
    roles = {account.email: set(account.roles) for account in demo.accounts}
    assert roles[demo_service.email_of("admin")] == {RoleCode.ATTENDEE, RoleCode.ADMIN}
    assert roles[demo_service.email_of("ana")] == {
        RoleCode.ATTENDEE,
        RoleCode.ORGANIZER,
    }
    assert roles[demo_service.email_of("irene")] == {RoleCode.ATTENDEE}

    ana, ids = user(session, "ana"), event_ids(demo)
    pydata = ids["PyData Bogotá"]
    occupancy = registrations_service.get_occupancy(session, ana, pydata)
    assert (occupancy.confirmed, occupancy.waitlisted) == (3, 2)
    queue, _ = registrations_service.list_for_event(
        session, ana, pydata, status=RegistrationStatus.WAITLISTED, page=PageParams()
    )
    # Diego cancelled and registered again: behind whoever was already waiting.
    assert [(row.user.email, row.waitlist_position) for row in queue] == [
        (demo_service.email_of("gabriela"), 1),
        (demo_service.email_of("diego"), 2),
    ]
    talks = {
        talk.title: talk
        for talk in sessions_service.list_sessions(session, ana, pydata)
    }
    workshop = talks["Hands-on pandas workshop"]
    assert (workshop.interested, workshop.overdemand) == (3, True)
    # Cancelling withdrew the interests: Diego's registration, Carla's panel.
    assert talks["Keynote: the state of Python data"].interested == 0
    panel = talks["MLOps panel"]
    assert (panel.status, panel.interested) == (SessionStatus.CANCELLED, 0)

    hackathon, _ = registrations_service.list_for_event(
        session,
        user(session, "bruno"),
        ids["Hackathon 2026"],
        status=None,
        page=PageParams(),
    )
    assert [row.status for row in hackathon] == [RegistrationStatus.CANCELLED] * 3


def test_leaves_the_rule_checks_ready(
    session: Session, demo: demo_service.DemoData
) -> None:
    ids = event_ids(demo)

    with pytest.raises(EventNotFoundError):
        events_service.get_event(session, user(session, "bruno"), ids["FastAPI Meetup"])
    with pytest.raises(NotEventOwnerError):
        events_service.update_event(
            session,
            user(session, "irene"),
            ids["Data Visualization Workshop"],
            EventUpdate(capacity=30),
        )
    with pytest.raises(RegistrationClosedError):
        registrations_service.register(
            session, user(session, "hugo"), ids["DevOps Day"]
        )
    agenda = sessions_service.list_sessions(
        session, user(session, "carla"), ids["PyData Bogotá"]
    )
    assert "Open Q&A (not scheduled yet)" not in {talk.title for talk in agenda}


def test_does_nothing_when_the_demo_data_exists(
    session: Session, demo: demo_service.DemoData
) -> None:
    assert demo_service.seed(session) is None
