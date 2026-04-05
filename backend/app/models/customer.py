from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))

    sales: Mapped[list[Sale]] = relationship("Sale", back_populates="customer")
    orders: Mapped[list[Order]] = relationship("Order", back_populates="customer")
    preorders: Mapped[list[PreOrder]] = relationship("PreOrder", back_populates="customer")
