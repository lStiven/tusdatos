from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest, TokenResponse
from app.modules.users import service as users_service
from app.modules.users.schemas import UserRead
from app.shared.dependencies import SessionDep
from app.shared.exceptions import error_responses

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register an account",
    description=(
        "Creates an account with the `ATTENDEE` role. Roles cannot be chosen "
        "here. The email is stored lowercase and is unique regardless of case."
    ),
    responses=error_responses(
        descriptions={409: "`email_taken`: email already registered"}
    ),
)
def register(data: RegisterRequest, session: SessionDep) -> UserRead:
    user = auth_service.register(session, data)
    return users_service.get_profile(session, user)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Log in",
    description=(
        "OAuth2 password flow (form data): `username` is the email. Returns a "
        "Bearer token valid for `expires_in` seconds. Wrong email, wrong password "
        "and inactive account all return the same error."
    ),
    responses=error_responses(
        descriptions={401: "`invalid_credentials`: wrong email or password"}
    ),
)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep
) -> TokenResponse:
    user = auth_service.authenticate(session, form.username, form.password)
    return auth_service.issue_token(user)
