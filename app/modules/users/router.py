from fastapi import APIRouter

from app.modules.auth.dependencies import CurrentUserDep
from app.modules.auth.exceptions import AUTHENTICATION_ERRORS
from app.modules.users import service as users_service
from app.modules.users.schemas import UserRead
from app.shared.dependencies import SessionDep
from app.shared.exceptions import error_responses

router = APIRouter(prefix="/users", tags=["users"])


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
