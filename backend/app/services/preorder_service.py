from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Category, PreOrder, PreOrderItem, Product
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
        product = None
        if item.product_id is not None:
            result = await db.execute(select(Product).where(Product.id == item.product_id))
            product = result.scalar_one_or_none()
            if not product:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")
            if product.stock_qty >= item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Product '{product.name}' has enough stock ({product.stock_qty}) for requested quantity "
                        f"{item.quantity}. Use Order instead of Pre-order."
                    ),
                )
        else:
            category_exists = await db.scalar(select(Category.id).where(Category.id == item.category_id))
            if category_exists is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Category {item.category_id} not found")
            proposed_name = (item.product_name or "").strip()
            existing_result = await db.execute(select(Product).where(func.lower(Product.name) == proposed_name.lower()))
            existing = existing_result.scalar_one_or_none()
            if existing is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Product name '{proposed_name}' already exists. Select existing product instead.",
                )
            product = Product(
                category_id=int(item.category_id),
                name=proposed_name,
                description="Auto-created from preorder",
                price=item.unit_price,
                image_url=None,
                low_stock_threshold=5,
                is_active=True,
                stock_qty=0,
                current_selling_price=item.unit_price,
            )
            db.add(product)
            await db.flush()

        subtotal = item.unit_price * item.quantity
        items_data.append(
            {"product_id": product.id, "quantity": item.quantity, "unit_price": item.unit_price, "subtotal": subtotal}
        )

    total_amount = sum(d["subtotal"] for d in items_data)
    deposit_amount = payload.deposit_amount or Decimal("0")
    if deposit_amount > total_amount:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Deposit cannot exceed total amount")

    preorder_number = await generate_number(db, PreOrder, "preorder_number", "PRE")
    preorder_data = {
        "preorder_number": preorder_number,
        "customer_id": payload.customer_id,
        "expected_arrival_date": payload.expected_arrival_date,
        "deposit_amount": deposit_amount,
        "total_amount": total_amount,
        "notes": payload.notes,
    }
    if payload.created_at is not None:
        preorder_data["created_at"] = payload.created_at

    preorder = PreOrder(**preorder_data)
    db.add(preorder)
    await db.flush()
    for d in items_data:
        db.add(PreOrderItem(preorder_id=preorder.id, **d))
    await db.commit()

    result = await db.execute(select(PreOrder).options(selectinload(PreOrder.items)).where(PreOrder.id == preorder.id))
    return result.scalar_one()


async def update_preorder_status(db: AsyncSession, preorder_id: int, new_status: str) -> PreOrder:
    result = await db.execute(select(PreOrder).where(PreOrder.id == preorder_id))
    preorder = result.scalar_one_or_none()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")
    allowed = VALID_TRANSITIONS.get(preorder.status, set())
    if new_status not in allowed:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Cannot transition from '{preorder.status}' to '{new_status}'")
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
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Deposit cannot exceed total amount")
    preorder.deposit_amount = deposit_amount
    await db.commit()
    await db.refresh(preorder)
    return preorder
