from collections.abc import Callable
from unittest.mock import Mock

import pytest
from sqlmodel import Session

from app.modules.users import repository as users_repository
from app.modules.users import service as users_service
from app.modules.users.models import Role, RoleCode, User
from app.modules.users.schemas import AssignableRole
from app.shared.exceptions import AppError

ADMIN = User(id=1, email="boss@example.com", password_hash="hash", full_name="B")


def make_user(*, is_active: bool = True) -> User:
    return User(
        id=2,
        email="ana@example.com",
        password_hash="hash",
        full_name="Ana",
        is_active=is_active,
    )


@pytest.fixture
def repository(monkeypatch: pytest.MonkeyPatch) -> Mock:
    fake = Mock(spec=users_repository)
    fake.get_role.side_effect = lambda session, code, **_: Role(
        id=list(RoleCode).index(code) + 1, code=code
    )
    fake.get_role_codes.return_value = [RoleCode.ATTENDEE, RoleCode.ADMIN]
    for name in (
        "get_user",
        "get_role",
        "get_role_codes",
        "add_role",
        "remove_role",
        "count_active_with_role",
    ):
        monkeypatch.setattr(users_repository, name, getattr(fake, name))
    return fake


def test_grant_role_records_the_admin_who_granted_it(repository: Mock) -> None:
    repository.get_user.return_value = make_user()
    session = Mock(spec=Session)

    users_service.grant_role(session, ADMIN, 2, AssignableRole.ORGANIZER)

    repository.add_role.assert_called_once_with(session, 2, 2, 1)
    session.commit.assert_called_once()


@pytest.mark.parametrize(
    ("is_active", "active_admins", "allowed"),
    [(True, 1, False), (True, 2, True), (False, 1, True)],
    ids=["last-active-admin", "another-admin-left", "inactive-target"],
)
def test_revoke_admin_keeps_at_least_one_active_admin(
    repository: Mock, is_active: bool, active_admins: int, allowed: bool
) -> None:
    repository.get_user.return_value = make_user(is_active=is_active)
    repository.count_active_with_role.return_value = active_admins
    session = Mock(spec=Session)

    if allowed:
        users_service.revoke_role(session, 2, AssignableRole.ADMIN)
        repository.remove_role.assert_called_once_with(session, 2, 3)
    else:
        with pytest.raises(AppError) as info:
            users_service.revoke_role(session, 2, AssignableRole.ADMIN)
        assert info.value.code == "last_admin"
        repository.remove_role.assert_not_called()
    assert repository.get_role.call_args.kwargs == {"for_update": True}


@pytest.mark.parametrize(
    "call",
    [
        lambda session: users_service.get_user(session, 2),
        lambda session: users_service.revoke_role(session, 2, AssignableRole.ADMIN),
    ],
    ids=["get", "revoke"],
)
def test_missing_user_raises_not_found(
    repository: Mock, call: Callable[[Session], object]
) -> None:
    repository.get_user.return_value = None

    with pytest.raises(AppError) as info:
        call(Mock(spec=Session))

    assert info.value.code == "user_not_found"
