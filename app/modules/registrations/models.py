from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, Index, UniqueConstraint, func, text
from sqlmodel import Field

from app.shared.models import IdModel, TimestampedModel, str_enum


class RegistrationStatus(StrEnum):
    CONFIRMED = "CONFIRMED"
    WAITLISTED = "WAITLISTED"
    CANCELLED = "CANCELLED"


class RegistrationReason(StrEnum):
    """Why a registration changed status; stored in its history (docs/04 §3.3)."""

    REGISTERED = "REGISTERED"
    EVENT_FULL = "EVENT_FULL"
    PROMOTED = "PROMOTED"
    USER_CANCELLED = "USER_CANCELLED"
    EVENT_CANCELLED = "EVENT_CANCELLED"


class EventRegistration(TimestampedModel, table=True):
    __tablename__ = "event_registrations"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint("event_id", "user_id"),
        CheckConstraint(
            "status <> 'WAITLISTED' "
            "OR (waitlist_order IS NOT NULL AND waitlisted_at IS NOT NULL)",
            name="waitlisted_has_order",
        ),
        Index(
            "uq_event_registrations_waitlist_order",
            "event_id",
            "waitlist_order",
            unique=True,
            postgresql_where=text("status = 'WAITLISTED'"),
        ),
        Index(
            "ix_event_registrations_confirmed",
            "event_id",
            postgresql_where=text("status = 'CONFIRMED'"),
        ),
        Index("ix_event_registrations_user_id_status", "user_id", "status", "event_id"),
    )

    event_id: int = Field(
        foreign_key="events.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    user_id: int = Field(
        foreign_key="users.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    status: RegistrationStatus = Field(sa_type=str_enum(RegistrationStatus, "status"))
    waitlist_order: int | None = Field(default=None, sa_type=BigInteger)
    requested_at: datetime | None = Field(
        default=None,
        nullable=False,
        sa_column_kwargs={"server_default": func.now()},
    )
    waitlisted_at: datetime | None = None
    confirmed_at: datetime | None = None
    cancelled_at: datetime | None = None


class RegistrationStatusHistory(IdModel, table=True):
    __tablename__ = "registration_status_history"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        Index(
            "ix_registration_status_history_registration_id",
            "registration_id",
            "created_at",
            "id",
        ),
    )

    registration_id: int = Field(
        foreign_key="event_registrations.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    from_status: RegistrationStatus | None = Field(
        default=None, sa_type=str_enum(RegistrationStatus, "from_status")
    )
    to_status: RegistrationStatus = Field(
        sa_type=str_enum(RegistrationStatus, "to_status")
    )
    reason: str = Field(max_length=80)
    waitlist_order: int | None = Field(default=None, sa_type=BigInteger)
    changed_by: int | None = Field(
        default=None, foreign_key="users.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    created_at: datetime | None = Field(
        default=None,
        nullable=False,
        sa_column_kwargs={"server_default": func.now()},
    )
