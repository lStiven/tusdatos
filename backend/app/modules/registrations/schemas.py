from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.events.schemas import EventSummary
from app.modules.registrations.models import RegistrationStatus
from app.modules.users.schemas import UserSummary


class RegistrationBase(BaseModel):
    id: int = Field(description="Registration id", examples=[81])
    event_id: int = Field(description="Event", examples=[42])
    status: RegistrationStatus = Field(
        description="`CONFIRMED` holds a seat; `WAITLISTED` does not",
        examples=["WAITLISTED"],
    )
    waitlist_position: int | None = Field(
        description="1-based place in the queue right now; only when `WAITLISTED`. "
        "It moves as people ahead cancel or get promoted",
        examples=[3],
    )
    requested_at: datetime = Field(
        description="Latest request; renewed when re-registering",
        examples=["2026-11-01T15:04:05Z"],
    )
    confirmed_at: datetime | None = Field(
        description="Latest confirmation", examples=["2026-11-02T09:00:00Z"]
    )
    cancelled_at: datetime | None = Field(
        description="Latest cancellation", examples=[None]
    )


class RegistrationRead(RegistrationBase):
    event: EventSummary = Field(
        description="Event of the registration. Its `status` is the event's, "
        "not the registration's",
        examples=[
            {
                "id": 42,
                "title": "PyCon Colombia",
                "status": "PUBLISHED",
                "starts_at": "2026-11-20T14:00:00Z",
                "timezone": "America/Bogota",
            }
        ],
    )


class EventRegistrationRead(RegistrationBase):
    user: UserSummary = Field(description="Who registered")


class Occupancy(BaseModel):
    event_id: int = Field(description="Event", examples=[42])
    capacity: int = Field(description="Seats of the event", examples=[500])
    confirmed: int = Field(description="Confirmed registrations", examples=[480])
    available: int = Field(
        description="Seats left: `capacity - confirmed`", examples=[20]
    )
    waitlisted: int = Field(description="People in the waitlist", examples=[0])
    occupancy_percent: float = Field(
        description="`confirmed / capacity * 100`, one decimal", examples=[96.0]
    )
