from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class StockOrderItemCreate(BaseModel):
    variant_id: int | None = None
    item_name: str | None = None
    category_id: int | None = None
    variant_size: str | None = None
    variant_color: str | None = None
    variant_sku: str | None = None
    quantity: int = Field(gt=0)
    buying_price: Decimal = Field(gt=0)
    selling_price: Decimal = Field(gt=0)

    @model_validator(mode="after")
    def validate_source(self):
        if self.variant_id is None:
            if not (self.item_name and self.item_name.strip()):
                raise ValueError("item_name is required when variant_id is not provided")
            if self.category_id is None:
                raise ValueError("category_id is required when variant_id is not provided")
        return self


class StockOrderCreate(BaseModel):
    notes: str | None = None
    items: list[StockOrderItemCreate] = Field(min_length=1)


class StockOrderUpdate(BaseModel):
    notes: str | None = None
    items: list[StockOrderItemCreate] = Field(min_length=1)


class StockOrderReceivePayload(BaseModel):
    notes: str | None = None


class StockOrderItemOut(BaseModel):
    id: int
    variant_id: int | None
    category_id: int | None
    item_name: str
    variant_size: str | None
    variant_color: str | None
    variant_sku: str | None
    variant_label: str
    quantity: int
    buying_price: Decimal
    selling_price: Decimal
    purchase_amount: Decimal
    total_selling_amount: Decimal
    profit_amount: Decimal


class StockOrderOut(BaseModel):
    id: int
    order_number: str
    notes: str | None
    status: str
    received_at: datetime | None
    total_purchase: Decimal
    total_potential_sales: Decimal
    total_profit: Decimal
    created_at: datetime
    items: list[StockOrderItemOut]
    pricing_warnings: list[str] = Field(default_factory=list)


class StockOrderListOut(BaseModel):
    id: int
    order_number: str
    status: str
    item_count: int
    item_summary: str
    total_purchase: Decimal
    total_potential_sales: Decimal
    total_profit: Decimal
    created_at: datetime
