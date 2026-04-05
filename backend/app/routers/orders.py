from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Order, OrderItem
from ..schemas.order import OrderCreate, OrderListOut, OrderOut, OrderStatusUpdate
from ..services.order_service import create_order, update_order_status

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/", response_model=list[OrderListOut])
async def list_orders(
    order_status: str | None = Query(default=None, alias="status"),
    customer_id: int | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(Order)
    if order_status:
        q = q.where(Order.status == order_status)
    if customer_id:
        q = q.where(Order.customer_id == customer_id)
    q = q.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def new_order(payload: OrderCreate, db: AsyncSession = Depends(get_db)):
    return await create_order(db, payload)


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.variant))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/status", response_model=OrderOut)
async def change_order_status(
    order_id: int, payload: OrderStatusUpdate, db: AsyncSession = Depends(get_db)
):
    order = await update_order_status(db, order_id, payload.status)
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.variant))
        .where(Order.id == order.id)
    )
    return result.scalar_one()


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_order(order_id: int, db: AsyncSession = Depends(get_db)):
    await update_order_status(db, order_id, "cancelled")
