import random
import string
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ProductVariant


def _sku_candidate() -> str:
    date_part = datetime.now().strftime("%Y%m%d")
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"SKU-{date_part}-{suffix}"


async def generate_unique_sku(db: AsyncSession, max_attempts: int = 50) -> str:
    for _ in range(max_attempts):
        sku = _sku_candidate()
        exists = await db.scalar(select(ProductVariant.id).where(ProductVariant.sku == sku))
        if exists is None:
            return sku
    raise RuntimeError("Failed to generate unique SKU after multiple attempts")
