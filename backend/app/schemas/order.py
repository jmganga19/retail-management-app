from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from .product import VariantOut


class OrderItemCreate(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0)


class OrderItemOut(BaseModel):
    id: int
    variant_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    variant: VariantOut | None = None

    model_config = {"from_attributes": True}


OrderStatus = Literal["pending", "confirmed", "processing", "completed", "cancelled"]


class OrderCreate(BaseModel):
    customer_id: int
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderOut(BaseModel):
    id: int
    order_number: str
    customer_id: int
    status: str
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut] = []

    model_config = {"from_attributes": True}


class OrderListOut(BaseModel):
    id: int
    order_number: str
    customer_id: int
    status: str
    total: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}
