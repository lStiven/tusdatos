from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.modules.speakers import repository as speakers_repository
from app.modules.speakers.exceptions import (
    SpeakerHasSessionsError,
    SpeakerNotFoundError,
)
from app.modules.speakers.models import Speaker
from app.modules.speakers.schemas import SpeakerCreate, SpeakerUpdate
from app.shared.exceptions import violated_constraint
from app.shared.pagination import PageParams


def create_speaker(session: Session, data: SpeakerCreate) -> Speaker:
    speaker = Speaker(**data.model_dump())
    session.add(speaker)
    session.commit()
    session.refresh(speaker)
    return speaker


def list_speakers(
    session: Session, *, name: str | None, page: PageParams
) -> tuple[Sequence[Speaker], int]:
    return speakers_repository.list_speakers(
        session, name=name, limit=page.limit, offset=page.offset
    )


def get_speaker(session: Session, speaker_id: int) -> Speaker:
    speaker = speakers_repository.get_speaker(session, speaker_id)
    if speaker is None:
        raise SpeakerNotFoundError()
    return speaker


def update_speaker(session: Session, speaker_id: int, data: SpeakerUpdate) -> Speaker:
    speaker = get_speaker(session, speaker_id)
    speaker.sqlmodel_update(data.model_dump(exclude_unset=True))
    session.commit()
    session.refresh(speaker)
    return speaker


def delete_speaker(session: Session, speaker_id: int) -> None:
    session.delete(get_speaker(session, speaker_id))
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        if violated_constraint(exc) == "fk_session_speakers_speaker_id":
            raise SpeakerHasSessionsError() from exc
        raise
    session.commit()
