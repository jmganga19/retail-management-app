from datetime import date, timezone, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def generate_number(db: AsyncSession, model, number_field: str, prefix: str) -> str:
    """Generate a sequential number like SAL-20260405-0001."""
    today = date.today()
    date_str = today.strftime("%Y%m%d")
    like_pattern = f"{prefix}-{date_str}-%"

    field = getattr(model, number_field)
    result = await db.execute(
        select(func.count()).where(field.like(like_pattern))
    )
    count = result.scalar() or 0
    seq = str(count + 1).zfill(4)
    return f"{prefix}-{date_str}-{seq}"
