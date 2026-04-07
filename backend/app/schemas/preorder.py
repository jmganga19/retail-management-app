from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from .product import VariantOut


class PreOrderItemCreate(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0)


class PreOrderItemOut(BaseModel):
    id: int
    variant_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    variant: VariantOut | None = None

    model_config = {"from_attributes": True}


PreOrderStatus = Literal["pending", "arrived", "collected", "cancelled"]


class PreOrderCreate(BaseModel):
    customer_id: int
    expected_arrival_date: date | None = None
    deposit_amount: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None
    items: list[PreOrderItemCreate] = Field(min_length=1)


class PreOrderStatusUpdate(BaseModel):
    status: PreOrderStatus


class PreOrderDepositUpdate(BaseModel):
    deposit_amount: Decimal = Field(ge=0)


class PreOrderOut(BaseModel):
    id: int
    preorder_number: str
    customer_id: int
    status: str
    expected_arrival_date: date | None
    deposit_amount: Decimal
    total_amount: Decimal
    balance_due: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[PreOrderItemOut] = []

    model_config = {"from_attributes": True}


class PreOrderListOut(BaseModel):
    id: int
    preorder_number: str
    customer_id: int
    customer_name: str | None = None
    product_names: str
    status: str
    total_amount: Decimal
    deposit_amount: Decimal
    balance_due: Decimal
    expected_arrival_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}
