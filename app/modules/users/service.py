from sqlmodel import Session

from app.modules.users import repository as users_repository
from app.modules.users.models import User
from app.modules.users.schemas import UserRead
from app.shared.models import id_of


def get_profile(session: Session, user: User) -> UserRead:
    return UserRead(
        id=id_of(user),
        email=user.email,
        full_name=user.full_name,
        roles=users_repository.get_role_codes(session, id_of(user)),
    )
