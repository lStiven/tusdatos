from datetime import timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.shared.datetimes import utc_now

_password_hash = PasswordHash.recommended()
_DUMMY_HASH = _password_hash.hash("dummy-password")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(
    password: str, password_hash: str | None
) -> tuple[bool, str | None]:
    """Return (is_valid, new_hash); new_hash is set when the stored hash uses
    outdated parameters and must be saved.

    Without a stored hash (unknown email) it still runs a full verification, so
    the response time does not reveal which emails are registered.
    """
    if password_hash is None:
        _password_hash.verify(password, _DUMMY_HASH)
        return False, None
    return _password_hash.verify_and_update(password, password_hash)


_JWT_ALGORITHM = "HS256"


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = utc_now()
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(
        payload, settings.jwt_secret_key.get_secret_value(), algorithm=_JWT_ALGORITHM
    )


def decode_access_token(token: str) -> int:
    payload = jwt.decode(
        token,
        get_settings().jwt_secret_key.get_secret_value(),
        algorithms=[_JWT_ALGORITHM],
        options={"require": ["sub", "iat", "exp"]},
    )
    return int(payload["sub"])
