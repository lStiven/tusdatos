from collections.abc import Callable
from unittest.mock import Mock

import jwt
import pytest
from sqlmodel import Session

from app.modules.auth import dependencies as auth_dependencies
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User
from app.shared.exceptions import ForbiddenError, UnauthorizedError

ACTIVE = User(id=1, email="ana@example.com", password_hash="h", full_name="Ana")
INACTIVE = User(
    id=1, email="ana@example.com", password_hash="h", full_name="Ana", is_active=False
)


def raise_(error: Exception) -> Callable[[str], int]:
    def fail(token: str) -> int:
        raise error

    return fail


def session_returning(user: User | None) -> Mock:
    session = Mock(spec=Session)
    session.get.return_value = user
    return session


@pytest.mark.parametrize(
    ("decode", "found", "code"),
    [
        (raise_(jwt.ExpiredSignatureError()), ACTIVE, "token_expired"),
        (raise_(jwt.InvalidTokenError()), ACTIVE, "invalid_token"),
        (lambda token: 1, None, "invalid_token"),
        (lambda token: 1, INACTIVE, "invalid_token"),
    ],
    ids=["expired", "malformed", "deleted-user", "inactive-user"],
)
def test_rejects_tokens_that_do_not_lead_to_an_active_user(
    monkeypatch: pytest.MonkeyPatch,
    decode: Callable[[str], int],
    found: User | None,
    code: str,
) -> None:
    monkeypatch.setattr(auth_dependencies, "decode_access_token", decode)

    with pytest.raises(UnauthorizedError) as info:
        auth_dependencies.get_current_user(session_returning(found), "token")

    assert info.value.code == code


def test_returns_the_active_user_the_token_belongs_to(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth_dependencies, "decode_access_token", lambda token: 1)
    session = session_returning(ACTIVE)

    assert auth_dependencies.get_current_user(session, "token") is ACTIVE
    session.get.assert_called_once_with(User, 1)


@pytest.mark.parametrize(
    ("roles", "allowed"),
    [
        ([RoleCode.ATTENDEE, RoleCode.ADMIN], True),
        ([RoleCode.ORGANIZER], True),
        ([RoleCode.ATTENDEE], False),
    ],
    ids=["one-of-many", "any-listed-role", "none-listed"],
)
def test_require_roles_needs_any_of_the_listed_roles(
    monkeypatch: pytest.MonkeyPatch, roles: list[RoleCode], allowed: bool
) -> None:
    monkeypatch.setattr(
        users_repository, "get_role_codes", lambda session, user_id: roles
    )
    check = auth_dependencies.require_roles(RoleCode.ORGANIZER, RoleCode.ADMIN)

    if allowed:
        assert check(ACTIVE, Mock(spec=Session)) is ACTIVE
    else:
        with pytest.raises(ForbiddenError):
            check(ACTIVE, Mock(spec=Session))
