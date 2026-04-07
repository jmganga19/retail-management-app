from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Order, OrderItem, ProductVariant, User
from ..schemas.order import OrderConvertToSale, OrderCreate, OrderListOut, OrderOut, OrderStatusUpdate
from ..schemas.sale import SaleOut
from ..services.order_service import convert_order_to_sale, create_order, update_order_status
from ..utils.deps import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/orders", tags=["Orders"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[OrderListOut])
async def list_orders(
    order_status: str | None = Query(default=None, alias="status"),
    customer_id: int | None = Query(default=None),
    q: str | None = Query(default=None, description="Search order number, customer, product"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.items).selectinload(OrderItem.variant).selectinload(ProductVariant.product),
        )
    )
    if order_status:
        query = query.where(Order.status == order_status)
    if customer_id:
        query = query.where(Order.customer_id == customer_id)

    query = query.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    orders = result.scalars().unique().all()

    rows: list[OrderListOut] = []
    for order in orders:
        product_names = sorted(
            {
                item.variant.product.name
                for item in order.items
                if item.variant is not None and getattr(item.variant, "product", None) is not None
            }
        )
        rows.append(
            OrderListOut(
                id=order.id,
                order_number=order.order_number,
                customer_id=order.customer_id,
                customer_name=order.customer.name if order.customer else None,
                product_names=", ".join(product_names) if product_names else "-",
                sale_id=order.sale_id,
                status=order.status,
                total=order.total,
                created_at=order.created_at,
            )
        )

    if q and q.strip():
        needle = q.strip().lower()
        rows = [
            row
            for row in rows
            if needle in row.order_number.lower()
            or needle in (row.customer_name or "").lower()
            or needle in row.product_names.lower()
        ]

    return rows


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
    order_id: int,
    payload: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    order = await update_order_status(db, order_id, payload.status)
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.variant))
        .where(Order.id == order.id)
    )
    return result.scalar_one()


@router.post("/{order_id}/convert-to-sale", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
async def convert_to_sale(
    order_id: int,
    payload: OrderConvertToSale,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    return await convert_order_to_sale(db, order_id, payload, actor_user_id=current_user.id)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    await update_order_status(db, order_id, "cancelled")
