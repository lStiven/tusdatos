from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Identity, func
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, SQLModel

SQLModel.metadata.naming_convention = {
    "pk": "pk_%(table_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
}


class IdModel(SQLModel):
    id: int | None = Field(
        default=None,
        primary_key=True,
        sa_type=BigInteger,
        sa_column_args=[Identity()],
    )


class TimestampedModel(IdModel):
    created_at: datetime | None = Field(
        default=None,
        nullable=False,
        sa_column_kwargs={"server_default": func.now()},
    )
    updated_at: datetime | None = Field(
        default=None,
        nullable=False,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


def str_enum(enum: type[StrEnum], name: str) -> SAEnum:
    return SAEnum(
        enum,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=16,
        values_callable=lambda members: [member.value for member in members],
    )


def id_of(row: IdModel) -> int:
    if row.id is None:
        raise RuntimeError(f"{type(row).__name__} has no id yet: flush first")
    return row.id
