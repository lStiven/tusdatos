from unittest.mock import Mock

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.users import repository as users_repository
from app.modules.users.models import User
from app.shared.exceptions import UnauthorizedError


def make_user(*, is_active: bool = True) -> User:
    return User(
        id=1,
        email="ana@example.com",
        password_hash="stored-hash",
        full_name="Ana",
        is_active=is_active,
    )


def test_register_reraises_violations_of_other_constraints(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = Mock(spec=Session)
    session.flush.side_effect = IntegrityError("INSERT", {}, Exception("violation"))
    monkeypatch.setattr(auth_service, "violated_constraint", lambda exc: "ck_other")
    request = RegisterRequest(
        email="ana@example.com", password="correct horse", full_name="Ana"
    )

    with pytest.raises(IntegrityError):
        auth_service.register(session, request)
    session.rollback.assert_called_once()


@pytest.mark.parametrize(
    ("found", "valid"),
    [(None, False), (make_user(), False), (make_user(is_active=False), True)],
    ids=["unknown-email", "wrong-password", "inactive-account"],
)
def test_authenticate_rejects_every_bad_login_with_the_same_error(
    monkeypatch: pytest.MonkeyPatch, found: User | None, valid: bool
) -> None:
    monkeypatch.setattr(users_repository, "get_by_email", lambda session, email: found)
    monkeypatch.setattr(auth_service, "verify_password", lambda pw, h: (valid, None))

    with pytest.raises(UnauthorizedError) as info:
        auth_service.authenticate(Mock(spec=Session), "ana@example.com", "pw")

    assert info.value.code == "invalid_credentials"


def test_authenticate_saves_the_upgraded_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    user, session = make_user(), Mock(spec=Session)
    monkeypatch.setattr(users_repository, "get_by_email", lambda session, email: user)
    monkeypatch.setattr(
        auth_service, "verify_password", lambda pw, h: (True, "new-hash")
    )

    assert auth_service.authenticate(session, "ana@example.com", "pw") is user
    assert user.password_hash == "new-hash"
    session.commit.assert_called_once()


def test_issue_token_identifies_the_user_and_reports_its_lifetime() -> None:
    token = auth_service.issue_token(make_user())

    assert decode_access_token(token.access_token) == 1
    assert token.expires_in == get_settings().access_token_expire_minutes * 60
