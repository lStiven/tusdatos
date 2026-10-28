from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.venues import service as venues_service
from app.modules.venues.schemas import (
    RoomCreate,
    RoomRead,
    RoomUpdate,
    VenueCreate,
    VenueRead,
    VenueUpdate,
)
from app.shared.dependencies import SessionDep
from app.shared.exceptions import error_responses
from app.shared.pagination import Page, PageParamsDep

router = APIRouter(
    prefix="/venues", tags=["venues"], dependencies=[Depends(get_current_user)]
)

_ADMIN_ONLY = "Requires the `ADMIN` role."
_VENUE_NOT_FOUND = "`venue_not_found`"
_ROOM_NOT_FOUND = "`venue_not_found` or `room_not_found` (room of another venue)"
_ROOM_NAME_TAKEN = "`room_name_taken`: the venue already has a room with that name"


@router.post(
    "",
    response_model=VenueRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    summary="Create a venue",
    description=f"Creates an active venue without rooms. {_ADMIN_ONLY}",
    responses=error_responses(401, 403),
)
def create_venue(data: VenueCreate, session: SessionDep) -> VenueRead:
    return VenueRead.model_validate(venues_service.create_venue(session, data))


@router.get(
    "",
    response_model=Page[VenueRead],
    summary="List venues",
    description="Venues ordered by name. Any authenticated user can list them.",
    responses=error_responses(401),
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
    responses=error_responses(401, 404, descriptions={404: _VENUE_NOT_FOUND}),
)
def get_venue(venue_id: int, session: SessionDep) -> VenueRead:
    return VenueRead.model_validate(venues_service.get_venue(session, venue_id))


@router.patch(
    "/{venue_id}",
    response_model=VenueRead,
    dependencies=[Depends(require_admin)],
    summary="Update a venue",
    description=(
        "Partial update: omitted fields keep their value. A venue cannot be "
        "deactivated while any of its rooms has a scheduled session that has not "
        f"ended. {_ADMIN_ONLY}"
    ),
    responses=error_responses(
        401,
        403,
        404,
        409,
        descriptions={
            404: _VENUE_NOT_FOUND,
            409: "`venue_has_scheduled_sessions`: reschedule or cancel them first",
        },
    ),
)
def update_venue(venue_id: int, data: VenueUpdate, session: SessionDep) -> VenueRead:
    venue = venues_service.update_venue(session, venue_id, data)
    return VenueRead.model_validate(venue)


@router.get(
    "/{venue_id}/rooms",
    response_model=list[RoomRead],
    summary="List the rooms of a venue",
    description="Rooms ordered by name, active and inactive.",
    responses=error_responses(401, 404, descriptions={404: _VENUE_NOT_FOUND}),
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
    description=f"Adds an active room to the venue. {_ADMIN_ONLY}",
    responses=error_responses(
        401,
        403,
        404,
        409,
        descriptions={404: _VENUE_NOT_FOUND, 409: _ROOM_NAME_TAKEN},
    ),
)
def create_room(venue_id: int, data: RoomCreate, session: SessionDep) -> RoomRead:
    room = venues_service.create_room(session, venue_id, data)
    return RoomRead.model_validate(room)


@router.patch(
    "/{venue_id}/rooms/{room_id}",
    response_model=RoomRead,
    dependencies=[Depends(require_admin)],
    summary="Update a room",
    description=(
        "Partial update: omitted fields keep their value. Only scheduled sessions "
        "that have not ended bind the room: while any exists, the room cannot be "
        "deactivated and its capacity cannot drop below the largest session's. "
        f"{_ADMIN_ONLY}"
    ),
    responses=error_responses(
        401,
        403,
        404,
        409,
        descriptions={
            404: _ROOM_NOT_FOUND,
            409: (
                f"{_ROOM_NAME_TAKEN}; `room_has_scheduled_sessions`; "
                "`room_capacity_below_sessions`"
            ),
        },
    ),
)
def update_room(
    venue_id: int, room_id: int, data: RoomUpdate, session: SessionDep
) -> RoomRead:
    room = venues_service.update_room(session, venue_id, room_id, data)
    return RoomRead.model_validate(room)
