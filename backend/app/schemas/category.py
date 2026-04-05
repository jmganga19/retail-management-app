from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CategoryBase(BaseModel):
    name: str
    slug: str
    type: Literal["cosmetics", "clothes", "shoes"]


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    type: Literal["cosmetics", "clothes", "shoes"] | None = None


class CategoryOut(CategoryBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
