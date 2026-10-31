from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

from app.modules.events.models import EventStatus
from app.shared.datetimes import TimeZoneName
from app.shared.schemas import reject_null

MAX_EVENT_CAPACITY = 100_000
MAX_DESCRIPTION_LENGTH = 10_000


class EventCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=200,
        description="Event title",
        examples=["PyCon Colombia"],
    )
    description: str | None = Field(
        default=None,
        max_length=MAX_DESCRIPTION_LENGTH,
        description="Long description",
        examples=["Three days of Python talks."],
    )
    capacity: int = Field(
        gt=0,
        le=MAX_EVENT_CAPACITY,
        description="Seats of the event",
        examples=[500],
    )
    starts_at: AwareDatetime = Field(
        description="Start, with its UTC offset", examples=["2026-11-20T09:00:00-05:00"]
    )
    ends_at: AwareDatetime = Field(
        description="End, after `starts_at`", examples=["2026-11-22T18:00:00-05:00"]
    )
    registration_closes_at: AwareDatetime | None = Field(
        default=None,
        description="Registration deadline, not after `ends_at`; omit to close it at "
        "`starts_at`",
        examples=["2026-11-19T23:59:00-05:00"],
    )
    timezone: TimeZoneName
    venue_id: int | None = Field(
        default=None,
        description="Active venue; may be left empty while planning",
        examples=[7],
    )


class EventUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        description="Event title; cannot be null",
        examples=["PyCon Colombia"],
    )
    description: str | None = Field(
        default=None,
        max_length=MAX_DESCRIPTION_LENGTH,
        description="Long description; `null` clears it",
        examples=["Three days of Python talks."],
    )
    capacity: int | None = Field(
        default=None,
        gt=0,
        le=MAX_EVENT_CAPACITY,
        description="Seats; cannot go below the confirmed registrations",
        examples=[600],
    )
    starts_at: AwareDatetime | None = Field(
        default=None,
        description="Start, with its UTC offset; cannot be null",
        examples=["2026-11-20T09:00:00-05:00"],
    )
    ends_at: AwareDatetime | None = Field(
        default=None,
        description="End; cannot be null",
        examples=["2026-11-22T18:00:00-05:00"],
    )
    registration_closes_at: AwareDatetime | None = Field(
        default=None,
        description="Registration deadline; `null` closes it at `starts_at`",
        examples=["2026-11-19T23:59:00-05:00"],
    )
    timezone: TimeZoneName | None = None
    venue_id: int | None = Field(
        default=None,
        description="Active venue; `null` clears it (drafts only)",
        examples=[7],
    )

    _not_null = field_validator(
        "title", "capacity", "starts_at", "ends_at", "timezone"
    )(reject_null)


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Event id", examples=[42])
    owner_id: int = Field(description="User who owns and edits it", examples=[5])
    venue_id: int | None = Field(
        description="Venue; `null` while still being planned", examples=[7]
    )
    title: str = Field(description="Event title", examples=["PyCon Colombia"])
    description: str | None = Field(
        description="Long description", examples=["Three days of Python talks."]
    )
    capacity: int = Field(description="Seats of the event", examples=[500])
    status: EventStatus = Field(description="Lifecycle status", examples=["PUBLISHED"])
    starts_at: datetime = Field(
        description="Start, in UTC", examples=["2026-11-20T14:00:00Z"]
    )
    ends_at: datetime = Field(
        description="End, in UTC", examples=["2026-11-22T23:00:00Z"]
    )
    registration_closes_at: datetime | None = Field(
        description="Registration deadline, in UTC; `null` closes it at `starts_at`",
        examples=["2026-11-19T23:59:00Z"],
    )
    timezone: str = Field(
        description="IANA time zone to display local times", examples=["America/Bogota"]
    )


class EventSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Event id", examples=[42])
    title: str = Field(description="Event title", examples=["PyCon Colombia"])
    status: EventStatus = Field(description="Event status", examples=["PUBLISHED"])
    starts_at: datetime = Field(
        description="Start, in UTC", examples=["2026-11-20T14:00:00Z"]
    )
    timezone: str = Field(
        description="IANA time zone to display local times", examples=["America/Bogota"]
    )
