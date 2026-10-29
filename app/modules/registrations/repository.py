from sqlalchemy import ColumnElement, case, insert, literal, update
from sqlalchemy import select as sa_select
from sqlalchemy.orm import aliased
from sqlmodel import Session, col, func, select

from app.modules.registrations.models import (
    EventRegistration,
    RegistrationReason,
    RegistrationStatus,
    RegistrationStatusHistory,
)
from app.modules.users.models import User
from app.shared.models import id_of

_ACTIVE = (RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED)

type WithPosition = tuple[EventRegistration, int | None]


def get_for_user(
    session: Session, event_id: int, user_id: int
) -> EventRegistration | None:
    statement = select(EventRegistration).where(
        EventRegistration.event_id == event_id, EventRegistration.user_id == user_id
    )
    return session.exec(statement).first()


def count_by_status(session: Session, event_id: int) -> dict[RegistrationStatus, int]:
    statement = (
        select(EventRegistration.status, func.count())
        .where(EventRegistration.event_id == event_id)
        .group_by(col(EventRegistration.status))
    )
    counts = dict.fromkeys(RegistrationStatus, 0)
    for status, count in session.exec(statement).all():
        counts[RegistrationStatus(status)] = count
    return counts


def count_confirmed(session: Session, event_id: int) -> int:
    statement = select(func.count()).where(
        EventRegistration.event_id == event_id,
        EventRegistration.status == RegistrationStatus.CONFIRMED,
    )
    return session.exec(statement).one()


def add_history(
    session: Session,
    registration: EventRegistration,
    *,
    from_status: RegistrationStatus | None,
    reason: RegistrationReason,
    waitlist_order: int | None,
    changed_by: int | None,
) -> None:
    session.add(
        RegistrationStatusHistory(
            registration_id=id_of(registration),
            from_status=from_status,
            to_status=registration.status,
            reason=reason,
            waitlist_order=waitlist_order,
            changed_by=changed_by,
        )
    )


def promote_waitlisted(session: Session, event_id: int, *, limit: int) -> int:
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
                    "reason": RegistrationReason.PROMOTED,
                    "waitlist_order": waitlist_order,
                    "changed_by": None,
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
    session: Session, event_id: int, *, changed_by: int, reason: RegistrationReason
) -> None:
    active = (
        col(EventRegistration.event_id) == event_id,
        col(EventRegistration.status).in_(_ACTIVE),
    )
    snapshot = sa_select(
        col(EventRegistration.id),
        col(EventRegistration.status),
        literal(RegistrationStatus.CANCELLED.value),
        literal(reason.value),
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


def _waitlist_position() -> ColumnElement[int | None]:
    ahead = aliased(EventRegistration)
    count_ahead = (
        sa_select(func.count())
        .where(
            col(ahead.event_id) == col(EventRegistration.event_id),
            col(ahead.status) == RegistrationStatus.WAITLISTED,
            col(ahead.waitlist_order) < col(EventRegistration.waitlist_order),
        )
        .correlate(EventRegistration)
        .scalar_subquery()
    )
    return case(
        (
            col(EventRegistration.status) == RegistrationStatus.WAITLISTED,
            count_ahead + 1,
        ),
        else_=None,
    )


def get_with_position(
    session: Session, event_id: int, user_id: int
) -> WithPosition | None:
    statement = select(EventRegistration, _waitlist_position()).where(
        EventRegistration.event_id == event_id, EventRegistration.user_id == user_id
    )
    row = session.exec(statement).first()
    return (row[0], row[1]) if row else None


def list_for_user(
    session: Session,
    user_id: int,
    *,
    status: RegistrationStatus | None,
    limit: int,
    offset: int,
) -> tuple[list[WithPosition], int]:
    filters = [EventRegistration.user_id == user_id]
    if status is not None:
        filters.append(EventRegistration.status == status)
    total = session.exec(select(func.count()).where(*filters)).one()
    page = (
        select(EventRegistration, _waitlist_position())
        .where(*filters)
        .order_by(col(EventRegistration.requested_at).desc(), col(EventRegistration.id))
        .limit(limit)
        .offset(offset)
    )
    return [(row[0], row[1]) for row in session.exec(page).all()], total


def list_for_event(
    session: Session,
    event_id: int,
    *,
    status: RegistrationStatus | None,
    limit: int,
    offset: int,
) -> tuple[list[tuple[EventRegistration, int | None, User]], int]:
    filters = [EventRegistration.event_id == event_id]
    if status is not None:
        filters.append(EventRegistration.status == status)
    total = session.exec(select(func.count()).where(*filters)).one()
    page = (
        select(EventRegistration, _waitlist_position(), User)
        .join(User, col(User.id) == col(EventRegistration.user_id))
        .where(*filters)
        .order_by(
            col(EventRegistration.waitlist_order).asc().nulls_first(),
            col(EventRegistration.requested_at),
            col(EventRegistration.id),
        )
        .limit(limit)
        .offset(offset)
    )
    return [(row[0], row[1], row[2]) for row in session.exec(page).all()], total
