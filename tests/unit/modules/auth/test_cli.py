import getpass
from collections.abc import Sequence
from unittest.mock import MagicMock

import pytest

from app.modules.auth import cli as auth_cli
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.users.models import RoleCode, User
from app.shared.exceptions import ConflictError

ARGS = ["create-admin", "--email", "boss@example.com", "--full-name", "Boss"]


@pytest.fixture(autouse=True)
def no_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_cli, "Session", MagicMock())


def test_creates_the_user_with_the_admin_role(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    calls: list[tuple[str, Sequence[RoleCode]]] = []

    def register(
        session: object, request: RegisterRequest, *, roles: Sequence[RoleCode]
    ) -> User:
        calls.append((request.email, roles))
        return User(id=7, email=request.email, password_hash="h", full_name="Boss")

    monkeypatch.setenv(auth_cli.PASSWORD_ENV, "correct horse")
    monkeypatch.setattr(auth_service, "register", register)

    auth_cli.main(ARGS)

    assert calls == [("boss@example.com", (RoleCode.ATTENDEE, RoleCode.ADMIN))]
    assert capsys.readouterr().out == "Admin created: boss@example.com (id 7)\n"


@pytest.mark.parametrize(
    ("env_password", "typed", "message"),
    [
        (None, ["correct horse", "correct h0rse"], "Passwords do not match"),
        ("short", [], "password: String should have at least 8 characters"),
        ("correct horse", [], "Email already exists"),
    ],
    ids=["prompted-twice-differently", "too-short", "email-taken"],
)
def test_fails_with_a_readable_message(
    monkeypatch: pytest.MonkeyPatch,
    env_password: str | None,
    typed: list[str],
    message: str,
) -> None:
    if env_password is None:
        monkeypatch.delenv(auth_cli.PASSWORD_ENV, raising=False)
    else:
        monkeypatch.setenv(auth_cli.PASSWORD_ENV, env_password)
    answers = iter(typed)
    monkeypatch.setattr(getpass, "getpass", lambda prompt: next(answers))

    def register(*args: object, **kwargs: object) -> User:
        raise ConflictError("Email already exists", code="email_taken")

    monkeypatch.setattr(auth_service, "register", register)

    with pytest.raises(SystemExit) as info:
        auth_cli.main(ARGS)

    assert info.value.code == message
