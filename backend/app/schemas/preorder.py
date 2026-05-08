from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PreOrderItemCreate(BaseModel):
    product_id: int | None = None
    product_name: str | None = None
    category_id: int | None = None
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0)

    @model_validator(mode="after")
    def validate_product_source(self):
        if self.product_id is None:
            if not (self.product_name and self.product_name.strip()):
                raise ValueError("product_name is required when product_id is not provided")
            if self.category_id is None:
                raise ValueError("category_id is required when product_id is not provided")
        return self


class PreOrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal

    model_config = {"from_attributes": True}


PreOrderStatus = Literal["pending", "arrived", "collected", "cancelled"]


class PreOrderCreate(BaseModel):
    customer_id: int
    expected_arrival_date: date | None = None
    deposit_amount: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None
    created_at: datetime | None = None
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
