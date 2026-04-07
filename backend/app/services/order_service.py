from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Order, OrderItem, ProductVariant, Sale, SaleItem
from ..schemas.order import OrderConvertToSale, OrderCreate
from ..utils.number_generator import generate_number
from .audit_service import create_audit_log

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
        result = await db.execute(select(ProductVariant).where(ProductVariant.id == item.variant_id))
        variant = result.scalar_one_or_none()
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Variant {item.variant_id} not found",
            )
        subtotal = item.unit_price * item.quantity
        items_data.append(
            {
                "variant_id": item.variant_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": subtotal,
            }
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


async def convert_order_to_sale(
    db: AsyncSession,
    order_id: int,
    payload: OrderConvertToSale,
    actor_user_id: int | None = None,
) -> Sale:
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.variant))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only completed orders can be converted to sales",
        )

    if order.sale_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order already converted to sale",
        )

    if not order.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Order has no items to convert",
        )

    locked_items = []
    for item in order.items:
        lock_result = await db.execute(
            select(ProductVariant).where(ProductVariant.id == item.variant_id).with_for_update()
        )
        variant = lock_result.scalar_one_or_none()
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Variant {item.variant_id} not found",
            )
        if variant.stock_qty < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Insufficient stock for variant {item.variant_id}: "
                    f"available {variant.stock_qty}, requested {item.quantity}"
                ),
            )

        before_qty = variant.stock_qty
        variant.stock_qty -= item.quantity
        after_qty = variant.stock_qty
        locked_items.append((item, before_qty, after_qty))

    sale_number = await generate_number(db, Sale, "sale_number", "SAL")

    sale_notes = payload.notes if payload.notes is not None else order.notes
    sale = Sale(
        sale_number=sale_number,
        customer_id=order.customer_id,
        payment_method=payload.payment_method,
        subtotal=order.subtotal,
        discount=order.discount,
        total=order.total,
        notes=sale_notes,
    )
    db.add(sale)
    await db.flush()

    for item, before_qty, after_qty in locked_items:
        db.add(
            SaleItem(
                sale_id=sale.id,
                variant_id=item.variant_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
            )
        )
        await create_audit_log(
            db,
            actor_user_id=actor_user_id,
            action="stock_deduct_order_conversion",
            target_type="product_variant",
            target_id=item.variant_id,
            description=(
                f"Order {order.order_number} -> Sale {sale.sale_number}: qty -{item.quantity} "
                f"(before={before_qty}, after={after_qty})"
            ),
        )

    order.sale_id = sale.id

    await db.commit()

    sale_result = await db.execute(
        select(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.variant))
        .where(Sale.id == sale.id)
    )
    return sale_result.scalar_one()
