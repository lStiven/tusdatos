from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.modules.auth import service as auth_service
from app.modules.auth.exceptions import EmailTakenError, InvalidCredentialsError
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
    responses=error_responses(EmailTakenError),
)
def register(data: RegisterRequest, session: SessionDep) -> UserRead:
    """Create an account and return its profile. Does not log in.

    **Rules**
    - The account always gets the `ATTENDEE` role; roles cannot be requested
      here. Only an admin can grant `ORGANIZER` or `ADMIN`.
    - The email is stored lowercase and is unique regardless of case:
      `Ana@x.com` and `ana@x.com` are the same account.
    - Password: 8 to 128 characters, no composition rules.
    """
    user = auth_service.register(session, data)
    return users_service.get_profile(session, user)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Log in",
    responses=error_responses(InvalidCredentialsError),
)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep
) -> TokenResponse:
    """Exchange email and password for a Bearer token (OAuth2 password flow).

    **Rules**
    - Send form data (`application/x-www-form-urlencoded`), not JSON:
      `username` is the email (any letter case) and `password` the password.
    - The token lasts `expires_in` seconds and there is no refresh token: when
      a request returns `401 token_expired`, log in again.
    - Wrong email, wrong password and inactive account return the same error,
      so the response does not reveal which emails are registered.
    """
    user = auth_service.authenticate(session, form.username, form.password)
    return auth_service.issue_token(user)
