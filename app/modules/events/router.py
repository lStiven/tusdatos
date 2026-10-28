from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status

from app.modules.auth.dependencies import CurrentUserDep, require_roles
from app.modules.auth.exceptions import AUTHENTICATION_ERRORS
from app.modules.events import service as events_service
from app.modules.events.exceptions import (
    CapacityBelowConfirmedError,
    EventAlreadyStartedError,
    EventHasScheduledSessionsError,
    EventNotEditableError,
    EventNotEndedError,
    EventNotFoundError,
    EventRequiresVenueError,
    InvalidEventScheduleError,
    InvalidStatusTransitionError,
    NotEventOwnerError,
    SessionsOutsideEventError,
    VenueInactiveError,
)
from app.modules.events.models import EventStatus
from app.modules.events.schemas import EventCreate, EventRead, EventUpdate
from app.modules.users.models import RoleCode, User
from app.modules.venues.exceptions import VenueNotFoundError
from app.shared.dependencies import SessionDep
from app.shared.exceptions import ForbiddenError, error_responses
from app.shared.pagination import Page, PageParamsDep

require_event_creator = require_roles(RoleCode.ORGANIZER, RoleCode.ADMIN)

router = APIRouter(prefix="/events", tags=["events"])

_CHANGE_ERRORS = (*AUTHENTICATION_ERRORS, EventNotFoundError, NotEventOwnerError)


@router.get(
    "",
    response_model=Page[EventRead],
    summary="List events",
    responses=error_responses(*AUTHENTICATION_ERRORS),
)
def list_events(
    user: CurrentUserDep,
    session: SessionDep,
    page: PageParamsDep,
    title: Annotated[
        str | None,
        Query(
            max_length=200,
            description="Case-insensitive part of the title; omit to get all",
        ),
    ] = None,
    status: Annotated[
        EventStatus | None, Query(description="Filter by status; omit to get all")
    ] = None,
    mine: Annotated[
        bool, Query(description="`true` returns only the events you own")
    ] = False,
) -> Page[EventRead]:
    """Events ordered by start date, filtered and paginated.

    **Rules**
    - `DRAFT` events are listed only to their owner and to admins; everybody
      else sees the rest of the statuses.
    - `title` matches literally: `%` and `_` are not wildcards.
    - `total` counts only the events the user is allowed to see.
    """
    events, total = events_service.list_events(
        session, user, title=title, status=status, mine=mine, page=page
    )
    return Page(
        items=[EventRead.model_validate(event) for event in events],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get(
    "/{event_id}",
    response_model=EventRead,
    summary="Get an event",
    responses=error_responses(*AUTHENTICATION_ERRORS, EventNotFoundError),
)
def get_event(event_id: int, user: CurrentUserDep, session: SessionDep) -> EventRead:
    """Return an event.

    **Rules**
    - A `DRAFT` event is visible only to its owner and to admins; anyone else
      gets `404 event_not_found`, as if it did not exist.
    """
    return EventRead.model_validate(events_service.get_event(session, user, event_id))


@router.post(
    "",
    response_model=EventRead,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create an event",
    responses=error_responses(
        *AUTHENTICATION_ERRORS,
        ForbiddenError,
        VenueNotFoundError,
        InvalidEventScheduleError,
        VenueInactiveError,
    ),
)
def create_event(
    data: EventCreate,
    user: Annotated[User, Depends(require_event_creator)],
    session: SessionDep,
) -> EventRead:
    """Create a `DRAFT` event owned by the caller. Requires `ORGANIZER` or `ADMIN`.

    **Rules**
    - `starts_at` must be before `ends_at`; `registration_closes_at` cannot be
      after `ends_at`. Send every datetime with its UTC offset; responses are in
      UTC and `timezone` tells how to display them.
    - `venue_id` is optional while planning, but it must point to an active
      venue; publishing will require one.
    - The event stays invisible to other users until it is published.
    """
    return EventRead.model_validate(events_service.create_event(session, user, data))


@router.patch(
    "/{event_id}",
    response_model=EventRead,
    summary="Update an event",
    responses=error_responses(
        *_CHANGE_ERRORS,
        VenueNotFoundError,
        InvalidEventScheduleError,
        EventNotEditableError,
        SessionsOutsideEventError,
        EventRequiresVenueError,
        EventHasScheduledSessionsError,
        VenueInactiveError,
        CapacityBelowConfirmedError,
    ),
)
def update_event(
    event_id: int, data: EventUpdate, user: CurrentUserDep, session: SessionDep
) -> EventRead:
    """Partially update an event. Only its owner or an admin can do it.

    **Rules**
    - Only `DRAFT` and `PUBLISHED` events can be edited; `status` changes go
      through `/publish`, `/complete` and `/cancel`.
    - Omitted fields keep their value. `description`, `registration_closes_at`
      and `venue_id` accept `null`; the rest do not.
    - Dates are checked combined with the current values. Sessions that are not
      cancelled must still fit inside the new dates.
    - `capacity` cannot go below the confirmed registrations. Raising it
      confirms people from the waitlist right away, in queue order, before any
      new registration.
    - `venue_id` cannot change while the event has `SCHEDULED` sessions, must
      point to an active venue and cannot be cleared on a published event.
    """
    event = events_service.update_event(session, user, event_id, data)
    return EventRead.model_validate(event)


@router.post(
    "/{event_id}/publish",
    response_model=EventRead,
    summary="Publish an event",
    responses=error_responses(
        *_CHANGE_ERRORS,
        VenueNotFoundError,
        InvalidStatusTransitionError,
        EventRequiresVenueError,
        VenueInactiveError,
        EventAlreadyStartedError,
    ),
)
def publish_event(
    event_id: int, user: CurrentUserDep, session: SessionDep
) -> EventRead:
    """Move a `DRAFT` event to `PUBLISHED`. Only its owner or an admin can do it.

    **Rules**
    - The event needs an active venue and must not have started.
    - Once published, it is visible to every user and accepts registrations.
      It cannot go back to `DRAFT`.
    - Publishing an already published event returns it unchanged.
    """
    event = events_service.publish_event(session, user, event_id)
    return EventRead.model_validate(event)


@router.post(
    "/{event_id}/complete",
    response_model=EventRead,
    summary="Complete an event",
    responses=error_responses(
        *_CHANGE_ERRORS, InvalidStatusTransitionError, EventNotEndedError
    ),
)
def complete_event(
    event_id: int, user: CurrentUserDep, session: SessionDep
) -> EventRead:
    """Move a `PUBLISHED` event to `COMPLETED`. Only its owner or an admin can do it.

    **Rules**
    - Allowed only after `ends_at`. `COMPLETED` is final: the event can no
      longer be edited or cancelled.
    - Completing an already completed event returns it unchanged.
    """
    event = events_service.complete_event(session, user, event_id)
    return EventRead.model_validate(event)


@router.post(
    "/{event_id}/cancel",
    response_model=EventRead,
    summary="Cancel an event",
    responses=error_responses(*_CHANGE_ERRORS, InvalidStatusTransitionError),
)
def cancel_event(event_id: int, user: CurrentUserDep, session: SessionDep) -> EventRead:
    """Cancel a `DRAFT` or `PUBLISHED` event. Only its owner or an admin can do it.

    **Rules**
    - Everything happens at once or not at all: confirmed and waitlisted
      registrations become `CANCELLED` (nobody is promoted), its sessions become
      `CANCELLED` and free their rooms, and interests in them are withdrawn.
    - `CANCELLED` is final. A completed event cannot be cancelled.
    - Cancelling an already cancelled event returns it unchanged, so retries
      are safe.
    """
    event = events_service.cancel_event(session, user, event_id)
    return EventRead.model_validate(event)
