from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Product, ProductVariant, Sale, SaleItem
from ..schemas.sale import SaleCreate
from ..utils.number_generator import generate_number


async def create_sale(db: AsyncSession, payload: SaleCreate) -> Sale:
    """
    Creates a sale atomically:
    1. Lock each variant row with SELECT FOR UPDATE
    2. Validate stock is sufficient
    3. Deduct stock
    4. Compute totals
    5. Insert Sale + SaleItems in one transaction
    """
    items_data = []

    for item in payload.items:
        # Row-level lock to prevent race conditions / overselling
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

        # Load the product to get the current price
        prod_result = await db.execute(
            select(Product).where(Product.id == variant.product_id)
        )
        product = prod_result.scalar_one()

        unit_price = product.price
        subtotal = unit_price * item.quantity
        variant.stock_qty -= item.quantity
        items_data.append(
            {"variant": variant, "quantity": item.quantity, "unit_price": unit_price, "subtotal": subtotal}
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
    await db.flush()  # get sale.id

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

    await db.commit()

    # Reload with items eagerly
    result = await db.execute(
        select(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.variant))
        .where(Sale.id == sale.id)
    )
    return result.scalar_one()


async def void_sale(db: AsyncSession, sale_id: int) -> None:
    """Void a sale: restore all variant stock quantities."""
    result = await db.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    for item in sale.items:
        var_result = await db.execute(
            select(ProductVariant).where(ProductVariant.id == item.variant_id).with_for_update()
        )
        variant = var_result.scalar_one_or_none()
        if variant:
            variant.stock_qty += item.quantity

    await db.delete(sale)
    await db.commit()
