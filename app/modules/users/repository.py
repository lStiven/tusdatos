from sqlmodel import Session, col, func, select

from app.modules.users.models import Role, RoleCode, User, UserRole


def get_by_email(session: Session, email: str) -> User | None:
    statement = select(User).where(func.lower(User.email) == email.lower())
    return session.exec(statement).first()


def get_role(session: Session, code: RoleCode) -> Role:
    return session.exec(select(Role).where(Role.code == code)).one()


def get_role_codes(session: Session, user_id: int) -> list[RoleCode]:
    statement = (
        select(Role.code)
        .join(UserRole, col(UserRole.role_id) == Role.id)
        .where(UserRole.user_id == user_id)
    )
    return [RoleCode(code) for code in session.exec(statement).all()]
