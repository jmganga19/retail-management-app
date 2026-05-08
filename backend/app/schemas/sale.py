from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class SaleItemCreate(BaseModel):
    product_id: int | None = None
    quantity: int = Field(gt=0)
    unit_price: Decimal | None = Field(default=None, gt=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    product_name: str | None = None


class SaleItemOut(BaseModel):
    id: int
    product_id: int | None
    product_name_snapshot: str | None = None
    sku_snapshot: str | None = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal

    model_config = {"from_attributes": True}


class SaleCreate(BaseModel):
    customer_id: int | None = None
    payment_method: Literal["cash", "card", "mobile_money"]
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None
    is_historical: bool = False
    sold_at: datetime | None = None
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
    is_historical: bool
    sold_at: datetime
    items: list[SaleItemOut] = []

    model_config = {"from_attributes": True}


class SaleListOut(BaseModel):
    id: int
    sale_number: str
    customer_id: int | None
    customer_name: str | None = None
    product_names: str
    payment_method: str
    total: Decimal
    is_historical: bool
    sold_at: datetime

    model_config = {"from_attributes": True}
