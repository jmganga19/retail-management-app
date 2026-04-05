from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import PreOrder, PreOrderItem, ProductVariant
from ..schemas.preorder import PreOrderCreate
from ..utils.number_generator import generate_number

VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"arrived", "cancelled"},
    "arrived": {"collected", "cancelled"},
    "collected": set(),
    "cancelled": set(),
}


async def create_preorder(db: AsyncSession, payload: PreOrderCreate) -> PreOrder:
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

    total_amount = sum(d["subtotal"] for d in items_data)
    deposit_amount = payload.deposit_amount or Decimal("0")

    if deposit_amount > total_amount:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Deposit cannot exceed total amount",
        )

    preorder_number = await generate_number(db, PreOrder, "preorder_number", "PRE")

    preorder = PreOrder(
        preorder_number=preorder_number,
        customer_id=payload.customer_id,
        expected_arrival_date=payload.expected_arrival_date,
        deposit_amount=deposit_amount,
        total_amount=total_amount,
        notes=payload.notes,
    )
    db.add(preorder)
    await db.flush()

    for d in items_data:
        db.add(PreOrderItem(preorder_id=preorder.id, **d))

    await db.commit()

    result = await db.execute(
        select(PreOrder)
        .options(selectinload(PreOrder.items).selectinload(PreOrderItem.variant))
        .where(PreOrder.id == preorder.id)
    )
    return result.scalar_one()


async def update_preorder_status(db: AsyncSession, preorder_id: int, new_status: str) -> PreOrder:
    result = await db.execute(select(PreOrder).where(PreOrder.id == preorder_id))
    preorder = result.scalar_one_or_none()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    allowed = VALID_TRANSITIONS.get(preorder.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{preorder.status}' to '{new_status}'",
        )

    preorder.status = new_status
    await db.commit()
    await db.refresh(preorder)
    return preorder


async def update_deposit(db: AsyncSession, preorder_id: int, deposit_amount: Decimal) -> PreOrder:
    result = await db.execute(select(PreOrder).where(PreOrder.id == preorder_id))
    preorder = result.scalar_one_or_none()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    if deposit_amount > preorder.total_amount:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Deposit cannot exceed total amount",
        )

    preorder.deposit_amount = deposit_amount
    await db.commit()
    await db.refresh(preorder)
    return preorder
