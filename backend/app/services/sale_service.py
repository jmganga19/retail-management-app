from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Product, ProductVariant, Sale, SaleItem
from ..schemas.sale import SaleCreate
from ..utils.number_generator import generate_number
from .audit_service import create_audit_log


async def create_sale(db: AsyncSession, payload: SaleCreate, actor_user_id: int | None = None) -> Sale:
    """
    Creates a sale atomically:
    1. Lock each variant row with SELECT FOR UPDATE
    2. Validate stock is sufficient
    3. Deduct stock
    4. Compute totals
    5. Insert Sale + SaleItems + stock audit logs in one transaction
    """
    items_data = []

    for item in payload.items:
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
                "variant": variant,
                "quantity": item.quantity,
                "unit_price": unit_price,
                "subtotal": subtotal,
                "before_qty": before_qty,
                "after_qty": after_qty,
            }
        )

    gross_subtotal = sum(d["subtotal"] for d in items_data)
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
    )
    db.add(sale)
    await db.flush()

    for d in items_data:
        db.add(
            SaleItem(
                sale_id=sale.id,
                variant_id=d["variant"].id,
                quantity=d["quantity"],
                unit_price=d["unit_price"],
                subtotal=d["subtotal"],
            )
        )
        await create_audit_log(
            db,
            actor_user_id=actor_user_id,
            action="stock_deduct_sale",
            target_type="product_variant",
            target_id=d["variant"].id,
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
    """Void a sale: restore all variant stock quantities and log stock restoration."""
    result = await db.execute(select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    for item in sale.items:
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
