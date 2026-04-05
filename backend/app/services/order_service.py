from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Order, OrderItem, ProductVariant
from ..schemas.order import OrderCreate
from ..utils.number_generator import generate_number

VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"processing", "cancelled"},
    "processing": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


async def create_order(db: AsyncSession, payload: OrderCreate) -> Order:
    items_data = []

    for item in payload.items:
        result = await db.execute(
            select(ProductVariant).where(ProductVariant.id == item.variant_id)
        )
        variant = result.scalar_one_or_none()
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Variant {item.variant_id} not found",
            )
        subtotal = item.unit_price * item.quantity
        items_data.append(
            {"variant_id": item.variant_id, "quantity": item.quantity,
             "unit_price": item.unit_price, "subtotal": subtotal}
        )

    gross_subtotal = sum(d["subtotal"] for d in items_data)
    discount = payload.discount or Decimal("0")
    total = gross_subtotal - discount

    order_number = await generate_number(db, Order, "order_number", "ORD")

    order = Order(
        order_number=order_number,
        customer_id=payload.customer_id,
        subtotal=gross_subtotal,
        discount=discount,
        total=total,
        notes=payload.notes,
    )
    db.add(order)
    await db.flush()

    for d in items_data:
        db.add(OrderItem(order_id=order.id, **d))

    await db.commit()

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.variant))
        .where(Order.id == order.id)
    )
    return result.scalar_one()


async def update_order_status(db: AsyncSession, order_id: int, new_status: str) -> Order:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed = VALID_TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{order.status}' to '{new_status}'",
        )

    order.status = new_status
    await db.commit()
    await db.refresh(order)
    return order
