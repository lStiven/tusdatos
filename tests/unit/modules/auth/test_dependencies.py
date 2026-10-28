from collections.abc import Callable
from unittest.mock import Mock

import jwt
import pytest
from sqlmodel import Session

from app.modules.auth import dependencies as auth_dependencies
from app.modules.users.models import User
from app.shared.exceptions import UnauthorizedError

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
