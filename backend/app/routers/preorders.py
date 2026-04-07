from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import PreOrder, PreOrderItem, ProductVariant, User
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
from ..utils.deps import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/preorders", tags=["Pre-orders"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[PreOrderListOut])
async def list_preorders(
    preorder_status: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, description="Search pre-order number, customer, product"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PreOrder)
        .options(
            selectinload(PreOrder.customer),
            selectinload(PreOrder.items).selectinload(PreOrderItem.variant).selectinload(ProductVariant.product),
        )
    )
    if preorder_status:
        query = query.where(PreOrder.status == preorder_status)
    query = query.order_by(PreOrder.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    preorders = result.scalars().unique().all()

    rows: list[PreOrderListOut] = []
    for preorder in preorders:
        product_names = sorted(
            {
                item.variant.product.name
                for item in preorder.items
                if item.variant is not None and getattr(item.variant, "product", None) is not None
            }
        )
        rows.append(
            PreOrderListOut(
                id=preorder.id,
                preorder_number=preorder.preorder_number,
                customer_id=preorder.customer_id,
                customer_name=preorder.customer.name if preorder.customer else None,
                product_names=", ".join(product_names) if product_names else "-",
                status=preorder.status,
                total_amount=preorder.total_amount,
                deposit_amount=preorder.deposit_amount,
                balance_due=preorder.balance_due,
                expected_arrival_date=preorder.expected_arrival_date,
                created_at=preorder.created_at,
            )
        )

    if q and q.strip():
        needle = q.strip().lower()
        rows = [
            row
            for row in rows
            if needle in row.preorder_number.lower()
            or needle in (row.customer_name or "").lower()
            or needle in row.product_names.lower()
        ]

    return rows


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
    preorder_id: int,
    payload: PreOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
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
    preorder_id: int,
    payload: PreOrderDepositUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    preorder = await update_deposit(db, preorder_id, payload.deposit_amount)
    result = await db.execute(
        select(PreOrder)
        .options(selectinload(PreOrder.items).selectinload(PreOrderItem.variant))
        .where(PreOrder.id == preorder.id)
    )
    return result.scalar_one()


@router.delete("/{preorder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_preorder(
    preorder_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    await update_preorder_status(db, preorder_id, "cancelled")
