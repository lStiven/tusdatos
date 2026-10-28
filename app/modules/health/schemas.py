from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok", "error"] = Field(
        description="`ok` when every component works; `error` when any fails.",
        examples=["ok"],
    )
    checks: dict[str, bool] = Field(
        description="Status per component: `true` if it works, `false` if it fails.",
        examples=[{"database": True}],
    )
