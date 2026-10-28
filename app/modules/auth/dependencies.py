from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app.core.security import decode_access_token
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User
from app.shared.dependencies import SessionDep
from app.shared.exceptions import ForbiddenError, UnauthorizedError
from app.shared.models import id_of

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def get_current_user(
    session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    try:
        user_id = decode_access_token(token)
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Token expired", code="token_expired") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Invalid token", code="invalid_token") from exc
    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid token", code="invalid_token")
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_roles(*codes: RoleCode) -> Callable[[User, Session], User]:
    allowed = frozenset(codes)

    def check_roles(user: CurrentUserDep, session: SessionDep) -> User:
        if allowed.isdisjoint(users_repository.get_role_codes(session, id_of(user))):
            raise ForbiddenError()
        return user

    return check_roles


require_admin = require_roles(RoleCode.ADMIN)
