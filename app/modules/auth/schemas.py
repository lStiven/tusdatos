from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(description="Login email", examples=["ana@example.com"])
    password: str = Field(
        min_length=8,
        max_length=128,
        description="8 to 128 characters; no composition rules (NIST 800-63B)",
        examples=["correct horse battery staple"],
    )
    full_name: str = Field(
        min_length=1, max_length=200, description="Display name", examples=["Ana Pérez"]
    )


class TokenResponse(BaseModel):
    access_token: str = Field(description="JWT to send as `Authorization: Bearer`")
    token_type: Literal["bearer"] = Field(default="bearer", examples=["bearer"])
    expires_in: int = Field(description="Lifetime in seconds", examples=[1800])
