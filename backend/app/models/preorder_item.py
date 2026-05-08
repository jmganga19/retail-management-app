from __future__ import annotations

from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class PreOrderItem(Base):
    __tablename__ = "preorder_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    preorder_id: Mapped[int] = mapped_column(ForeignKey("preorders.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    preorder: Mapped[PreOrder] = relationship("PreOrder", back_populates="items")
    product: Mapped[Product] = relationship("Product")
