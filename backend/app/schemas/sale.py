from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from .product import VariantOut


class SaleItemCreate(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0)


class SaleItemOut(BaseModel):
    id: int
    variant_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    variant: VariantOut | None = None

    model_config = {"from_attributes": True}


class SaleCreate(BaseModel):
    customer_id: int | None = None
    payment_method: Literal["cash", "card", "mobile_money"]
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None
    items: list[SaleItemCreate] = Field(min_length=1)


class SaleOut(BaseModel):
    id: int
    sale_number: str
    customer_id: int | None
    payment_method: str
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    notes: str | None
    sold_at: datetime
    items: list[SaleItemOut] = []

    model_config = {"from_attributes": True}


class SaleListOut(BaseModel):
    id: int
    sale_number: str
    customer_id: int | None
    payment_method: str
    total: Decimal
    sold_at: datetime

    model_config = {"from_attributes": True}
