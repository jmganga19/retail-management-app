from datetime import datetime

from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    name: str
    slug: str
    type: str = Field(min_length=1, max_length=50)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    type: str | None = Field(default=None, min_length=1, max_length=50)


class CategoryOut(CategoryBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
