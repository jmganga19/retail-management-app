from __future__ import annotations

from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class ProductVariant(Base, TimestampMixin):
    __tablename__ = "product_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    size: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(50))
    sku: Mapped[str | None] = mapped_column(String(100), unique=True)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_buying_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    average_buying_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    current_selling_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    product: Mapped[Product] = relationship("Product", back_populates="variants")

