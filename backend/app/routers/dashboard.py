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
    report_month: str
    today_sales_total: Decimal
    today_sales_count: int
    month_live_sales_total: Decimal
    month_live_sales_count: int
    month_historical_sales_total: Decimal
    month_historical_sales_count: int
    month_combined_sales_total: Decimal
    month_combined_sales_count: int
    total_orders_count: int
    pending_preorders_count: int
    low_stock_count: int
    recent_transactions: list[RecentTransaction]
    monthly_sales_trend: list[dict]
    daily_live_sales_current_month: list[dict]
    payment_method_mix_current_month: list[dict]


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    today = date.today()
    month_start = date(today.year, today.month, 1)
    if today.month == 12:
        month_end = date(today.year + 1, 1, 1)
    else:
        month_end = date(today.year, today.month + 1, 1)

    # Today's sales total and count
    sales_result = await db.execute(
        select(
            func.coalesce(func.sum(Sale.total), 0).label("total"),
            func.count(Sale.id).label("count"),
        ).where(
            func.date(Sale.sold_at) == today,
            Sale.is_historical.is_(False),
        )
    )
    sales_row = sales_result.one()
    today_sales_total = Decimal(str(sales_row.total))
    today_sales_count = sales_row.count

    month_live_result = await db.execute(
        select(
            func.coalesce(func.sum(Sale.total), 0).label("total"),
            func.count(Sale.id).label("count"),
        ).where(
            Sale.sold_at >= month_start,
            Sale.sold_at < month_end,
            Sale.is_historical.is_(False),
        )
    )
    month_live_row = month_live_result.one()
    month_live_sales_total = Decimal(str(month_live_row.total))
    month_live_sales_count = month_live_row.count

    month_historical_result = await db.execute(
        select(
            func.coalesce(func.sum(Sale.total), 0).label("total"),
            func.count(Sale.id).label("count"),
        ).where(
            Sale.sold_at >= month_start,
            Sale.sold_at < month_end,
            Sale.is_historical.is_(True),
        )
    )
    month_historical_row = month_historical_result.one()
    month_historical_sales_total = Decimal(str(month_historical_row.total))
    month_historical_sales_count = month_historical_row.count

    month_combined_sales_total = month_live_sales_total + month_historical_sales_total
    month_combined_sales_count = month_live_sales_count + month_historical_sales_count

    monthly_sales_trend: list[dict] = []
    trend_month_start = month_start
    for _ in range(5):
        if trend_month_start.month == 1:
            trend_month_start = date(trend_month_start.year - 1, 12, 1)
        else:
            trend_month_start = date(trend_month_start.year, trend_month_start.month - 1, 1)
    cursor = trend_month_start
    for _ in range(6):
        if cursor.month == 12:
            cursor_end = date(cursor.year + 1, 1, 1)
        else:
            cursor_end = date(cursor.year, cursor.month + 1, 1)

        trend_live_result = await db.execute(
            select(func.coalesce(func.sum(Sale.total), 0)).where(
                Sale.sold_at >= cursor,
                Sale.sold_at < cursor_end,
                Sale.is_historical.is_(False),
            )
        )
        trend_hist_result = await db.execute(
            select(func.coalesce(func.sum(Sale.total), 0)).where(
                Sale.sold_at >= cursor,
                Sale.sold_at < cursor_end,
                Sale.is_historical.is_(True),
            )
        )
        live_total = Decimal(str(trend_live_result.scalar() or 0))
        hist_total = Decimal(str(trend_hist_result.scalar() or 0))
        monthly_sales_trend.append(
            {
                "month": cursor.strftime("%Y-%m"),
                "live_total": live_total,
                "historical_total": hist_total,
                "combined_total": live_total + hist_total,
            }
        )
        cursor = cursor_end

    days_in_month = (month_end - month_start).days
    daily_live_sales_current_month: list[dict] = []
    for day in range(1, days_in_month + 1):
        day_start = date(month_start.year, month_start.month, day)
        if day == days_in_month:
            day_end = month_end
        else:
            day_end = date(month_start.year, month_start.month, day + 1)
        day_total_result = await db.execute(
            select(func.coalesce(func.sum(Sale.total), 0)).where(
                Sale.sold_at >= day_start,
                Sale.sold_at < day_end,
                Sale.is_historical.is_(False),
            )
        )
        day_total = Decimal(str(day_total_result.scalar() or 0))
        daily_live_sales_current_month.append({"day": day, "total": day_total})

    payment_method_mix_current_month: list[dict] = []
    for method in ("cash", "card", "mobile_money"):
        method_result = await db.execute(
            select(
                func.coalesce(func.sum(Sale.total), 0).label("total"),
                func.count(Sale.id).label("count"),
            ).where(
                Sale.sold_at >= month_start,
                Sale.sold_at < month_end,
                Sale.is_historical.is_(False),
                Sale.payment_method == method,
            )
        )
        method_row = method_result.one()
        payment_method_mix_current_month.append(
            {
                "payment_method": method,
                "total": Decimal(str(method_row.total)),
                "count": method_row.count,
            }
        )

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
        .where(Sale.is_historical.is_(False))
        .order_by(Sale.sold_at.desc())
        .limit(10)
    )
    recent_rows = recent_result.mappings().all()
    recent_transactions = [RecentTransaction(**dict(row)) for row in recent_rows]

    return DashboardSummary(
        report_month=month_start.strftime("%Y-%m"),
        today_sales_total=today_sales_total,
        today_sales_count=today_sales_count,
        month_live_sales_total=month_live_sales_total,
        month_live_sales_count=month_live_sales_count,
        month_historical_sales_total=month_historical_sales_total,
        month_historical_sales_count=month_historical_sales_count,
        month_combined_sales_total=month_combined_sales_total,
        month_combined_sales_count=month_combined_sales_count,
        total_orders_count=total_orders_count,
        pending_preorders_count=pending_preorders_count,
        low_stock_count=low_stock_count,
        recent_transactions=recent_transactions,
        monthly_sales_trend=monthly_sales_trend,
        daily_live_sales_current_month=daily_live_sales_current_month,
        payment_method_mix_current_month=payment_method_mix_current_month,
    )
