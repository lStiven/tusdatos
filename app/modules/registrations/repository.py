from sqlalchemy import insert, literal, update
from sqlalchemy import select as sa_select
from sqlmodel import Session, col, func, select

from app.modules.registrations.models import (
    EventRegistration,
    RegistrationStatus,
    RegistrationStatusHistory,
)

_ACTIVE = (RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED)


def count_confirmed(session: Session, event_id: int) -> int:
    statement = select(func.count()).where(
        EventRegistration.event_id == event_id,
        EventRegistration.status == RegistrationStatus.CONFIRMED,
    )
    return session.exec(statement).one()


def promote_waitlisted(
    session: Session, event_id: int, *, limit: int, changed_by: int, reason: str
) -> int:
    """Confirm up to `limit` waitlisted registrations in FIFO order.

    The caller must hold the event lock: it is what keeps the queue stable.
    """
    statement = (
        select(EventRegistration.id, EventRegistration.waitlist_order)
        .where(
            EventRegistration.event_id == event_id,
            EventRegistration.status == RegistrationStatus.WAITLISTED,
        )
        .order_by(col(EventRegistration.waitlist_order))
        .limit(limit)
    )
    promoted = session.exec(statement).all()
    if not promoted:
        return 0
    session.exec(
        insert(RegistrationStatusHistory).values(
            [
                {
                    "registration_id": registration_id,
                    "from_status": RegistrationStatus.WAITLISTED,
                    "to_status": RegistrationStatus.CONFIRMED,
                    "reason": reason,
                    "waitlist_order": waitlist_order,
                    "changed_by": changed_by,
                }
                for registration_id, waitlist_order in promoted
            ]
        )
    )
    session.exec(
        update(EventRegistration)
        .where(col(EventRegistration.id).in_([row[0] for row in promoted]))
        .values(
            status=RegistrationStatus.CONFIRMED,
            confirmed_at=func.now(),
            waitlist_order=None,
        )
    )
    return len(promoted)


def cancel_active(
    session: Session, event_id: int, *, changed_by: int, reason: str
) -> None:

    active = (
        col(EventRegistration.event_id) == event_id,
        col(EventRegistration.status).in_(_ACTIVE),
    )
    snapshot = sa_select(
        col(EventRegistration.id),
        col(EventRegistration.status),
        literal(RegistrationStatus.CANCELLED.value),
        literal(reason),
        col(EventRegistration.waitlist_order),
        literal(changed_by),
    ).where(*active)
    session.exec(
        insert(RegistrationStatusHistory).from_select(
            [
                "registration_id",
                "from_status",
                "to_status",
                "reason",
                "waitlist_order",
                "changed_by",
            ],
            snapshot,
        )
    )
    session.exec(
        update(EventRegistration)
        .where(*active)
        .values(
            status=RegistrationStatus.CANCELLED,
            cancelled_at=func.now(),
            waitlist_order=None,
        )
    )
