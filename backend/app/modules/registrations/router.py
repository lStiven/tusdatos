from typing import Annotated

from fastapi import APIRouter, Query, Response
from fastapi import status as http_status

from app.modules.auth.dependencies import CurrentUserDep
from app.modules.auth.exceptions import AUTHENTICATION_ERRORS
from app.modules.events.exceptions import EventNotFoundError, NotEventOwnerError
from app.modules.registrations import service as registrations_service
from app.modules.registrations.exceptions import (
    CancellationClosedError,
    EventNotOpenError,
    RegistrationClosedError,
    RegistrationNotFoundError,
)
from app.modules.registrations.models import RegistrationStatus
from app.modules.registrations.schemas import (
    EventRegistrationRead,
    Occupancy,
    RegistrationRead,
)
from app.shared.dependencies import SessionDep
from app.shared.exceptions import error_responses
from app.shared.pagination import Page, PageParamsDep

router = APIRouter(tags=["registrations"])

StatusFilter = Annotated[
    RegistrationStatus | None, Query(description="Filter by status; omit to get all")
]


@router.post(
    "/events/{event_id}/registrations",
    response_model=RegistrationRead,
    status_code=http_status.HTTP_201_CREATED,
    summary="Register for an event",
    responses={
        200: {
            "model": RegistrationRead,
            "description": "Already registered: the existing registration, unchanged",
        },
        **error_responses(
            *AUTHENTICATION_ERRORS,
            EventNotFoundError,
            EventNotOpenError,
            RegistrationClosedError,
        ),
    },
)
def register(
    event_id: int, user: CurrentUserDep, session: SessionDep, response: Response
) -> RegistrationRead:
    """Ask for a seat in a published event for the current user.

    **Rules**
    - With a free seat the registration is `CONFIRMED`: the seat is guaranteed.
      Without one it is `WAITLISTED`, which does **not** guarantee a seat;
      `waitlist_position` tells the current place in the queue.
    - The waitlist is first come, first served by the order in which the server
      processes requests. When a seat frees up, the first in the queue is
      confirmed automatically; newcomers never jump the queue.
    - Retrying is safe: if the user is already confirmed or waitlisted, the
      response is `200` with that registration, unchanged. After a cancellation,
      registering again is a new request and goes to the back of the queue.
    - Only `PUBLISHED` events accept registrations, until
      `registration_closes_at` or, if the event sets none, until `starts_at`.
    - A `503` means the event was too busy to answer in time; nothing was saved.
      Retry: the result never duplicates the registration.
    """
    registration, created = registrations_service.register(session, user, event_id)
    if not created:
        response.status_code = http_status.HTTP_200_OK
    return registration


@router.get(
    "/events/{event_id}/registrations/me",
    response_model=RegistrationRead,
    summary="Get my registration for an event",
    responses=error_responses(
        *AUTHENTICATION_ERRORS, EventNotFoundError, RegistrationNotFoundError
    ),
)
def get_my_registration(
    event_id: int, user: CurrentUserDep, session: SessionDep
) -> RegistrationRead:
    """Return the current user's registration for the event, in any status."""
    return registrations_service.get_mine(session, user, event_id)


@router.post(
    "/events/{event_id}/registrations/me/cancel",
    response_model=RegistrationRead,
    summary="Cancel my registration",
    responses=error_responses(
        *AUTHENTICATION_ERRORS,
        EventNotFoundError,
        RegistrationNotFoundError,
        CancellationClosedError,
    ),
)
def cancel_my_registration(
    event_id: int, user: CurrentUserDep, session: SessionDep
) -> RegistrationRead:
    """Cancel the current user's registration, confirmed or waitlisted.

    **Rules**
    - Allowed until the event starts, even after registration has closed.
    - Cancelling a confirmed registration gives its seat to the first person in
      the waitlist, at once. Cancelling a waitlisted one just leaves the queue.
    - The user's interests in the event's sessions are withdrawn.
    - Cancelling an already cancelled registration returns it unchanged.
    """
    return registrations_service.cancel(session, user, event_id)


@router.get(
    "/events/{event_id}/registrations",
    response_model=Page[EventRegistrationRead],
    summary="List the registrations of an event",
    responses=error_responses(
        *AUTHENTICATION_ERRORS, EventNotFoundError, NotEventOwnerError
    ),
)
def list_event_registrations(
    event_id: int,
    user: CurrentUserDep,
    session: SessionDep,
    page: PageParamsDep,
    status: StatusFilter = None,
) -> Page[EventRegistrationRead]:
    """Registrations of an event with their attendees. Owner organizer or admin.

    **Rules**
    - Confirmed and cancelled registrations come first, by request time; then
      the waitlist, in queue order.
    """
    items, total = registrations_service.list_for_event(
        session, user, event_id, status=status, page=page
    )
    return Page(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get(
    "/events/{event_id}/occupancy",
    response_model=Occupancy,
    summary="Get the occupancy of an event",
    responses=error_responses(*AUTHENTICATION_ERRORS, EventNotFoundError),
)
def get_occupancy(
    event_id: int, user: CurrentUserDep, session: SessionDep
) -> Occupancy:
    """Seats taken and left, and waitlist size, for anyone who can see the event.

    **Rules**
    - The figures are a snapshot: they can change right after the response, so
      a free seat here does not guarantee one when registering.
    """
    return registrations_service.get_occupancy(session, user, event_id)


@router.get(
    "/users/me/registrations",
    response_model=Page[RegistrationRead],
    summary="List my registrations",
    responses=error_responses(*AUTHENTICATION_ERRORS),
)
def list_my_registrations(
    user: CurrentUserDep,
    session: SessionDep,
    page: PageParamsDep,
    status: StatusFilter = None,
) -> Page[RegistrationRead]:
    """The current user's registrations, newest request first."""
    items, total = registrations_service.list_mine(
        session, user, status=status, page=page
    )
    return Page(items=items, total=total, limit=page.limit, offset=page.offset)
