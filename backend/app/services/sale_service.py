from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Product, ProductVariant, Sale, SaleItem
from ..schemas.sale import SaleCreate
from ..utils.number_generator import generate_number
from .audit_service import create_audit_log


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


async def create_sale(db: AsyncSession, payload: SaleCreate, actor_user_id: int | None = None) -> Sale:
    """
    Creates a sale atomically.

    Standard mode:
    1. Lock each variant row with SELECT FOR UPDATE
    2. Validate stock is sufficient
    3. Deduct stock

    Historical mode:
    - No stock movement
    - Items may be recorded without variant_id (snapshot-only)
    """
    items_data = []

    if payload.is_historical:
        for item in payload.items:
            unit_price = item.unit_price
            if unit_price is None or unit_price <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="unit_price is required and must be positive for historical sales",
                )

            variant = None
            product_name_snapshot = _normalize_text(item.product_name)
            sku_snapshot = _normalize_text(item.variant_sku)

            if item.variant_id is not None:
                result = await db.execute(select(ProductVariant).where(ProductVariant.id == item.variant_id))
                variant = result.scalar_one_or_none()
                if not variant:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Variant {item.variant_id} not found",
                    )

                if not product_name_snapshot:
                    prod_result = await db.execute(select(Product).where(Product.id == variant.product_id))
                    product = prod_result.scalar_one_or_none()
                    product_name_snapshot = product.name if product else None

                if not sku_snapshot:
                    sku_snapshot = _normalize_text(variant.sku)

            if variant is None and not product_name_snapshot:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="product_name is required when variant_id is not provided for historical sales",
                )

            subtotal = unit_price * item.quantity
            items_data.append(
                {
                    "variant_id": variant.id if variant else None,
                    "product_name_snapshot": product_name_snapshot,
                    "sku_snapshot": sku_snapshot,
                    "quantity": item.quantity,
                    "unit_price": unit_price,
                    "subtotal": subtotal,
                }
            )
    else:
        for item in payload.items:
            if item.variant_id is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="variant_id is required for non-historical sales",
                )

            result = await db.execute(
                select(ProductVariant)
                .where(ProductVariant.id == item.variant_id)
                .with_for_update()
            )
            variant = result.scalar_one_or_none()
            if not variant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Variant {item.variant_id} not found",
                )
            if variant.stock_qty < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for variant {item.variant_id}: "
                    f"available {variant.stock_qty}, requested {item.quantity}",
                )

            prod_result = await db.execute(select(Product).where(Product.id == variant.product_id))
            product = prod_result.scalar_one()

            before_qty = variant.stock_qty
            unit_price = product.price
            subtotal = unit_price * item.quantity
            variant.stock_qty -= item.quantity
            after_qty = variant.stock_qty

            items_data.append(
                {
                    "variant_id": variant.id,
                    "product_name_snapshot": product.name,
                    "sku_snapshot": _normalize_text(variant.sku),
                    "quantity": item.quantity,
                    "unit_price": unit_price,
                    "subtotal": subtotal,
                    "before_qty": before_qty,
                    "after_qty": after_qty,
                }
            )

    gross_subtotal = sum((d["subtotal"] for d in items_data), Decimal("0"))
    discount = payload.discount or Decimal("0")
    total = gross_subtotal - discount

    sale_number = await generate_number(db, Sale, "sale_number", "SAL")

    sale = Sale(
        sale_number=sale_number,
        customer_id=payload.customer_id,
        payment_method=payload.payment_method,
        subtotal=gross_subtotal,
        discount=discount,
        total=total,
        notes=payload.notes,
        is_historical=payload.is_historical,
    )
    db.add(sale)
    await db.flush()

    for d in items_data:
        db.add(
            SaleItem(
                sale_id=sale.id,
                variant_id=d["variant_id"],
                product_name_snapshot=d["product_name_snapshot"],
                sku_snapshot=d["sku_snapshot"],
                quantity=d["quantity"],
                unit_price=d["unit_price"],
                subtotal=d["subtotal"],
            )
        )

        if not payload.is_historical and d["variant_id"] is not None:
            await create_audit_log(
                db,
                actor_user_id=actor_user_id,
                action="stock_deduct_sale",
                target_type="product_variant",
                target_id=d["variant_id"],
                description=(
                    f"Sale {sale.sale_number}: qty -{d['quantity']} "
                    f"(before={d['before_qty']}, after={d['after_qty']})"
                ),
            )

    await db.commit()

    result = await db.execute(
        select(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.variant))
        .where(Sale.id == sale.id)
    )
    return result.scalar_one()


async def void_sale(db: AsyncSession, sale_id: int, actor_user_id: int | None = None) -> None:
    """Void a sale. Standard sales restore stock; historical sales are removed without stock changes."""
    result = await db.execute(select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if not sale.is_historical:
        for item in sale.items:
            if item.variant_id is None:
                continue
            var_result = await db.execute(
                select(ProductVariant).where(ProductVariant.id == item.variant_id).with_for_update()
            )
            variant = var_result.scalar_one_or_none()
            if variant:
                before_qty = variant.stock_qty
                variant.stock_qty += item.quantity
                after_qty = variant.stock_qty
                await create_audit_log(
                    db,
                    actor_user_id=actor_user_id,
                    action="stock_restore_void_sale",
                    target_type="product_variant",
                    target_id=variant.id,
                    description=(
                        f"Void sale {sale.sale_number}: qty +{item.quantity} "
                        f"(before={before_qty}, after={after_qty})"
                    ),
                )

    await db.delete(sale)
    await db.commit()
