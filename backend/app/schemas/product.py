from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class VariantBase(BaseModel):
    size: str | None = None
    color: str | None = None
    sku: str | None = None
    stock_qty: int = Field(default=0, ge=0)


class VariantCreate(VariantBase):
    pass


class VariantUpdate(BaseModel):
    size: str | None = None
    color: str | None = None
    sku: str | None = None
    stock_qty: int | None = Field(default=None, ge=0)


class VariantOut(VariantBase):
    id: int
    product_id: int

    model_config = {"from_attributes": True}


class ProductBase(BaseModel):
    name: str
    category_id: int
    description: str | None = None
    price: Decimal = Field(gt=0)
    image_url: str | None = None
    low_stock_threshold: int = Field(default=5, ge=0)


class ProductCreate(ProductBase):
    variants: list[VariantCreate] = []


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
    is_active: bool
    created_at: datetime
    variants: list[VariantOut] = []

    model_config = {"from_attributes": True}


class ProductListOut(ProductBase):
    id: int
    is_active: bool
    created_at: datetime
    total_stock: int = 0

    model_config = {"from_attributes": True}
