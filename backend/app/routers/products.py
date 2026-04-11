from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Product, ProductVariant, User
from ..schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    VariantCreate,
    VariantOut,
    VariantUpdate,
)
from ..services.audit_service import create_audit_log
from ..utils.deps import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/products", tags=["Products"], dependencies=[Depends(get_current_user)])


@router.get("/low-stock", response_model=list[ProductOut])
async def low_stock_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.is_active == True)
        .where(
            Product.id.in_(
                select(ProductVariant.product_id).where(
                    ProductVariant.stock_qty <= Product.low_stock_threshold
                )
            )
        )
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
    q = select(Product).options(selectinload(Product.variants))
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
    data = payload.model_dump(exclude={"variants"})
    product = Product(**data)
    db.add(product)
    await db.flush()

    for v in payload.variants:
        variant = ProductVariant(product_id=product.id, current_selling_price=product.price, **v.model_dump())
        db.add(variant)

    if not payload.variants:
        db.add(ProductVariant(product_id=product.id, current_selling_price=product.price))

    await db.commit()
    await db.refresh(product)

    result = await db.execute(
        select(Product).options(selectinload(Product.variants)).where(Product.id == product.id)
    )
    return result.scalar_one()


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product).options(selectinload(Product.variants)).where(Product.id == product_id)
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
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    await db.commit()

    result = await db.execute(
        select(Product).options(selectinload(Product.variants)).where(Product.id == product_id)
    )
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


@router.post("/{product_id}/variants", response_model=VariantOut, status_code=status.HTTP_201_CREATED)
async def add_variant(
    product_id: int,
    payload: VariantCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    variant = ProductVariant(product_id=product_id, current_selling_price=product.price, **payload.model_dump())
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.patch("/{product_id}/variants/{variant_id}", response_model=VariantOut)
async def update_variant(
    product_id: int,
    variant_id: int,
    payload: VariantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.id == variant_id, ProductVariant.product_id == product_id
        )
    )
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    before_qty = variant.stock_qty
    changes = payload.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(variant, field, value)

    if "stock_qty" in changes and changes["stock_qty"] != before_qty:
        after_qty = variant.stock_qty
        delta = after_qty - before_qty
        sign = "+" if delta >= 0 else ""
        await create_audit_log(
            db,
            actor_user_id=current_user.id,
            action="stock_adjust_manual",
            target_type="product_variant",
            target_id=variant.id,
            description=f"Manual stock adjustment: qty {sign}{delta} (before={before_qty}, after={after_qty})",
        )

    await db.commit()
    await db.refresh(variant)
    return variant


@router.delete("/{product_id}/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variant(
    product_id: int,
    variant_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.id == variant_id, ProductVariant.product_id == product_id
        )
    )
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    await db.delete(variant)
    await db.commit()
