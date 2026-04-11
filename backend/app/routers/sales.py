from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import ProductVariant, Sale, SaleItem, User
from ..schemas.sale import SaleCreate, SaleListOut, SaleOut
from ..services.sale_service import create_sale, void_sale
from ..utils.deps import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/sales", tags=["Sales"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[SaleListOut])
async def list_sales(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search sale number, customer, product"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Sale)
        .options(
            selectinload(Sale.customer),
            selectinload(Sale.items).selectinload(SaleItem.variant).selectinload(ProductVariant.product),
        )
    )

    if date_from:
        query = query.where(Sale.sold_at >= date_from)
    if date_to:
        query = query.where(Sale.sold_at < date_to + timedelta(days=1))
    if payment_method:
        query = query.where(Sale.payment_method == payment_method)

    query = query.order_by(Sale.sold_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    sales = result.scalars().unique().all()

    rows: list[SaleListOut] = []
    for sale in sales:
        product_names = sorted(
            {
                item.variant.product.name
                for item in sale.items
                if item.variant is not None and getattr(item.variant, "product", None) is not None
            }
            | {
                item.product_name_snapshot
                for item in sale.items
                if item.product_name_snapshot is not None and item.product_name_snapshot.strip()
            }
        )
        rows.append(
            SaleListOut(
                id=sale.id,
                sale_number=sale.sale_number,
                customer_id=sale.customer_id,
                customer_name=sale.customer.name if sale.customer else None,
                product_names=", ".join(product_names) if product_names else "-",
                payment_method=sale.payment_method,
                total=sale.total,
                is_historical=sale.is_historical,
                sold_at=sale.sold_at,
            )
        )

    if q and q.strip():
        needle = q.strip().lower()
        rows = [
            row
            for row in rows
            if needle in row.sale_number.lower()
            or needle in (row.customer_name or "").lower()
            or needle in row.product_names.lower()
        ]

    return rows


@router.post("/", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
async def new_sale(
    payload: SaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_sale(db, payload, actor_user_id=current_user.id)


@router.get("/{sale_id}", response_model=SaleOut)
async def get_sale(sale_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.variant))
        .where(Sale.id == sale_id)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
async def void_sale_endpoint(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    """Void a sale and restore stock for non-historical sales."""
    await void_sale(db, sale_id, actor_user_id=current_user.id)
