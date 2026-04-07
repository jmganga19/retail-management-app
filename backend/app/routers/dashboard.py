from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Customer, Order, PreOrder, Product, ProductVariant, Sale
from ..utils.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"], dependencies=[Depends(get_current_user)])


class RecentTransaction(BaseModel):
    id: int
    sale_number: str
    customer_name: str | None
    payment_method: str
    total: Decimal
    sold_at: datetime

    model_config = {"from_attributes": True}


class DashboardSummary(BaseModel):
    today_sales_total: Decimal
    today_sales_count: int
    total_orders_count: int
    pending_preorders_count: int
    low_stock_count: int
    recent_transactions: list[RecentTransaction]


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    today = date.today()

    # Today's sales total and count
    sales_result = await db.execute(
        select(
            func.coalesce(func.sum(Sale.total), 0).label("total"),
            func.count(Sale.id).label("count"),
        ).where(func.date(Sale.sold_at) == today)
    )
    sales_row = sales_result.one()
    today_sales_total = Decimal(str(sales_row.total))
    today_sales_count = sales_row.count

    # Total orders count (all statuses)
    orders_result = await db.execute(select(func.count(Order.id)))
    total_orders_count = orders_result.scalar() or 0

    # Pending pre-orders count
    preorders_result = await db.execute(
        select(func.count(PreOrder.id)).where(PreOrder.status == "pending")
    )
    pending_preorders_count = preorders_result.scalar() or 0

    # Low stock: products with any variant at or below threshold
    low_stock_result = await db.execute(
        select(func.count(func.distinct(ProductVariant.product_id))).where(
            ProductVariant.stock_qty
            <= select(Product.low_stock_threshold)
            .where(Product.id == ProductVariant.product_id)
            .scalar_subquery()
        )
    )
    low_stock_count = low_stock_result.scalar() or 0

    # Last 10 recent transactions joined with customer name
    recent_result = await db.execute(
        select(
            Sale.id,
            Sale.sale_number,
            Customer.name.label("customer_name"),
            Sale.payment_method,
            Sale.total,
            Sale.sold_at,
        )
        .outerjoin(Customer, Sale.customer_id == Customer.id)
        .order_by(Sale.sold_at.desc())
        .limit(10)
    )
    recent_rows = recent_result.mappings().all()
    recent_transactions = [RecentTransaction(**dict(row)) for row in recent_rows]

    return DashboardSummary(
        today_sales_total=today_sales_total,
        today_sales_count=today_sales_count,
        total_orders_count=total_orders_count,
        pending_preorders_count=pending_preorders_count,
        low_stock_count=low_stock_count,
        recent_transactions=recent_transactions,
    )
