from collections.abc import Collection, Sequence

from sqlmodel import Session, col, func, select

from app.modules.speakers.models import Speaker


def get_speaker(session: Session, speaker_id: int) -> Speaker | None:
    return session.get(Speaker, speaker_id)


def lock_speakers(session: Session, speaker_ids: Collection[int]) -> set[int]:
    """Lock the speakers by ascending id and return the ids that exist."""
    if not speaker_ids:
        return set()
    statement = (
        select(Speaker.id)
        .where(col(Speaker.id).in_(speaker_ids))
        .order_by(col(Speaker.id))
        .with_for_update()
    )
    return {
        speaker_id
        for speaker_id in session.exec(statement).all()
        if speaker_id is not None
    }


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
