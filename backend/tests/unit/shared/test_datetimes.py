import pytest
from pydantic import TypeAdapter, ValidationError

from app.shared.datetimes import TimeZoneName

time_zone_name = TypeAdapter(TimeZoneName)


@pytest.mark.parametrize("name", ["America/Bogota", "UTC"])
def test_time_zone_name_accepts_iana_names(name: str) -> None:
    assert time_zone_name.validate_python(name) == name


@pytest.mark.parametrize("name", ["America/Atlantis", "../../etc/passwd", ""])
def test_time_zone_name_rejects_unknown_or_unsafe_names(name: str) -> None:
    with pytest.raises(ValidationError, match="Unknown IANA time zone"):
        time_zone_name.validate_python(name)
