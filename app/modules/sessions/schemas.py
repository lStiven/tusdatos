from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

from app.modules.events.schemas import MAX_DESCRIPTION_LENGTH, MAX_EVENT_CAPACITY
from app.modules.sessions.models import SessionStatus
from app.shared.schemas import reject_null

MAX_SPEAKERS = 20


class SessionCreate(BaseModel):
    title: str = Field(
        min_length=1, max_length=200, description="Talk title", examples=["Async SQL"]
    )
    description: str | None = Field(
        default=None,
        max_length=MAX_DESCRIPTION_LENGTH,
        description="What the talk is about",
        examples=["Connection pools and locks in practice."],
    )
    capacity: int = Field(
        gt=0,
        le=MAX_EVENT_CAPACITY,
        description="Expected seats; to schedule, at most the room capacity",
        examples=[80],
    )
    starts_at: AwareDatetime = Field(
        description="Start, within the event", examples=["2026-11-20T10:00:00-05:00"]
    )
    ends_at: AwareDatetime = Field(
        description="End, after `starts_at` and within the event",
        examples=["2026-11-20T11:00:00-05:00"],
    )
    room_id: int | None = Field(
        default=None,
        description="Room of the event's venue; required to schedule",
        examples=[12],
    )
    speaker_ids: list[int] = Field(
        default_factory=list,
        max_length=MAX_SPEAKERS,
        description="Speakers of the talk; duplicates are ignored",
        examples=[[3, 5]],
    )


class SessionUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        description="Talk title; cannot be null",
        examples=["Async SQL"],
    )
    description: str | None = Field(
        default=None,
        max_length=MAX_DESCRIPTION_LENGTH,
        description="What the talk is about; `null` clears it",
        examples=["Connection pools and locks in practice."],
    )
    capacity: int | None = Field(
        default=None,
        gt=0,
        le=MAX_EVENT_CAPACITY,
        description="Expected seats; cannot be null",
        examples=[80],
    )
    starts_at: AwareDatetime | None = Field(
        default=None,
        description="Start, within the event; cannot be null",
        examples=["2026-11-20T10:00:00-05:00"],
    )
    ends_at: AwareDatetime | None = Field(
        default=None,
        description="End, within the event; cannot be null",
        examples=["2026-11-20T11:00:00-05:00"],
    )
    room_id: int | None = Field(
        default=None,
        description="Room of the event's venue; `null` clears it (drafts only)",
        examples=[12],
    )
    speaker_ids: list[int] | None = Field(
        default=None,
        max_length=MAX_SPEAKERS,
        description="Replaces all the speakers; `[]` removes them, null is rejected",
        examples=[[3, 5]],
    )

    _not_null = field_validator(
        "title", "capacity", "starts_at", "ends_at", "speaker_ids"
    )(reject_null)


class RoomSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Room id", examples=[12])
    name: str = Field(description="Room name", examples=["Auditorium A"])
    capacity: int = Field(description="Physical seats of the room", examples=[120])


class SpeakerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Speaker id", examples=[3])
    full_name: str = Field(description="Speaker name", examples=["Ada Lovelace"])


class SessionRead(BaseModel):
    id: int = Field(description="Session id", examples=[57])
    event_id: int = Field(description="Event the session belongs to", examples=[42])
    title: str = Field(description="Talk title", examples=["Async SQL"])
    description: str | None = Field(
        description="What the talk is about",
        examples=["Connection pools and locks in practice."],
    )
    capacity: int = Field(description="Expected seats", examples=[80])
    status: SessionStatus = Field(description="Session status")
    starts_at: datetime = Field(
        description="Start (UTC)", examples=["2026-11-20T15:00:00Z"]
    )
    ends_at: datetime = Field(
        description="End (UTC)", examples=["2026-11-20T16:00:00Z"]
    )
    room: RoomSummary | None = Field(description="Assigned room, if any")
    speakers: list[SpeakerSummary] = Field(description="Speakers, ordered by name")
    interested: int = Field(
        description="Attendees with active interest; an estimate, not reserved seats",
        examples=[96],
    )
    interest_percent: float = Field(
        description="`interested` over `capacity`, in percent; may exceed 100",
        examples=[120.0],
    )
    overdemand: bool = Field(
        description="Whether `interested` exceeds `capacity`", examples=[True]
    )
    is_interested: bool = Field(
        description="Whether the current user has marked interest", examples=[False]
    )
