from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Product, Sale, SaleItem
from ..schemas.sale import SaleCreate
from ..utils.number_generator import generate_number
from .audit_service import create_audit_log


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


async def _get_product(db: AsyncSession, product_id: int | None, lock_for_update: bool = False) -> Product | None:
    if product_id is None:
        return None
    query = select(Product).where(Product.id == product_id)
    if lock_for_update:
        query = query.with_for_update()
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def create_sale(db: AsyncSession, payload: SaleCreate, actor_user_id: int | None = None) -> Sale:
    items_data = []

    if payload.is_historical:
        for item in payload.items:
            unit_price = item.unit_price
            if unit_price is None or unit_price <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="unit_price is required and must be positive for historical sales",
                )

            product = await _get_product(db, item.product_id, lock_for_update=False)
            product_name_snapshot = _normalize_text(item.product_name) or (product.name if product else None)
            if not product_name_snapshot:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="product_name is required when product_id is not provided for historical sales",
                )

            subtotal = unit_price * item.quantity
            line_discount = item.discount or Decimal("0")
            if line_discount > subtotal:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="item discount cannot exceed line subtotal",
                )
            net_subtotal = subtotal - line_discount
            items_data.append(
                {
                    "product_id": product.id if product else None,
                    "product_name_snapshot": product_name_snapshot,
                    "quantity": item.quantity,
                    "unit_price": unit_price,
                    "subtotal": net_subtotal,
                    "line_discount": line_discount,
                    "gross_subtotal": subtotal,
                }
            )
    else:
        for item in payload.items:
            product = await _get_product(db, item.product_id, lock_for_update=True)
            if product is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="product_id is required for non-historical sales",
                )
            if product.stock_qty < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for product {product.id}: available {product.stock_qty}, requested {item.quantity}",
                )

            before_qty = product.stock_qty
            unit_price = product.price
            subtotal = unit_price * item.quantity
            line_discount = item.discount or Decimal("0")
            if line_discount > subtotal:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="item discount cannot exceed line subtotal",
                )
            net_subtotal = subtotal - line_discount
            product.stock_qty -= item.quantity
            after_qty = product.stock_qty

            items_data.append(
                {
                    "product_id": product.id,
                    "product_name_snapshot": product.name,
                    "quantity": item.quantity,
                    "unit_price": unit_price,
                    "subtotal": net_subtotal,
                    "line_discount": line_discount,
                    "gross_subtotal": subtotal,
                    "before_qty": before_qty,
                    "after_qty": after_qty,
                }
            )

    gross_subtotal = sum((d["gross_subtotal"] for d in items_data), Decimal("0"))
    discount = sum((d["line_discount"] for d in items_data), Decimal("0"))
    total = sum((d["subtotal"] for d in items_data), Decimal("0"))

    sale_number = await generate_number(db, Sale, "sale_number", "SAL")

    sale_kwargs = {
        "sale_number": sale_number,
        "customer_id": payload.customer_id,
        "payment_method": payload.payment_method,
        "subtotal": gross_subtotal,
        "discount": discount,
        "total": total,
        "notes": payload.notes,
        "is_historical": payload.is_historical,
    }
    if payload.is_historical and payload.sold_at is not None:
        sale_kwargs["sold_at"] = payload.sold_at

    sale = Sale(**sale_kwargs)
    db.add(sale)
    await db.flush()

    for d in items_data:
        db.add(
            SaleItem(
                sale_id=sale.id,
                product_id=d["product_id"],
                product_name_snapshot=d["product_name_snapshot"],
                sku_snapshot=None,
                quantity=d["quantity"],
                unit_price=d["unit_price"],
                subtotal=d["subtotal"],
            )
        )

        if not payload.is_historical and d["product_id"] is not None:
            await create_audit_log(
                db,
                actor_user_id=actor_user_id,
                action="stock_deduct_sale",
                target_type="product",
                target_id=d["product_id"],
                description=(
                    f"Sale {sale.sale_number}: qty -{d['quantity']} "
                    f"(before={d['before_qty']}, after={d['after_qty']})"
                ),
            )

    await db.commit()

    result = await db.execute(select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale.id))
    return result.scalar_one()


async def void_sale(db: AsyncSession, sale_id: int, actor_user_id: int | None = None) -> None:
    result = await db.execute(select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if not sale.is_historical:
        for item in sale.items:
            if item.product_id is None:
                continue
            prod_result = await db.execute(select(Product).where(Product.id == item.product_id).with_for_update())
            product = prod_result.scalar_one_or_none()
            if product:
                before_qty = product.stock_qty
                product.stock_qty += item.quantity
                after_qty = product.stock_qty
                await create_audit_log(
                    db,
                    actor_user_id=actor_user_id,
                    action="stock_restore_void_sale",
                    target_type="product",
                    target_id=product.id,
                    description=(
                        f"Void sale {sale.sale_number}: qty +{item.quantity} "
                        f"(before={before_qty}, after={after_qty})"
                    ),
                )

    await db.delete(sale)
    await db.commit()
