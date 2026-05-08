import random
import string
from datetime import datetime

def _sku_candidate() -> str:
    date_part = datetime.now().strftime("%Y%m%d")
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"SKU-{date_part}-{suffix}"

async def generate_unique_sku(_db=None, max_attempts: int = 1) -> str:
    return _sku_candidate()
