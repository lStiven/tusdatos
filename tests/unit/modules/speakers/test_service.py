from collections.abc import Callable
from unittest.mock import Mock

import pytest
from psycopg import errors as pg_errors
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.modules.speakers import repository as speakers_repository
from app.modules.speakers import service as speakers_service
from app.modules.speakers.models import Speaker
from app.modules.speakers.schemas import SpeakerUpdate
from app.shared.exceptions import ConflictError, NotFoundError


def make_speaker() -> Speaker:
    return Speaker(id=3, full_name="Ada", email="ada@example.com", bio="Old bio")


def integrity_error(constraint: str) -> IntegrityError:
    orig = Mock(spec=pg_errors.ForeignKeyViolation)
    orig.diag.constraint_name = constraint
    return IntegrityError("DELETE", {}, orig)


def test_update_speaker_applies_only_the_sent_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    speaker, session = make_speaker(), Mock(spec=Session)
    monkeypatch.setattr(speakers_repository, "get_speaker", lambda *a: speaker)

    speakers_service.update_speaker(session, 3, SpeakerUpdate(bio=None))

    assert (speaker.full_name, speaker.email, speaker.bio) == (
        "Ada",
        "ada@example.com",
        None,
    )
    session.commit.assert_called_once()


@pytest.mark.parametrize(
    "call",
    [
        lambda session: speakers_service.get_speaker(session, 3),
        lambda session: speakers_service.update_speaker(session, 3, SpeakerUpdate()),
        lambda session: speakers_service.delete_speaker(session, 3),
    ],
    ids=["get", "update", "delete"],
)
def test_missing_speaker_raises_not_found(
    monkeypatch: pytest.MonkeyPatch, call: Callable[[Session], object]
) -> None:
    monkeypatch.setattr(speakers_repository, "get_speaker", lambda *a: None)

    with pytest.raises(NotFoundError) as info:
        call(Mock(spec=Session))

    assert info.value.code == "speaker_not_found"


def test_delete_assigned_speaker_raises_conflict_and_rolls_back(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = Mock(spec=Session)
    session.flush.side_effect = integrity_error("fk_session_speakers_speaker_id")
    monkeypatch.setattr(speakers_repository, "get_speaker", lambda *a: make_speaker())

    with pytest.raises(ConflictError) as info:
        speakers_service.delete_speaker(session, 3)

    assert info.value.code == "speaker_has_sessions"
    session.rollback.assert_called_once()
    session.commit.assert_not_called()


def test_delete_reraises_unrelated_integrity_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = Mock(spec=Session)
    session.flush.side_effect = integrity_error("some_other_constraint")
    monkeypatch.setattr(speakers_repository, "get_speaker", lambda *a: make_speaker())

    with pytest.raises(IntegrityError):
        speakers_service.delete_speaker(session, 3)
