from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth.schemas import RegisterRequest, TokenResponse
from app.modules.users import repository as users_repository
from app.modules.users.models import RoleCode, User, UserRole
from app.shared.exceptions import ConflictError, UnauthorizedError, violated_constraint
from app.shared.models import id_of


def normalize_email(email: str) -> str:
    return email.strip().lower()


def register(session: Session, request: RegisterRequest) -> User:
    user = User(
        email=normalize_email(request.email),
        password_hash=hash_password(request.password),
        full_name=request.full_name,
    )
    session.add(user)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        if violated_constraint(exc) == "uq_users_email_ci":
            raise ConflictError("Email already exists", code="email_taken") from exc
        raise
    attendee = users_repository.get_role(session, code=RoleCode.ATTENDEE)
    session.add(UserRole(user_id=id_of(user), role_id=id_of(attendee)))
    session.commit()
    return user


def authenticate(session: Session, email: str, password: str) -> User:
    user = users_repository.get_by_email(session, email=email)
    valid, new_hash = verify_password(password, user.password_hash if user else None)
    if user is None or not valid or not user.is_active:
        raise UnauthorizedError("Invalid email or password", code="invalid_credentials")
    if new_hash is not None:
        user.password_hash = new_hash
        session.commit()
    return user


def issue_token(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user_id=id_of(user)),
        expires_in=get_settings().access_token_expire_minutes * 60,
    )
