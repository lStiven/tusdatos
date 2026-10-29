from collections import defaultdict
from collections.abc import Collection, Sequence
from datetime import datetime

from sqlalchemy import ColumnElement, delete, exists, update
from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, col, func, or_, select

from app.modules.sessions.models import (
    EventSession,
    SessionInterest,
    SessionSpeaker,
    SessionStatus,
)
from app.modules.speakers.models import Speaker
from app.modules.venues.models import Room

type SessionView = tuple[EventSession, Room | None, int, bool]


def get_event_id(session: Session, session_id: int) -> int | None:
    statement = select(EventSession.event_id).where(EventSession.id == session_id)
    return session.exec(statement).first()


def get_session(
    session: Session,
    session_id: int,
    *,
    for_update: bool = False,
    for_share: bool = False,
) -> EventSession | None:
    statement = select(EventSession).where(EventSession.id == session_id)
    if for_update or for_share:
        statement = statement.with_for_update(read=for_share)
    return session.exec(statement).first()


def list_views(
    session: Session, viewer_id: int, *filters: ColumnElement[bool]
) -> list[SessionView]:
    """Sessions with their room, active interest count and the viewer's interest."""
    active = col(SessionInterest.withdrawn_at).is_(None)
    same_session = col(SessionInterest.session_id) == col(EventSession.id)
    interested = (
        select(func.count())
        .where(same_session, active)
        .correlate(EventSession)
        .scalar_subquery()
    )
    mine = (
        exists()
        .where(same_session, active, col(SessionInterest.user_id) == viewer_id)
        .correlate(EventSession)
    )
    statement = (
        select(EventSession, Room, interested, mine)
        .outerjoin(Room, col(Room.id) == col(EventSession.room_id))
        .where(*filters)
        .order_by(col(EventSession.starts_at), col(EventSession.id))
    )
    return [(row[0], row[1], row[2], row[3]) for row in session.exec(statement).all()]


def speakers_by_session(
    session: Session, session_ids: Collection[int]
) -> dict[int, list[Speaker]]:
    statement = (
        select(SessionSpeaker.session_id, Speaker)
        .join(Speaker, col(Speaker.id) == col(SessionSpeaker.speaker_id))
        .where(col(SessionSpeaker.session_id).in_(session_ids))
        .order_by(col(Speaker.full_name), col(Speaker.id))
    )
    grouped: dict[int, list[Speaker]] = defaultdict(list)
    for session_id, speaker in session.exec(statement).all():
        grouped[session_id].append(speaker)
    return grouped


def get_speaker_ids(session: Session, session_id: int) -> set[int]:
    statement = select(SessionSpeaker.speaker_id).where(
        SessionSpeaker.session_id == session_id
    )
    return set(session.exec(statement).all())


def set_speakers(
    session: Session, session_id: int, speaker_ids: Collection[int]
) -> None:
    session.exec(
        delete(SessionSpeaker).where(
            col(SessionSpeaker.session_id) == session_id,
            col(SessionSpeaker.speaker_id).not_in(speaker_ids),
        )
    )
    if speaker_ids:
        session.exec(
            insert(SessionSpeaker)
            .values([{"session_id": session_id, "speaker_id": s} for s in speaker_ids])
            .on_conflict_do_nothing()
        )


def busy_speakers(
    session: Session,
    speaker_ids: Collection[int],
    starts_at: datetime,
    ends_at: datetime,
    *,
    exclude_session_id: int,
) -> Sequence[int]:
    """Speakers in another scheduled session overlapping `[starts_at, ends_at)`."""
    statement = (
        select(SessionSpeaker.speaker_id)
        .join(EventSession, col(EventSession.id) == col(SessionSpeaker.session_id))
        .where(
            col(SessionSpeaker.speaker_id).in_(speaker_ids),
            col(EventSession.id) != exclude_session_id,
            col(EventSession.status) == SessionStatus.SCHEDULED,
            col(EventSession.starts_at) < ends_at,
            col(EventSession.ends_at) > starts_at,
        )
        .distinct()
        .order_by(col(SessionSpeaker.speaker_id))
    )
    return session.exec(statement).all()


def add_interest(session: Session, user_id: int, session_id: int) -> None:
    """Mark the interest, or reactivate a withdrawn one; an active one is kept."""
    session.exec(
        insert(SessionInterest)
        .values(user_id=user_id, session_id=session_id)
        .on_conflict_do_update(
            index_elements=["user_id", "session_id"],
            set_={
                "withdrawn_at": None,
                "expressed_at": func.now(),
                "updated_at": func.now(),
            },
            where=col(SessionInterest.withdrawn_at).is_not(None),
        )
    )


def withdraw_interest(session: Session, user_id: int, session_id: int) -> None:
    session.exec(
        update(SessionInterest)
        .where(
            col(SessionInterest.user_id) == user_id,
            col(SessionInterest.session_id) == session_id,
            col(SessionInterest.withdrawn_at).is_(None),
        )
        .values(withdrawn_at=func.now())
    )


def withdraw_session_interests(session: Session, session_id: int) -> None:
    session.exec(
        update(SessionInterest)
        .where(
            col(SessionInterest.session_id) == session_id,
            col(SessionInterest.withdrawn_at).is_(None),
        )
        .values(withdrawn_at=func.now())
    )


def has_scheduled(session: Session, event_id: int) -> bool:
    statement = (
        select(EventSession.id)
        .where(
            EventSession.event_id == event_id,
            EventSession.status == SessionStatus.SCHEDULED,
        )
        .limit(1)
    )
    return session.exec(statement).first() is not None


def has_sessions_outside(
    session: Session, event_id: int, starts_at: datetime, ends_at: datetime
) -> bool:
    statement = (
        select(EventSession.id)
        .where(
            EventSession.event_id == event_id,
            EventSession.status != SessionStatus.CANCELLED,
            or_(
                col(EventSession.starts_at) < starts_at,
                col(EventSession.ends_at) > ends_at,
            ),
        )
        .limit(1)
    )
    return session.exec(statement).first() is not None


def cancel_for_event(session: Session, event_id: int) -> None:
    event_sessions = select(EventSession.id).where(EventSession.event_id == event_id)
    session.exec(
        update(SessionInterest)
        .where(
            col(SessionInterest.session_id).in_(event_sessions),
            col(SessionInterest.withdrawn_at).is_(None),
        )
        .values(withdrawn_at=func.now())
    )
    session.exec(
        update(EventSession)
        .where(
            col(EventSession.event_id) == event_id,
            col(EventSession.status) != SessionStatus.CANCELLED,
        )
        .values(status=SessionStatus.CANCELLED)
    )


def withdraw_interests(session: Session, event_id: int, user_id: int) -> None:
    event_sessions = select(EventSession.id).where(EventSession.event_id == event_id)
    session.exec(
        update(SessionInterest)
        .where(
            col(SessionInterest.user_id) == user_id,
            col(SessionInterest.session_id).in_(event_sessions),
            col(SessionInterest.withdrawn_at).is_(None),
        )
        .values(withdrawn_at=func.now())
    )
