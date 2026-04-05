from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"))
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)  # cash | card | mobile_money
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, server_default="0")
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    sold_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    customer: Mapped[Customer | None] = relationship("Customer", back_populates="sales")
    items: Mapped[list[SaleItem]] = relationship(
        "SaleItem", back_populates="sale", cascade="all, delete-orphan"
    )
