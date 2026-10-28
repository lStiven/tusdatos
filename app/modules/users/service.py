from sqlmodel import Session

from app.modules.users import repository as users_repository
from app.modules.users.exceptions import LastAdminError, UserNotFoundError
from app.modules.users.models import RoleCode, User
from app.modules.users.schemas import AssignableRole, UserRead
from app.shared.models import id_of
from app.shared.pagination import PageParams


def get_profile(session: Session, user: User) -> UserRead:
    return _to_read(user, users_repository.get_role_codes(session, id_of(user)))


def list_users(
    session: Session, *, email: str | None, role: RoleCode | None, page: PageParams
) -> tuple[list[UserRead], int]:
    users, total = users_repository.list_users(
        session, email=email, role=role, limit=page.limit, offset=page.offset
    )
    roles = users_repository.get_role_codes_by_user(
        session, [id_of(user) for user in users]
    )
    return [_to_read(user, roles[id_of(user)]) for user in users], total


def get_user(session: Session, user_id: int) -> UserRead:
    return get_profile(session, _get_user(session, user_id))


def grant_role(
    session: Session, actor: User, user_id: int, role: AssignableRole
) -> UserRead:
    user = _get_user(session, user_id)
    granted = users_repository.get_role(session, RoleCode(role))
    users_repository.add_role(session, id_of(user), id_of(granted), id_of(actor))
    session.commit()
    return get_profile(session, user)


def revoke_role(session: Session, user_id: int, role: AssignableRole) -> UserRead:
    user = _get_user(session, user_id)
    revoked = users_repository.get_role(
        session, RoleCode(role), for_update=role == AssignableRole.ADMIN
    )
    if (
        role == AssignableRole.ADMIN
        and user.is_active
        and RoleCode.ADMIN in users_repository.get_role_codes(session, id_of(user))
        and users_repository.count_active_with_role(session, id_of(revoked)) <= 1
    ):
        raise LastAdminError()
    users_repository.remove_role(session, id_of(user), id_of(revoked))
    session.commit()
    return get_profile(session, user)


def _get_user(session: Session, user_id: int) -> User:
    user = users_repository.get_user(session, user_id)
    if user is None:
        raise UserNotFoundError()
    return user


def _to_read(user: User, roles: list[RoleCode]) -> UserRead:
    return UserRead(
        id=id_of(user),
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        roles=roles,
    )
