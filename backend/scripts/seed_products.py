import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Category, Product, ProductVariant


SAMPLE_PRODUCTS = [
    {"name": "Cucci Oud", "category": "Perfumes", "type": "cosmetics", "price_tzs": 85000, "stock": 20},
    {"name": "Guess 4 MEN", "category": "Perfumes", "type": "cosmetics", "price_tzs": 185000, "stock": 34},
    {"name": "Club de nuit", "category": "Perfumes", "type": "cosmetics", "price_tzs": 150000, "stock": 45},
    {"name": "Club de nuit woman", "category": "Perfumes", "type": "cosmetics", "price_tzs": 150000, "stock": 24},
    {"name": "Sara Jes", "category": "Perfumes", "type": "cosmetics", "price_tzs": 150000, "stock": 14},
    {"name": "Gucci Intense Oud", "category": "Perfumes", "type": "cosmetics", "price_tzs": 345000, "stock": 6},
    {"name": "Club de nuit MEN", "category": "Perfumes", "type": "cosmetics", "price_tzs": 150000, "stock": 67},
    {"name": "Feragamo Uomo", "category": "Perfumes", "type": "cosmetics", "price_tzs": 220000, "stock": 12},
    {"name": "Tom Ford Noir", "category": "Perfumes", "type": "cosmetics", "price_tzs": 380000, "stock": 8},
    {"name": "Versace Eros", "category": "Perfumes", "type": "cosmetics", "price_tzs": 260000, "stock": 16},
    {"name": "Dior Sauvage", "category": "Perfumes", "type": "cosmetics", "price_tzs": 320000, "stock": 10},
    {"name": "YSL Y Eau De Parfum", "category": "Perfumes", "type": "cosmetics", "price_tzs": 300000, "stock": 9},
    {"name": "Baccarat Rouge", "category": "Perfumes", "type": "cosmetics", "price_tzs": 480000, "stock": 5},
    {"name": "Armani Code", "category": "Perfumes", "type": "cosmetics", "price_tzs": 250000, "stock": 11},
    {"name": "Hugo Boss Bottled", "category": "Perfumes", "type": "cosmetics", "price_tzs": 210000, "stock": 15},
    {"name": "Paco Rabanne 1 Million", "category": "Perfumes", "type": "cosmetics", "price_tzs": 275000, "stock": 13},
    {"name": "Bleu de Chanel", "category": "Perfumes", "type": "cosmetics", "price_tzs": 360000, "stock": 7},
    {"name": "Afnan 9PM", "category": "Perfumes", "type": "cosmetics", "price_tzs": 190000, "stock": 22},
    {"name": "Lattafa Asad", "category": "Perfumes", "type": "cosmetics", "price_tzs": 165000, "stock": 18},
    {"name": "Maison Alhambra Toscano", "category": "Perfumes", "type": "cosmetics", "price_tzs": 170000, "stock": 19},
]


def slugify(value: str) -> str:
    return "-".join(value.lower().replace("&", " and ").split())


async def get_or_create_category(session, name: str, category_type: str) -> Category:
    slug = slugify(name)
    result = await session.execute(select(Category).where(Category.slug == slug))
    category = result.scalar_one_or_none()
    if category:
        return category

    category = Category(name=name, slug=slug, type=category_type)
    session.add(category)
    await session.flush()
    return category


async def sku_exists(session, sku: str) -> bool:
    result = await session.execute(select(ProductVariant.id).where(ProductVariant.sku == sku))
    return result.scalar_one_or_none() is not None


async def create_unique_sku(session, base_sku: str) -> str:
    sku = base_sku
    suffix = 1
    while await sku_exists(session, sku):
        suffix += 1
        sku = f"{base_sku}-{suffix}"
    return sku


async def seed_products() -> None:
    created = 0
    skipped = 0

    async with AsyncSessionLocal() as session:
        for item in SAMPLE_PRODUCTS:
            category = await get_or_create_category(session, item["category"], item["type"])

            existing = await session.execute(
                select(Product).where(
                    Product.name == item["name"],
                    Product.category_id == category.id,
                )
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            product = Product(
                name=item["name"],
                category_id=category.id,
                description="Long-lasting oud fragrance",
                price=Decimal(str(item["price_tzs"])),
                image_url=None,
                low_stock_threshold=5,
                is_active=True,
            )
            session.add(product)
            await session.flush()

            base_sku = slugify(item["name"]).upper().replace("-", "")[:8] + f"-{product.id}"
            sku = await create_unique_sku(session, base_sku)

            session.add(
                ProductVariant(
                    product_id=product.id,
                    size="50ml",
                    color=None,
                    sku=sku,
                    stock_qty=item["stock"],
                )
            )
            created += 1

        await session.commit()

    print(f"Product seed complete: created={created}, skipped={skipped}, total_input={len(SAMPLE_PRODUCTS)}")


if __name__ == "__main__":
    asyncio.run(seed_products())
