from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class StockReceiptBatch(Base, TimestampMixin):
    __tablename__ = "stock_receipt_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    stock_order_id: Mapped[int | None] = mapped_column(ForeignKey("stock_orders.id", ondelete="SET NULL"), nullable=True)
    stock_order_item_id: Mapped[int | None] = mapped_column(ForeignKey("stock_order_items.id", ondelete="SET NULL"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    buying_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    suggested_selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    applied_selling_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    margin_percent: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    variant: Mapped[ProductVariant] = relationship("ProductVariant")
