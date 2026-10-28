from collections.abc import Sequence

from sqlmodel import Session, col, func, or_, select

from app.modules.events.models import Event, EventStatus


def get_event(
    session: Session, event_id: int, *, for_update: bool = False
) -> Event | None:
    return session.get(Event, event_id, with_for_update=for_update)


def list_events(
    session: Session,
    *,
    viewer_id: int | None,
    title: str | None,
    status: EventStatus | None,
    owner_id: int | None,
    limit: int,
    offset: int,
) -> tuple[Sequence[Event], int]:
    statement = select(Event)
    if viewer_id is not None:
        statement = statement.where(
            or_(col(Event.status) != EventStatus.DRAFT, Event.owner_id == viewer_id)
        )
    if title:
        statement = statement.where(col(Event.title).icontains(title, autoescape=True))
    if status is not None:
        statement = statement.where(Event.status == status)
    if owner_id is not None:
        statement = statement.where(Event.owner_id == owner_id)
    total = session.exec(select(func.count()).select_from(statement.subquery())).one()
    page = (
        statement.order_by(col(Event.starts_at), col(Event.id))
        .limit(limit)
        .offset(offset)
    )
    return session.exec(page).all(), total
