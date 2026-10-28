from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.shared.schemas import reject_null

MAX_ROOM_CAPACITY = 100_000


class VenueCreate(BaseModel):
    name: str = Field(
        min_length=1, max_length=160, description="Venue name", examples=["Ágora"]
    )
    address: str | None = Field(
        default=None, max_length=300, description="Street address", examples=["Cra 7"]
    )
    city: str | None = Field(
        default=None, max_length=120, description="City", examples=["Bogotá"]
    )


class VenueUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=160,
        description="Venue name; cannot be null",
        examples=["Ágora"],
    )
    address: str | None = Field(
        default=None,
        max_length=300,
        description="Street address; `null` clears it",
        examples=["Cra 7"],
    )
    city: str | None = Field(
        default=None,
        max_length=120,
        description="City; `null` clears it",
        examples=["Bogotá"],
    )
    is_active: bool | None = Field(
        default=None,
        description="`false` takes the venue out of scheduling; cannot be null",
        examples=[False],
    )

    _not_null = field_validator("name", "is_active")(reject_null)


class VenueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Venue id", examples=[7])
    name: str = Field(description="Venue name", examples=["Ágora"])
    address: str | None = Field(description="Street address", examples=["Cra 7"])
    city: str | None = Field(description="City", examples=["Bogotá"])
    is_active: bool = Field(description="Whether it accepts new scheduling")


class RoomCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=160,
        description="Unique within the venue",
        examples=["A1"],
    )
    capacity: int = Field(
        gt=0,
        le=MAX_ROOM_CAPACITY,
        description="Physical seats in the room",
        examples=[120],
    )


class RoomUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=160,
        description="Unique within the venue",
        examples=["A1"],
    )
    capacity: int | None = Field(
        default=None,
        gt=0,
        le=MAX_ROOM_CAPACITY,
        description="Physical seats; cannot go below an upcoming scheduled session",
        examples=[120],
    )
    is_active: bool | None = Field(
        default=None,
        description="`false` takes the room out of scheduling",
        examples=[False],
    )

    _not_null = field_validator("name", "capacity", "is_active")(reject_null)


class RoomRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Room id", examples=[12])
    venue_id: int = Field(description="Venue the room belongs to", examples=[7])
    name: str = Field(description="Unique within the venue", examples=["A1"])
    capacity: int = Field(description="Physical seats in the room", examples=[120])
    is_active: bool = Field(description="Whether it accepts new scheduling")
