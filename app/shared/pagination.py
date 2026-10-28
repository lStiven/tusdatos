from typing import Annotated

from fastapi import Query
from pydantic import BaseModel, Field


class PageParams(BaseModel):
    limit: int = Field(
        default=50, ge=1, le=100, description="Maximum number of items to return"
    )
    offset: int = Field(default=0, ge=0, description="Number of items to skip")


PageParamsDep = Annotated[PageParams, Query()]


class Page[T](BaseModel):
    items: list[T] = Field(description="Items of the requested page")
    total: int = Field(description="Items matching the filters", examples=[42])
    limit: int = Field(description="Requested page size", examples=[50])
    offset: int = Field(description="Requested offset", examples=[0])
