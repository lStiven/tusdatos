from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.shared.schemas import reject_null

MAX_BIO_LENGTH = 5_000


class SpeakerCreate(BaseModel):
    full_name: str = Field(
        min_length=1,
        max_length=200,
        description="Name shown in the agenda",
        examples=["Ada Lovelace"],
    )
    email: EmailStr | None = Field(
        default=None,
        max_length=320,
        description="Contact email; not linked to any user account",
        examples=["ada@example.com"],
    )
    bio: str | None = Field(
        default=None,
        max_length=MAX_BIO_LENGTH,
        description="Short profile",
        examples=["Mathematician and first programmer."],
    )


class SpeakerUpdate(BaseModel):
    full_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        description="Name shown in the agenda; cannot be null",
        examples=["Ada Lovelace"],
    )
    email: EmailStr | None = Field(
        default=None,
        max_length=320,
        description="Contact email; `null` clears it",
        examples=["ada@example.com"],
    )
    bio: str | None = Field(
        default=None,
        max_length=MAX_BIO_LENGTH,
        description="Short profile; `null` clears it",
        examples=["Mathematician and first programmer."],
    )

    _not_null = field_validator("full_name")(reject_null)


class SpeakerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Speaker id", examples=[3])
    full_name: str = Field(
        description="Name shown in the agenda", examples=["Ada Lovelace"]
    )
    email: str | None = Field(description="Contact email", examples=["ada@example.com"])
    bio: str | None = Field(
        description="Short profile", examples=["Mathematician and first programmer."]
    )
