from fastapi import APIRouter

from app.modules.auth.dependencies import CurrentUserDep
from app.modules.users import service as users_service
from app.modules.users.schemas import UserRead
from app.shared.dependencies import SessionDep
from app.shared.exceptions import error_responses

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=UserRead,
    summary="Current user profile",
    description="Returns the authenticated user with their roles.",
    responses=error_responses(401),
)
def read_me(user: CurrentUserDep, session: SessionDep) -> UserRead:
    return users_service.get_profile(session, user)
