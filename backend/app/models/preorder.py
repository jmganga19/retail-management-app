from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Computed, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class PreOrder(Base, TimestampMixin):
    __tablename__ = "preorders"

    id: Mapped[int] = mapped_column(primary_key=True)
    preorder_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending", nullable=False
    )  # pending | arrived | collected | cancelled
    expected_arrival_date: Mapped[date | None] = mapped_column(Date)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, server_default="0")
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    balance_due: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        Computed("total_amount - deposit_amount", persisted=True),
    )
    notes: Mapped[str | None] = mapped_column(Text)

    customer: Mapped[Customer] = relationship("Customer", back_populates="preorders")
    items: Mapped[list[PreOrderItem]] = relationship(
        "PreOrderItem", back_populates="preorder", cascade="all, delete-orphan"
    )
