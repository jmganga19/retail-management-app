from __future__ import annotations

from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class StockOrderItem(Base):
    __tablename__ = "stock_order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_order_id: Mapped[int] = mapped_column(ForeignKey("stock_orders.id", ondelete="CASCADE"), nullable=False)
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("product_variants.id"), nullable=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    variant_size: Mapped[str | None] = mapped_column(String(50))
    variant_color: Mapped[str | None] = mapped_column(String(50))
    variant_sku: Mapped[str | None] = mapped_column(String(100))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    buying_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    purchase_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_selling_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    profit_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    stock_order: Mapped[StockOrder] = relationship("StockOrder", back_populates="items")
    variant: Mapped[ProductVariant | None] = relationship("ProductVariant")
