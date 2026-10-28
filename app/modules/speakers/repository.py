from collections.abc import Sequence

from sqlmodel import Session, col, func, select

from app.modules.speakers.models import Speaker


def get_speaker(session: Session, speaker_id: int) -> Speaker | None:
    return session.get(Speaker, speaker_id)


def list_speakers(
    session: Session, *, name: str | None, limit: int, offset: int
) -> tuple[Sequence[Speaker], int]:
    statement = select(Speaker)
    if name:
        statement = statement.where(
            col(Speaker.full_name).icontains(name, autoescape=True)
        )
    total = session.exec(select(func.count()).select_from(statement.subquery())).one()
    page = (
        statement.order_by(col(Speaker.full_name), col(Speaker.id))
        .limit(limit)
        .offset(offset)
    )
    return session.exec(page).all(), total
