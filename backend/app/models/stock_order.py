from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class StockOrder(Base, TimestampMixin):
    __tablename__ = "stock_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending", nullable=False)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_purchase: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_potential_sales: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_profit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    creator: Mapped[User | None] = relationship("User")
    items: Mapped[list[StockOrderItem]] = relationship(
        "StockOrderItem", back_populates="stock_order", cascade="all, delete-orphan"
    )
