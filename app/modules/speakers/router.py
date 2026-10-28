from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.exceptions import AUTHENTICATION_ERRORS
from app.modules.speakers import service as speakers_service
from app.modules.speakers.exceptions import (
    SpeakerHasSessionsError,
    SpeakerNotFoundError,
)
from app.modules.speakers.schemas import SpeakerCreate, SpeakerRead, SpeakerUpdate
from app.modules.users.models import RoleCode
from app.shared.dependencies import SessionDep
from app.shared.exceptions import ForbiddenError, error_responses
from app.shared.pagination import Page, PageParamsDep

require_speaker_manager = require_roles(RoleCode.ORGANIZER, RoleCode.ADMIN)

router = APIRouter(
    prefix="/speakers", tags=["speakers"], dependencies=[Depends(get_current_user)]
)

_MANAGER_ERRORS = (*AUTHENTICATION_ERRORS, ForbiddenError)


@router.post(
    "",
    response_model=SpeakerRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_speaker_manager)],
    summary="Create a speaker",
    responses=error_responses(*_MANAGER_ERRORS),
)
def create_speaker(data: SpeakerCreate, session: SessionDep) -> SpeakerRead:
    """Create a speaker profile. Requires the `ORGANIZER` or `ADMIN` role.

    **Rules**
    - Speakers are not user accounts: `email` is only a contact and may repeat
      across speakers.
    - Speakers are shared by every event; there is no owner.
    """
    return SpeakerRead.model_validate(speakers_service.create_speaker(session, data))


@router.get(
    "",
    response_model=Page[SpeakerRead],
    summary="List speakers",
    responses=error_responses(*AUTHENTICATION_ERRORS),
)
def list_speakers(
    session: SessionDep,
    page: PageParamsDep,
    name: Annotated[
        str | None,
        Query(
            max_length=200,
            description="Case-insensitive part of the name; omit to get all",
        ),
    ] = None,
) -> Page[SpeakerRead]:
    """Speakers ordered by name, optionally filtered by part of it."""
    speakers, total = speakers_service.list_speakers(session, name=name, page=page)
    return Page(
        items=[SpeakerRead.model_validate(speaker) for speaker in speakers],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get(
    "/{speaker_id}",
    response_model=SpeakerRead,
    summary="Get a speaker",
    responses=error_responses(*AUTHENTICATION_ERRORS, SpeakerNotFoundError),
)
def get_speaker(speaker_id: int, session: SessionDep) -> SpeakerRead:
    """Return a speaker."""
    return SpeakerRead.model_validate(speakers_service.get_speaker(session, speaker_id))


@router.patch(
    "/{speaker_id}",
    response_model=SpeakerRead,
    dependencies=[Depends(require_speaker_manager)],
    summary="Update a speaker",
    responses=error_responses(*_MANAGER_ERRORS, SpeakerNotFoundError),
)
def update_speaker(
    speaker_id: int, data: SpeakerUpdate, session: SessionDep
) -> SpeakerRead:
    """Partially update a speaker. Requires the `ORGANIZER` or `ADMIN` role.

    **Rules**
    - Omitted fields keep their value. `email` and `bio` accept `null` to clear
      them; `full_name` does not.
    - The change shows in every session the speaker is assigned to, in any event.
    """
    speaker = speakers_service.update_speaker(session, speaker_id, data)
    return SpeakerRead.model_validate(speaker)


@router.delete(
    "/{speaker_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_speaker_manager)],
    summary="Delete a speaker",
    responses=error_responses(
        *_MANAGER_ERRORS, SpeakerNotFoundError, SpeakerHasSessionsError
    ),
)
def delete_speaker(speaker_id: int, session: SessionDep) -> None:
    """Delete a speaker. Requires the `ORGANIZER` or `ADMIN` role.

    **Rules**
    - Only speakers never assigned to a session can be deleted; once assigned,
      even to a cancelled or past session, they stay for the history.
    """
    speakers_service.delete_speaker(session, speaker_id)
