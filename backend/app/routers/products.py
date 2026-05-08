from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Product, User
from ..schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from ..utils.deps import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/products", tags=["Products"], dependencies=[Depends(get_current_user)])


@router.get("/low-stock", response_model=list[ProductOut])
async def low_stock_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .where(Product.is_active == True)
        .where(Product.stock_qty <= Product.low_stock_threshold)
    )
    return result.scalars().unique().all()


@router.get("/", response_model=list[ProductOut])
async def list_products(
    category_id: int | None = Query(default=None),
    name: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(Product)
    if category_id is not None:
        q = q.where(Product.category_id == category_id)
    if name:
        q = q.where(Product.name.ilike(f"%{name}%"))
    if is_active is not None:
        q = q.where(Product.is_active == is_active)
    q = q.offset(skip).limit(limit).order_by(Product.name)
    result = await db.execute(q)
    return result.scalars().unique().all()


@router.post("/", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    normalized_name = payload.name.strip().lower()
    existing_result = await db.execute(select(Product).where(func.lower(Product.name) == normalized_name))
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product name '{payload.name}' already exists",
        )

    data = payload.model_dump(exclude_none=True)
    product = Product(**data)
    product.current_selling_price = product.price
    db.add(product)

    await db.commit()
    await db.refresh(product)

    result = await db.execute(select(Product).where(Product.id == product.id))
    return result.scalar_one()


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    patch = payload.model_dump(exclude_none=True)
    if "name" in patch:
        normalized_name = str(patch["name"]).strip().lower()
        existing_result = await db.execute(
            select(Product).where(func.lower(Product.name) == normalized_name, Product.id != product_id)
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product name '{patch['name']}' already exists",
            )
    for field, value in patch.items():
        setattr(product, field, value)
    await db.commit()

    result = await db.execute(select(Product).where(Product.id == product_id))
    return result.scalar_one()


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    await db.commit()
