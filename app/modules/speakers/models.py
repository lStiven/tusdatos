from sqlalchemy import Text
from sqlmodel import Field

from app.shared.models import TimestampedModel


class Speaker(TimestampedModel, table=True):
    __tablename__ = "speakers"  # pyright: ignore[reportAssignmentType]

    full_name: str = Field(max_length=200)
    email: str | None = Field(default=None, max_length=320)
    bio: str | None = Field(default=None, sa_type=Text)
