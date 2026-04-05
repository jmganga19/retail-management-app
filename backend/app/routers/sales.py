from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Sale, SaleItem
from ..schemas.sale import SaleCreate, SaleListOut, SaleOut
from ..services.sale_service import create_sale, void_sale

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.get("/", response_model=list[SaleListOut])
async def list_sales(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(Sale)
    if date_from:
        q = q.where(Sale.sold_at >= date_from)
    if date_to:
        # Include the full end day
        q = q.where(Sale.sold_at < date_to + timedelta(days=1))
    if payment_method:
        q = q.where(Sale.payment_method == payment_method)
    q = q.order_by(Sale.sold_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
async def new_sale(payload: SaleCreate, db: AsyncSession = Depends(get_db)):
    return await create_sale(db, payload)


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
async def void_sale_endpoint(sale_id: int, db: AsyncSession = Depends(get_db)):
    """Void a sale and restore stock."""
    await void_sale(db, sale_id)
