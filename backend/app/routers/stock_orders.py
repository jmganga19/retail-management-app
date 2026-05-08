from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Category, Product, StockOrder, StockOrderItem, StockReceiptBatch, SystemSetting, User
from ..schemas.stock_order import (
    StockOrderCreate,
    StockOrderItemCreate,
    StockOrderItemOut,
    StockOrderListOut,
    StockOrderOut,
    StockOrderReceivePayload,
    StockOrderUpdate,
)
from ..services.audit_service import create_audit_log
from ..utils.deps import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/stock-orders", tags=["Stock Orders"], dependencies=[Depends(get_current_user)])


def _order_number() -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = uuid4().hex[:4].upper()
    return f"STK-{ts}-{suffix}"


def _to_item_out(item: StockOrderItem) -> StockOrderItemOut:
    return StockOrderItemOut(
        id=item.id,
        product_id=item.product_id,
        category_id=item.category_id,
        item_name=item.item_name,
        quantity=item.quantity,
        buying_price=item.buying_price,
        selling_price=item.selling_price,
        purchase_amount=item.purchase_amount,
        total_selling_amount=item.total_selling_amount,
        profit_amount=item.profit_amount,
    )


def _to_out(stock_order: StockOrder, pricing_warnings: list[str] | None = None) -> StockOrderOut:
    return StockOrderOut(
        id=stock_order.id,
        order_number=stock_order.order_number,
        notes=stock_order.notes,
        status=stock_order.status,
        received_at=stock_order.received_at,
        total_purchase=stock_order.total_purchase,
        total_potential_sales=stock_order.total_potential_sales,
        total_profit=stock_order.total_profit,
        created_at=stock_order.created_at,
        items=[_to_item_out(item) for item in stock_order.items],
        pricing_warnings=pricing_warnings or [],
    )


async def _load_pricing_config(db: AsyncSession) -> tuple[str, Decimal]:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key.in_(["pricing_update_policy", "low_margin_warning_percent"]))
    )
    rows = {row.key: row.value for row in result.scalars().all()}
    policy = (rows.get("pricing_update_policy") or "manual").strip().lower()
    if policy not in {"manual", "latest_received"}:
        policy = "manual"
    try:
        low_margin = Decimal(rows.get("low_margin_warning_percent") or "10")
    except Exception:
        low_margin = Decimal("10")
    return policy, low_margin


async def _resolve_payload_items(db: AsyncSession, payload_items: list[StockOrderItemCreate]):
    product_ids = [i.product_id for i in payload_items if i.product_id is not None]
    products: dict[int, Product] = {}
    if product_ids:
        product_result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
        products = {p.id: p for p in product_result.scalars().all()}
        missing_products = [pid for pid in product_ids if pid not in products]
        if missing_products:
            raise HTTPException(status_code=404, detail=f"Product(s) not found: {', '.join(map(str, missing_products))}")

    item_dicts: list[dict] = []
    total_purchase = Decimal("0")
    total_potential_sales = Decimal("0")
    total_profit = Decimal("0")
    for row in payload_items:
        product = products.get(row.product_id) if row.product_id is not None else None
        item_name = product.name if product is not None else (row.item_name or "").strip()
        category_id = product.category_id if product is not None else row.category_id
        purchase_amount = row.buying_price * row.quantity
        total_selling_amount = row.selling_price * row.quantity
        profit_amount = total_selling_amount - purchase_amount
        total_purchase += purchase_amount
        total_potential_sales += total_selling_amount
        total_profit += profit_amount
        item_dicts.append(
            {
                "product_id": product.id if product is not None else None,
                "category_id": category_id,
                "item_name": item_name,
                "quantity": row.quantity,
                "buying_price": row.buying_price,
                "selling_price": row.selling_price,
                "purchase_amount": purchase_amount,
                "total_selling_amount": total_selling_amount,
                "profit_amount": profit_amount,
            }
        )
    return item_dicts, total_purchase, total_potential_sales, total_profit


@router.get("/", response_model=list[StockOrderListOut])
async def list_stock_orders(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(StockOrder).options(selectinload(StockOrder.items)).order_by(StockOrder.created_at.desc()).offset(skip).limit(limit)
    if status_filter:
        query = query.where(StockOrder.status == status_filter)
    result = await db.execute(query)
    orders = result.scalars().unique().all()
    rows: list[StockOrderListOut] = []
    for so in orders:
        names = sorted({item.item_name for item in so.items if item.item_name})
        rows.append(
            StockOrderListOut(
                id=so.id,
                order_number=so.order_number,
                status=so.status,
                item_count=len(so.items),
                item_summary=", ".join(names) if names else "-",
                total_purchase=so.total_purchase,
                total_potential_sales=so.total_potential_sales,
                total_profit=so.total_profit,
                created_at=so.created_at,
            )
        )
    if q and q.strip():
        needle = q.strip().lower()
        rows = [r for r in rows if needle in r.order_number.lower() or needle in r.item_summary.lower()]
    return rows


@router.get("/{stock_order_id}", response_model=StockOrderOut)
async def get_stock_order(stock_order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StockOrder).options(selectinload(StockOrder.items)).where(StockOrder.id == stock_order_id))
    stock_order = result.scalar_one_or_none()
    if not stock_order:
        raise HTTPException(status_code=404, detail="Stock order not found")
    return _to_out(stock_order)


@router.post("/", response_model=StockOrderOut, status_code=status.HTTP_201_CREATED)
async def create_stock_order(
    payload: StockOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    item_dicts, total_purchase, total_potential_sales, total_profit = await _resolve_payload_items(db, payload.items)
    stock_order_data = {
        "order_number": _order_number(),
        "notes": payload.notes,
        "created_by_user_id": current_user.id,
        "status": "pending",
        "received_at": None,
        "total_purchase": total_purchase,
        "total_potential_sales": total_potential_sales,
        "total_profit": total_profit,
    }
    if payload.created_at is not None:
        stock_order_data["created_at"] = payload.created_at
    stock_order = StockOrder(**stock_order_data)
    db.add(stock_order)
    await db.flush()
    for item in item_dicts:
        db.add(StockOrderItem(stock_order_id=stock_order.id, **item))
    await db.commit()
    refreshed = await db.execute(select(StockOrder).options(selectinload(StockOrder.items)).where(StockOrder.id == stock_order.id))
    return _to_out(refreshed.scalar_one())


@router.put("/{stock_order_id}", response_model=StockOrderOut)
async def update_stock_order(
    stock_order_id: int,
    payload: StockOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(select(StockOrder).options(selectinload(StockOrder.items)).where(StockOrder.id == stock_order_id))
    stock_order = result.scalar_one_or_none()
    if not stock_order:
        raise HTTPException(status_code=404, detail="Stock order not found")
    if stock_order.status == "received":
        raise HTTPException(status_code=400, detail="Received stock orders cannot be edited")
    item_dicts, total_purchase, total_potential_sales, total_profit = await _resolve_payload_items(db, payload.items)
    stock_order.notes = payload.notes
    stock_order.total_purchase = total_purchase
    stock_order.total_potential_sales = total_potential_sales
    stock_order.total_profit = total_profit
    await db.execute(delete(StockOrderItem).where(StockOrderItem.stock_order_id == stock_order.id))
    await db.flush()
    for item in item_dicts:
        db.add(StockOrderItem(stock_order_id=stock_order.id, **item))
    await create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="update_stock_order",
        target_type="stock_order",
        target_id=stock_order.id,
        description=f"Updated stock order {stock_order.order_number}",
    )
    await db.commit()
    refreshed = await db.execute(select(StockOrder).options(selectinload(StockOrder.items)).where(StockOrder.id == stock_order.id))
    return _to_out(refreshed.scalar_one())


@router.post("/{stock_order_id}/receive", response_model=StockOrderOut)
async def receive_stock_order(
    stock_order_id: int,
    payload: StockOrderReceivePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(select(StockOrder).options(selectinload(StockOrder.items)).where(StockOrder.id == stock_order_id))
    stock_order = result.scalar_one_or_none()
    if not stock_order:
        raise HTTPException(status_code=404, detail="Stock order not found")
    if stock_order.status == "received":
        raise HTTPException(status_code=400, detail="Stock order already received")

    pricing_policy, low_margin_warning_percent = await _load_pricing_config(db)
    warnings: list[str] = []
    received_at = datetime.now()

    for item in stock_order.items:
        product = await db.get(Product, item.product_id) if item.product_id else None
        if product is None:
            if item.category_id is None:
                raise HTTPException(status_code=400, detail=f"Category is required for new item '{item.item_name}'")
            category_exists = await db.scalar(select(Category.id).where(Category.id == item.category_id))
            if category_exists is None:
                raise HTTPException(status_code=404, detail=f"Category not found for item '{item.item_name}'")
            product = Product(
                category_id=item.category_id,
                name=item.item_name,
                description=f"Auto-created from stock order {stock_order.order_number}",
                price=item.selling_price,
                image_url=None,
                low_stock_threshold=5,
                is_active=True,
                stock_qty=0,
                current_selling_price=item.selling_price,
            )
            db.add(product)
            await db.flush()
            item.product_id = product.id

        before_qty = int(product.stock_qty)
        incoming_qty = int(item.quantity)
        product.stock_qty = before_qty + incoming_qty

        buying_price = Decimal(item.buying_price)
        previous_avg = Decimal(product.average_buying_price) if product.average_buying_price is not None else None
        if before_qty > 0 and previous_avg is not None:
            computed_avg = ((previous_avg * before_qty) + (buying_price * incoming_qty)) / Decimal(before_qty + incoming_qty)
        else:
            computed_avg = buying_price
        product.last_buying_price = buying_price
        product.average_buying_price = computed_avg.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        applied_selling_price: Decimal | None = None
        if pricing_policy == "latest_received":
            product.current_selling_price = Decimal(item.selling_price)
            product.price = Decimal(item.selling_price)
            applied_selling_price = Decimal(item.selling_price)
        elif product.current_selling_price is None:
            product.current_selling_price = product.price

        margin_percent: Decimal | None = None
        if buying_price > 0:
            margin_percent = (((Decimal(item.selling_price) - buying_price) / buying_price) * Decimal("100")).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
            if margin_percent < low_margin_warning_percent:
                warnings.append(f"{item.item_name}: margin {margin_percent}% is below warning threshold {low_margin_warning_percent}%")

        db.add(
            StockReceiptBatch(
                product_id=product.id,
                stock_order_id=stock_order.id,
                stock_order_item_id=item.id,
                quantity=incoming_qty,
                buying_price=buying_price,
                suggested_selling_price=Decimal(item.selling_price),
                applied_selling_price=applied_selling_price,
                margin_percent=margin_percent,
                received_at=received_at,
            )
        )
        await create_audit_log(
            db,
            actor_user_id=current_user.id,
            action="stock_receive_order",
            target_type="product",
            target_id=product.id,
            description=(
                f"Stock received via {stock_order.order_number}: +{item.quantity} "
                f"(before={before_qty}, after={product.stock_qty}, policy={pricing_policy})"
            ),
        )

    stock_order.status = "received"
    stock_order.received_at = received_at
    if payload.notes and payload.notes.strip():
        extra = payload.notes.strip()
        stock_order.notes = f"{stock_order.notes}\n{extra}" if stock_order.notes else extra
    await db.commit()
    refreshed = await db.execute(select(StockOrder).options(selectinload(StockOrder.items)).where(StockOrder.id == stock_order.id))
    return _to_out(refreshed.scalar_one(), pricing_warnings=warnings)

