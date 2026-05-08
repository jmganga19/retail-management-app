from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    name: str
    category_id: int
    description: str | None = None
    price: Decimal = Field(gt=0)
    image_url: str | None = None
    low_stock_threshold: int = Field(default=5, ge=0)


class ProductCreate(ProductBase):
    created_at: datetime | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    description: str | None = None
    price: Decimal | None = Field(default=None, gt=0)
    image_url: str | None = None
    low_stock_threshold: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductOut(ProductBase):
    id: int
    stock_qty: int = 0
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductListOut(ProductBase):
    id: int
    is_active: bool
    created_at: datetime
    total_stock: int = 0

    model_config = {"from_attributes": True}
