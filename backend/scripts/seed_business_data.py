import asyncio
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models import Customer, Order, PreOrder, ProductVariant, Sale
from app.schemas.order import OrderCreate
from app.schemas.preorder import PreOrderCreate
from app.schemas.sale import SaleCreate
from app.services.order_service import create_order, update_order_status
from app.services.preorder_service import create_preorder, update_preorder_status
from app.services.sale_service import create_sale

SEED_MARKER = "[seed-v1]"
TARGET_SALES = 10
TARGET_ORDERS = 10
TARGET_PREORDERS = 10

CUSTOMERS = [
    {"name": "Amina Hassan", "phone": "+255712000101", "email": "amina.hassan@example.com"},
    {"name": "John Mushi", "phone": "+255712000102", "email": "john.mushi@example.com"},
    {"name": "Neema Joseph", "phone": "+255712000103", "email": "neema.joseph@example.com"},
    {"name": "Kelvin Peter", "phone": "+255712000104", "email": "kelvin.peter@example.com"},
    {"name": "Rehema Ally", "phone": "+255712000105", "email": "rehema.ally@example.com"},
    {"name": "David Nyerere", "phone": "+255712000106", "email": "david.nyerere@example.com"},
    {"name": "Mariam Issa", "phone": "+255712000107", "email": "mariam.issa@example.com"},
    {"name": "Frank Mrema", "phone": "+255712000108", "email": "frank.mrema@example.com"},
    {"name": "Wema Komba", "phone": "+255712000109", "email": "wema.komba@example.com"},
    {"name": "Irene Chuwa", "phone": "+255712000110", "email": "irene.chuwa@example.com"},
    {"name": "Brian Lema", "phone": "+255712000111", "email": "brian.lema@example.com"},
    {"name": "Happy Mollel", "phone": "+255712000112", "email": "happy.mollel@example.com"},
]


async def ensure_customers(session) -> tuple[int, list[Customer]]:
    created = 0
    phones = [c["phone"] for c in CUSTOMERS]

    for item in CUSTOMERS:
        existing = await session.execute(select(Customer).where(Customer.phone == item["phone"]))
        if existing.scalar_one_or_none():
            continue
        session.add(Customer(**item))
        created += 1

    await session.commit()

    result = await session.execute(select(Customer).where(Customer.phone.in_(phones)).order_by(Customer.id))
    return created, list(result.scalars().all())


async def list_variants(session) -> list[ProductVariant]:
    result = await session.execute(
        select(ProductVariant)
        .options(selectinload(ProductVariant.product))
        .where(ProductVariant.stock_qty > 0)
        .order_by(ProductVariant.id)
    )
    variants = list(result.scalars().all())
    if not variants:
        raise RuntimeError("No product variants with stock found. Seed products first.")
    return variants


async def count_seeded_sales(session) -> int:
    result = await session.execute(
        select(func.count(Sale.id)).where(Sale.notes.like(f"{SEED_MARKER} sale%"))
    )
    return int(result.scalar_one() or 0)


async def count_seeded_orders(session) -> int:
    result = await session.execute(
        select(func.count(Order.id)).where(Order.notes.like(f"{SEED_MARKER} order%"))
    )
    return int(result.scalar_one() or 0)


async def count_seeded_preorders(session) -> int:
    result = await session.execute(
        select(func.count(PreOrder.id)).where(PreOrder.notes.like(f"{SEED_MARKER} preorder%"))
    )
    return int(result.scalar_one() or 0)


async def seed_sales(session, customers: list[Customer]) -> int:
    existing = await count_seeded_sales(session)
    to_create = max(0, TARGET_SALES - existing)
    created = 0
    payment_methods = ["cash", "card", "mobile_money"]

    for i in range(to_create):
        variants = await list_variants(session)
        if not variants:
            break
        variant = variants[i % len(variants)]
        customer = customers[i % len(customers)] if customers else None

        payload = SaleCreate(
            customer_id=customer.id if customer else None,
            payment_method=payment_methods[i % len(payment_methods)],
            discount=Decimal("0"),
            notes=f"{SEED_MARKER} sale {i + 1}",
            items=[{"variant_id": variant.id, "quantity": 1}],
        )
        await create_sale(session, payload)
        created += 1

    return created


async def seed_orders(session, customers: list[Customer]) -> int:
    existing = await count_seeded_orders(session)
    to_create = max(0, TARGET_ORDERS - existing)
    created = 0
    statuses = ["pending", "confirmed", "processing", "completed"]

    variants = await list_variants(session)
    if not variants:
        return 0

    for i in range(to_create):
        variant = variants[i % len(variants)]
        customer = customers[i % len(customers)]
        unit_price = Decimal(str(variant.product.price))

        payload = OrderCreate(
            customer_id=customer.id,
            discount=Decimal("0"),
            notes=f"{SEED_MARKER} order {i + 1}",
            items=[{"variant_id": variant.id, "quantity": 1, "unit_price": unit_price}],
        )
        order = await create_order(session, payload)

        target_status = statuses[i % len(statuses)]
        if target_status in {"confirmed", "processing", "completed"}:
            order = await update_order_status(session, order.id, "confirmed")
        if target_status in {"processing", "completed"}:
            order = await update_order_status(session, order.id, "processing")
        if target_status == "completed":
            await update_order_status(session, order.id, "completed")

        created += 1

    return created


async def seed_preorders(session, customers: list[Customer]) -> int:
    existing = await count_seeded_preorders(session)
    to_create = max(0, TARGET_PREORDERS - existing)
    created = 0
    statuses = ["pending", "arrived", "collected"]

    variants = await list_variants(session)
    if not variants:
        return 0

    for i in range(to_create):
        variant = variants[i % len(variants)]
        customer = customers[(i + 3) % len(customers)]
        unit_price = Decimal(str(variant.product.price))
        deposit = (unit_price * Decimal("0.30")).quantize(Decimal("0.01"))

        payload = PreOrderCreate(
            customer_id=customer.id,
            expected_arrival_date=date.today() + timedelta(days=3 + i),
            deposit_amount=deposit,
            notes=f"{SEED_MARKER} preorder {i + 1}",
            items=[{"variant_id": variant.id, "quantity": 1, "unit_price": unit_price}],
        )
        preorder = await create_preorder(session, payload)

        target_status = statuses[i % len(statuses)]
        if target_status in {"arrived", "collected"}:
            preorder = await update_preorder_status(session, preorder.id, "arrived")
        if target_status == "collected":
            await update_preorder_status(session, preorder.id, "collected")

        created += 1

    return created


async def main() -> None:
    async with AsyncSessionLocal() as session:
        customers_created, customers = await ensure_customers(session)
        if not customers:
            raise RuntimeError("No customers available for seeding.")

        sales_created = await seed_sales(session, customers)
        orders_created = await seed_orders(session, customers)
        preorders_created = await seed_preorders(session, customers)

    print(
        "Business seed complete: "
        f"customers_created={customers_created}, "
        f"sales_created={sales_created}, "
        f"orders_created={orders_created}, "
        f"preorders_created={preorders_created}"
    )


if __name__ == "__main__":
    asyncio.run(main())
