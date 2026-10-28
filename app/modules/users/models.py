from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Index, Text, column, func, text
from sqlmodel import Field, SQLModel

from app.shared.models import IdModel, TimestampedModel


class RoleCode(StrEnum):
    ATTENDEE = "ATTENDEE"
    ORGANIZER = "ORGANIZER"
    ADMIN = "ADMIN"


class User(TimestampedModel, table=True):
    __tablename__ = "users"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        Index("uq_users_email_ci", func.lower(column("email")), unique=True),
    )

    email: str = Field(max_length=320)
    password_hash: str = Field(sa_type=Text)
    full_name: str = Field(max_length=200)
    is_active: bool = Field(
        default=True, sa_column_kwargs={"server_default": text("true")}
    )


class Role(IdModel, table=True):
    __tablename__ = "roles"  # pyright: ignore[reportAssignmentType]

    code: str = Field(max_length=32, unique=True)
    description: str | None = Field(default=None, max_length=200)


class UserRole(SQLModel, table=True):
    __tablename__ = "user_roles"  # pyright: ignore[reportAssignmentType]

    user_id: int = Field(
        primary_key=True,
        foreign_key="users.id",
        ondelete="RESTRICT",
        sa_type=BigInteger,
    )
    role_id: int = Field(
        primary_key=True,
        foreign_key="roles.id",
        ondelete="RESTRICT",
        sa_type=BigInteger,
    )
    assigned_by: int | None = Field(
        default=None, foreign_key="users.id", ondelete="RESTRICT", sa_type=BigInteger
    )
    assigned_at: datetime | None = Field(
        default=None,
        nullable=False,
        sa_column_kwargs={"server_default": func.now()},
    )
