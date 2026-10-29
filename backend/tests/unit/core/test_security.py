from collections.abc import Callable
from datetime import datetime, timedelta
from unittest.mock import Mock

import jwt
import pytest
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core import security
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.shared.datetimes import utc_now


@pytest.mark.parametrize(
    "password", ["correct horse battery staple", "contraseña-ñ-🔒"]
)
def test_hash_is_salted_argon2id_and_accepts_only_the_right_password(
    password: str,
) -> None:
    first, second = hash_password(password), hash_password(password)

    assert first.startswith("$argon2id$")
    assert first != second
    assert verify_password(password, first) == (True, None)
    assert verify_password(password + "x", first) == (False, None)


def test_outdated_hash_is_accepted_and_returns_a_current_replacement() -> None:
    weak = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=8192, parallelism=1),))

    valid, new_hash = verify_password("secret", weak.hash("secret"))

    assert valid
    assert new_hash is not None
    assert verify_password("secret", new_hash) == (True, None)


def test_unknown_user_still_runs_a_full_verification(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spy = Mock(wraps=security._password_hash.verify)
    monkeypatch.setattr(security._password_hash, "verify", spy)

    assert verify_password("secret", None) == (False, None)
    spy.assert_called_once()


def _token(
    payload: dict[str, object], key: str | None = None, algorithm: str = "HS256"
) -> str:
    secret = get_settings().jwt_secret_key.get_secret_value()
    return jwt.encode(payload, secret if key is None else key, algorithm=algorithm)


def test_access_token_round_trip() -> None:
    assert decode_access_token(create_access_token(42)) == 42


@pytest.mark.parametrize(
    ("build", "error"),
    [
        (
            lambda now: _token({"sub": "1", "iat": now, "exp": now - timedelta(1)}),
            jwt.ExpiredSignatureError,
        ),
        (
            lambda now: _token(
                {"sub": "1", "iat": now, "exp": now + timedelta(1)}, "y" * 32
            ),
            jwt.InvalidSignatureError,
        ),
        (
            lambda now: _token(
                {"sub": "1", "iat": now, "exp": now + timedelta(1)}, "", "none"
            ),
            jwt.InvalidAlgorithmError,
        ),
        (lambda now: _token({"sub": "1", "iat": now}), jwt.MissingRequiredClaimError),
    ],
    ids=["expired", "wrong-secret", "alg-none", "no-expiry"],
)
def test_rejects_invalid_tokens(
    build: Callable[[datetime], str], error: type[Exception]
) -> None:
    with pytest.raises(error):
        decode_access_token(build(utc_now()))
