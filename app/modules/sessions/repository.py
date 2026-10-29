from datetime import datetime

from sqlalchemy import update
from sqlmodel import Session, col, func, or_, select

from app.modules.sessions.models import EventSession, SessionInterest, SessionStatus


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
