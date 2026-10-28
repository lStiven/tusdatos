from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.auth.exceptions import AUTHENTICATION_ERRORS
from app.modules.venues import service as venues_service
from app.modules.venues.exceptions import (
    RoomCapacityBelowSessionsError,
    RoomHasScheduledSessionsError,
    RoomNameTakenError,
    RoomNotFoundError,
    VenueHasScheduledSessionsError,
    VenueNotFoundError,
)
from app.modules.venues.schemas import (
    RoomCreate,
    RoomRead,
    RoomUpdate,
    VenueCreate,
    VenueRead,
    VenueUpdate,
)
from app.shared.dependencies import SessionDep
from app.shared.exceptions import ForbiddenError, error_responses
from app.shared.pagination import Page, PageParamsDep

router = APIRouter(
    prefix="/venues", tags=["venues"], dependencies=[Depends(get_current_user)]
)

_ADMIN_ERRORS = (*AUTHENTICATION_ERRORS, ForbiddenError)


@router.post(
    "",
    response_model=VenueRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    summary="Create a venue",
    description="Creates an active venue without rooms. Requires the `ADMIN` role.",
    responses=error_responses(*_ADMIN_ERRORS),
)
def create_venue(data: VenueCreate, session: SessionDep) -> VenueRead:
    return VenueRead.model_validate(venues_service.create_venue(session, data))


@router.get(
    "",
    response_model=Page[VenueRead],
    summary="List venues",
    description="Venues ordered by name, active and inactive unless filtered.",
    responses=error_responses(*AUTHENTICATION_ERRORS),
)
def list_venues(
    session: SessionDep,
    page: PageParamsDep,
    is_active: Annotated[
        bool | None, Query(description="Filter by status; omit to get all")
    ] = None,
) -> Page[VenueRead]:
    venues, total = venues_service.list_venues(session, is_active=is_active, page=page)
    return Page(
        items=[VenueRead.model_validate(venue) for venue in venues],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get(
    "/{venue_id}",
    response_model=VenueRead,
    summary="Get a venue",
    description="Returns a venue, active or not.",
    responses=error_responses(*AUTHENTICATION_ERRORS, VenueNotFoundError),
)
def get_venue(venue_id: int, session: SessionDep) -> VenueRead:
    return VenueRead.model_validate(venues_service.get_venue(session, venue_id))


@router.patch(
    "/{venue_id}",
    response_model=VenueRead,
    dependencies=[Depends(require_admin)],
    summary="Update a venue",
    responses=error_responses(
        *_ADMIN_ERRORS, VenueNotFoundError, VenueHasScheduledSessionsError
    ),
)
def update_venue(venue_id: int, data: VenueUpdate, session: SessionDep) -> VenueRead:
    """Partially update a venue. Requires the `ADMIN` role.

    **Rules**
    - Omitted fields keep their value. `address` and `city` accept `null` to
      clear them; `name` and `is_active` do not.
    - Venues are never deleted: set `is_active: false` to take one out of
      scheduling. Its rooms keep their own `is_active`.
    - A venue cannot be deactivated while any of its rooms has a `SCHEDULED`
      session that has not ended; past sessions do not count.
    """
    venue = venues_service.update_venue(session, venue_id, data)
    return VenueRead.model_validate(venue)


@router.get(
    "/{venue_id}/rooms",
    response_model=list[RoomRead],
    summary="List the rooms of a venue",
    description="All the rooms of the venue ordered by name, active and inactive.",
    responses=error_responses(*AUTHENTICATION_ERRORS, VenueNotFoundError),
)
def list_rooms(venue_id: int, session: SessionDep) -> list[RoomRead]:
    rooms = venues_service.list_rooms(session, venue_id)
    return [RoomRead.model_validate(room) for room in rooms]


@router.post(
    "/{venue_id}/rooms",
    response_model=RoomRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    summary="Create a room",
    responses=error_responses(*_ADMIN_ERRORS, VenueNotFoundError, RoomNameTakenError),
)
def create_room(venue_id: int, data: RoomCreate, session: SessionDep) -> RoomRead:
    """Add an active room to a venue. Requires the `ADMIN` role.

    **Rules**
    - The name is unique within the venue (case-sensitive); other venues may
      reuse it.
    - `capacity` is the number of physical seats; sessions in the room can
      never exceed it.
    """
    room = venues_service.create_room(session, venue_id, data)
    return RoomRead.model_validate(room)


@router.patch(
    "/{venue_id}/rooms/{room_id}",
    response_model=RoomRead,
    dependencies=[Depends(require_admin)],
    summary="Update a room",
    responses=error_responses(
        *_ADMIN_ERRORS,
        RoomNotFoundError,
        RoomNameTakenError,
        RoomHasScheduledSessionsError,
        RoomCapacityBelowSessionsError,
    ),
)
def update_room(
    venue_id: int, room_id: int, data: RoomUpdate, session: SessionDep
) -> RoomRead:
    """Partially update a room. Requires the `ADMIN` role.

    **Rules**
    - Omitted fields keep their value; none accepts `null`.
    - Only `SCHEDULED` sessions that have not ended bind the room. While one
      exists:
        - `capacity` cannot drop below the largest of them (raising it or
          keeping it is always allowed);
        - the room cannot be deactivated (`is_active: false`).
    - Rooms are never deleted; deactivate them instead.
    """
    room = venues_service.update_room(session, venue_id, room_id, data)
    return RoomRead.model_validate(room)
