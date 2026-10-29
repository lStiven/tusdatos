from datetime import UTC, datetime
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


def _validate_time_zone(name: str) -> str:
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"Unknown IANA time zone: {name}") from exc
    return name


TimeZoneName = Annotated[
    str,
    AfterValidator(_validate_time_zone),
    Field(
        max_length=64,
        description="IANA time zone name",
        examples=["America/Bogota"],
    ),
]
