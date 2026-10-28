from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.modules.auth.dependencies import CurrentUserDep, require_admin
from app.modules.auth.exceptions import AUTHENTICATION_ERRORS
from app.modules.users import service as users_service
from app.modules.users.exceptions import LastAdminError, UserNotFoundError
from app.modules.users.models import RoleCode, User
from app.modules.users.schemas import AssignableRole, UserRead
from app.shared.dependencies import SessionDep
from app.shared.exceptions import ForbiddenError, error_responses
from app.shared.pagination import Page, PageParamsDep

router = APIRouter(prefix="/users", tags=["users"])

_ADMIN_ERRORS = (*AUTHENTICATION_ERRORS, ForbiddenError)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Current user profile",
    responses=error_responses(*AUTHENTICATION_ERRORS),
)
def read_me(user: CurrentUserDep, session: SessionDep) -> UserRead:
    """Return the authenticated user with their roles.

    **Rules**
    - The user is read on every request: a deactivated or deleted account gets
      `401 invalid_token` even if its token has not expired.
    - Use `roles` to decide what to show; the API still checks permissions on
      every operation.
    """
    return users_service.get_profile(session, user)


@router.get(
    "",
    response_model=Page[UserRead],
    dependencies=[Depends(require_admin)],
    summary="List users",
    responses=error_responses(*_ADMIN_ERRORS),
)
def list_users(
    session: SessionDep,
    page: PageParamsDep,
    email: Annotated[
        str | None,
        Query(max_length=320, description="Case-insensitive part of the email"),
    ] = None,
    role: Annotated[
        RoleCode | None, Query(description="Only users with this role")
    ] = None,
) -> Page[UserRead]:
    """Users ordered by email, with their roles. Requires the `ADMIN` role."""
    users, total = users_service.list_users(session, email=email, role=role, page=page)
    return Page(items=users, total=total, limit=page.limit, offset=page.offset)


@router.get(
    "/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_admin)],
    summary="Get a user",
    responses=error_responses(*_ADMIN_ERRORS, UserNotFoundError),
)
def get_user(user_id: int, session: SessionDep) -> UserRead:
    """Return a user with their roles. Requires the `ADMIN` role."""
    return users_service.get_user(session, user_id)


@router.put(
    "/{user_id}/roles/{role}",
    response_model=UserRead,
    summary="Grant a role",
    responses=error_responses(*_ADMIN_ERRORS, UserNotFoundError),
)
def grant_role(
    user_id: int,
    role: AssignableRole,
    admin: Annotated[User, Depends(require_admin)],
    session: SessionDep,
) -> UserRead:
    """Grant `ORGANIZER` or `ADMIN` to a user. Requires the `ADMIN` role.

    **Rules**
    - Granting a role the user already has changes nothing and returns `200`.
    - The grant records which admin made it. It applies from the user's next
      request; there is no need to log in again.
    """
    return users_service.grant_role(session, admin, user_id, role)


@router.delete(
    "/{user_id}/roles/{role}",
    response_model=UserRead,
    dependencies=[Depends(require_admin)],
    summary="Revoke a role",
    responses=error_responses(*_ADMIN_ERRORS, UserNotFoundError, LastAdminError),
)
def revoke_role(user_id: int, role: AssignableRole, session: SessionDep) -> UserRead:
    """Revoke `ORGANIZER` or `ADMIN` from a user. Requires the `ADMIN` role.

    **Rules**
    - Revoking a role the user does not have changes nothing and returns `200`.
    - There is always at least one active admin: removing the last one is
      rejected, even if it is yourself.
    - Without `ORGANIZER`, the user keeps owning their events but can no longer
      create or change them; admins still can.
    - `ATTENDEE` belongs to every account and cannot be revoked.
    """
    return users_service.revoke_role(session, user_id, role)
