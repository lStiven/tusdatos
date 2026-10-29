from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, Index, Text, text
from sqlmodel import Field

from app.shared.models import TimestampedModel, str_enum


class EventStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class Event(TimestampedModel, table=True):
    __tablename__ = "events"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        CheckConstraint("capacity > 0", name="capacity_positive"),
        CheckConstraint("starts_at < ends_at", name="valid_interval"),
        CheckConstraint("next_waitlist_order > 0", name="next_waitlist_order_positive"),
        Index(
            "ix_events_title_trgm",
            "title",
            postgresql_using="gin",
            postgresql_ops={"title": "gin_trgm_ops"},
        ),
        Index("ix_events_status_starts_at", "status", "starts_at", "id"),
        Index("ix_events_owner_id_starts_at", "owner_id", "starts_at"),
    )

    owner_id: int = Field(
        foreign_key="users.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    venue_id: int | None = Field(
        default=None, foreign_key="venues.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    title: str = Field(max_length=200)
    description: str | None = Field(default=None, sa_type=Text)
    capacity: int
    next_waitlist_order: int = Field(
        default=1, sa_type=BigInteger, sa_column_kwargs={"server_default": text("1")}
    )
    status: EventStatus = Field(
        default=EventStatus.DRAFT, sa_type=str_enum(EventStatus, "status")
    )
    starts_at: datetime
    ends_at: datetime
    registration_closes_at: datetime | None = None
    timezone: str = Field(max_length=64)
