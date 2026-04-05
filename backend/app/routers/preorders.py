from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import PreOrder, PreOrderItem
from ..schemas.preorder import (
    PreOrderCreate,
    PreOrderDepositUpdate,
    PreOrderListOut,
    PreOrderOut,
    PreOrderStatusUpdate,
)
from ..services.preorder_service import (
    create_preorder,
    update_deposit,
    update_preorder_status,
)

router = APIRouter(prefix="/preorders", tags=["Pre-orders"])


@router.get("/", response_model=list[PreOrderListOut])
async def list_preorders(
    preorder_status: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(PreOrder)
    if preorder_status:
        q = q.where(PreOrder.status == preorder_status)
    q = q.order_by(PreOrder.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=PreOrderOut, status_code=status.HTTP_201_CREATED)
async def new_preorder(payload: PreOrderCreate, db: AsyncSession = Depends(get_db)):
    return await create_preorder(db, payload)


@router.get("/{preorder_id}", response_model=PreOrderOut)
async def get_preorder(preorder_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PreOrder)
        .options(selectinload(PreOrder.items).selectinload(PreOrderItem.variant))
        .where(PreOrder.id == preorder_id)
    )
    preorder = result.scalar_one_or_none()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")
    return preorder


@router.patch("/{preorder_id}/status", response_model=PreOrderOut)
async def change_preorder_status(
    preorder_id: int, payload: PreOrderStatusUpdate, db: AsyncSession = Depends(get_db)
):
    preorder = await update_preorder_status(db, preorder_id, payload.status)
    result = await db.execute(
        select(PreOrder)
        .options(selectinload(PreOrder.items).selectinload(PreOrderItem.variant))
        .where(PreOrder.id == preorder.id)
    )
    return result.scalar_one()


@router.patch("/{preorder_id}/deposit", response_model=PreOrderOut)
async def change_deposit(
    preorder_id: int, payload: PreOrderDepositUpdate, db: AsyncSession = Depends(get_db)
):
    preorder = await update_deposit(db, preorder_id, payload.deposit_amount)
    result = await db.execute(
        select(PreOrder)
        .options(selectinload(PreOrder.items).selectinload(PreOrderItem.variant))
        .where(PreOrder.id == preorder.id)
    )
    return result.scalar_one()


@router.delete("/{preorder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_preorder(preorder_id: int, db: AsyncSession = Depends(get_db)):
    await update_preorder_status(db, preorder_id, "cancelled")
