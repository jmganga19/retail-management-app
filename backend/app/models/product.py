from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    low_stock_threshold: Mapped[int] = mapped_column(default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    category: Mapped[Category] = relationship("Category", back_populates="products")
    variants: Mapped[list[ProductVariant]] = relationship(
        "ProductVariant", back_populates="product", cascade="all, delete-orphan"
    )
