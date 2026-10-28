from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Index,
    Text,
    UniqueConstraint,
    column,
    func,
    literal,
    text,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlmodel import Field, SQLModel

from app.shared.models import TimestampedModel, str_enum


class SessionStatus(StrEnum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    CANCELLED = "CANCELLED"


class EventSession(TimestampedModel, table=True):
    __tablename__ = "sessions"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        CheckConstraint("capacity > 0", name="capacity_positive"),
        CheckConstraint("starts_at < ends_at", name="valid_interval"),
        CheckConstraint(
            "status <> 'SCHEDULED' OR room_id IS NOT NULL",
            name="scheduled_has_room",
        ),
        ExcludeConstraint(
            (column("room_id"), "="),
            (
                func.tstzrange(column("starts_at"), column("ends_at"), literal("[)")),
                "&&",
            ),
            name="ex_sessions_room_schedule",
            using="gist",
            where=text("status = 'SCHEDULED'"),
        ),
        Index("ix_sessions_event_id_starts_at", "event_id", "starts_at"),
    )

    event_id: int = Field(
        foreign_key="events.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    room_id: int | None = Field(
        default=None, foreign_key="rooms.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    title: str = Field(max_length=200)
    description: str | None = Field(default=None, sa_type=Text)
    capacity: int
    status: SessionStatus = Field(
        default=SessionStatus.DRAFT, sa_type=str_enum(SessionStatus, "status")
    )
    starts_at: datetime
    ends_at: datetime


class SessionSpeaker(SQLModel, table=True):
    __tablename__ = "session_speakers"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        Index("ix_session_speakers_speaker_id", "speaker_id", "session_id"),
    )

    session_id: int = Field(
        primary_key=True,
        foreign_key="sessions.id",
        ondelete="RESTRICT",
        sa_type=BigInteger,
    )
    speaker_id: int = Field(
        primary_key=True,
        foreign_key="speakers.id",
        ondelete="RESTRICT",
        sa_type=BigInteger,
    )


class SessionInterest(TimestampedModel, table=True):
    __tablename__ = "session_interests"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint("user_id", "session_id"),
        Index(
            "ix_session_interests_active",
            "session_id",
            postgresql_where=text("withdrawn_at IS NULL"),
        ),
    )

    user_id: int = Field(
        foreign_key="users.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    session_id: int = Field(
        foreign_key="sessions.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    expressed_at: datetime | None = Field(
        default=None,
        nullable=False,
        sa_column_kwargs={"server_default": func.now()},
    )
    withdrawn_at: datetime | None = None
