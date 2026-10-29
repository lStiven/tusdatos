from collections import defaultdict
from collections.abc import Sequence

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, col, func, select

from app.modules.users.models import Role, RoleCode, User, UserRole


def get_by_email(session: Session, email: str) -> User | None:
    statement = select(User).where(func.lower(User.email) == email.lower())
    return session.exec(statement).first()


def get_user(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def list_users(
    session: Session,
    *,
    email: str | None,
    role: RoleCode | None,
    limit: int,
    offset: int,
) -> tuple[Sequence[User], int]:
    statement = select(User)
    if email:
        statement = statement.where(col(User.email).icontains(email, autoescape=True))
    if role is not None:
        statement = statement.where(
            col(User.id).in_(
                select(UserRole.user_id)
                .join(Role, col(UserRole.role_id) == Role.id)
                .where(Role.code == role)
            )
        )
    total = session.exec(select(func.count()).select_from(statement.subquery())).one()
    page = statement.order_by(col(User.email), col(User.id)).limit(limit).offset(offset)
    return session.exec(page).all(), total


def get_role(session: Session, code: RoleCode, *, for_update: bool = False) -> Role:
    statement = select(Role).where(Role.code == code)
    if for_update:
        statement = statement.with_for_update()
    return session.exec(statement).one()


def get_role_codes(session: Session, user_id: int) -> list[RoleCode]:
    return get_role_codes_by_user(session, [user_id])[user_id]


def get_role_codes_by_user(
    session: Session, user_ids: Sequence[int]
) -> dict[int, list[RoleCode]]:
    statement = (
        select(UserRole.user_id, Role.code)
        .join(Role, col(UserRole.role_id) == Role.id)
        .where(col(UserRole.user_id).in_(user_ids))
        .order_by(col(Role.id))
    )
    codes: dict[int, list[RoleCode]] = defaultdict(list)
    for user_id, code in session.exec(statement).all():
        codes[user_id].append(RoleCode(code))
    return codes


def add_role(session: Session, user_id: int, role_id: int, assigned_by: int) -> None:
    session.exec(
        insert(UserRole)
        .values(user_id=user_id, role_id=role_id, assigned_by=assigned_by)
        .on_conflict_do_nothing()
    )


def remove_role(session: Session, user_id: int, role_id: int) -> None:
    session.exec(
        delete(UserRole).where(
            col(UserRole.user_id) == user_id, col(UserRole.role_id) == role_id
        )
    )


def count_active_with_role(session: Session, role_id: int) -> int:
    statement = (
        select(func.count())
        .select_from(UserRole)
        .join(User, col(UserRole.user_id) == User.id)
        .where(UserRole.role_id == role_id, col(User.is_active).is_(True))
    )
    return session.exec(statement).one()
