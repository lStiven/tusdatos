from enum import StrEnum

from pydantic import BaseModel, Field

from app.modules.users.models import RoleCode


class AssignableRole(StrEnum):
    ORGANIZER = RoleCode.ORGANIZER.value
    ADMIN = RoleCode.ADMIN.value


class UserRead(BaseModel):
    id: int = Field(description="User id", examples=[42])
    email: str = Field(
        description="Login email, lowercase", examples=["ana@example.com"]
    )
    full_name: str = Field(description="Display name", examples=["Ana Pérez"])
    is_active: bool = Field(description="Whether the account can log in")
    roles: list[RoleCode] = Field(
        description="Roles granted to the user", examples=[["ATTENDEE"]]
    )
