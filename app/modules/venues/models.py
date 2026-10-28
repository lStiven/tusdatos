from sqlalchemy import BigInteger, CheckConstraint, Text, UniqueConstraint, text
from sqlmodel import Field

from app.shared.models import TimestampedModel


class Venue(TimestampedModel, table=True):
    __tablename__ = "venues"  # pyright: ignore[reportAssignmentType]

    name: str = Field(max_length=160)
    address: str | None = Field(default=None, sa_type=Text)
    city: str | None = Field(default=None, max_length=120)
    is_active: bool = Field(
        default=True, sa_column_kwargs={"server_default": text("true")}
    )


class Room(TimestampedModel, table=True):
    __tablename__ = "rooms"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint("venue_id", "name"),
        CheckConstraint("capacity > 0", name="capacity_positive"),
    )

    venue_id: int = Field(
        foreign_key="venues.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    name: str = Field(max_length=160)
    capacity: int
    is_active: bool = Field(
        default=True, sa_column_kwargs={"server_default": text("true")}
    )
