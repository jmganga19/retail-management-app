import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Category, SystemSetting, User
from ..utils.deps import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/category-types", tags=["Category Types"], dependencies=[Depends(get_current_user)])

CATEGORY_TYPES_KEY = "category_types"
DEFAULT_TYPES = ["cosmetics", "clothes", "shoes"]


class CategoryTypePayload(BaseModel):
    name: str


def _normalize(name: str) -> str:
    return name.strip().lower()


async def _load_types(db: AsyncSession) -> list[str]:
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == CATEGORY_TYPES_KEY))
    row = result.scalar_one_or_none()
    if not row:
        return DEFAULT_TYPES.copy()
    try:
        data = json.loads(row.value)
        if not isinstance(data, list):
            return DEFAULT_TYPES.copy()
        cleaned = []
        for item in data:
            if isinstance(item, str):
                v = _normalize(item)
                if v and v not in cleaned:
                    cleaned.append(v)
        return cleaned or DEFAULT_TYPES.copy()
    except Exception:
        return DEFAULT_TYPES.copy()


async def _save_types(db: AsyncSession, types: list[str]) -> None:
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == CATEGORY_TYPES_KEY))
    row = result.scalar_one_or_none()
    serialized = json.dumps(types)
    if row:
        row.value = serialized
    else:
        db.add(SystemSetting(key=CATEGORY_TYPES_KEY, value=serialized))


def _resolve_existing(types: list[str], requested: str) -> str | None:
    needle = _normalize(requested)
    for t in types:
        if _normalize(t) == needle:
            return t
    return None


@router.get("/", response_model=list[str])
async def list_category_types(db: AsyncSession = Depends(get_db)):
    return await _load_types(db)


@router.post("/", response_model=list[str], status_code=status.HTTP_201_CREATED)
async def create_category_type(
    payload: CategoryTypePayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    types = await _load_types(db)
    new_value = _normalize(payload.name)
    if not new_value:
        raise HTTPException(status_code=400, detail="Type name is required")
    if _resolve_existing(types, new_value):
        raise HTTPException(status_code=409, detail="Type already exists")

    types.append(new_value)
    await _save_types(db, types)
    await db.commit()
    return types


@router.put("/{type_name}", response_model=list[str])
async def rename_category_type(
    type_name: str,
    payload: CategoryTypePayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    types = await _load_types(db)
    existing = _resolve_existing(types, type_name)
    if not existing:
        raise HTTPException(status_code=404, detail="Type not found")

    new_value = _normalize(payload.name)
    if not new_value:
        raise HTTPException(status_code=400, detail="Type name is required")

    duplicate = _resolve_existing(types, new_value)
    if duplicate and duplicate != existing:
        raise HTTPException(status_code=409, detail="Type already exists")

    updated_types = [new_value if t == existing else t for t in types]

    category_result = await db.execute(select(Category).where(func.lower(Category.type) == _normalize(existing)))
    categories = category_result.scalars().all()
    for c in categories:
        c.type = new_value

    await _save_types(db, updated_types)
    await db.commit()
    return updated_types


@router.delete("/{type_name}", response_model=list[str])
async def delete_category_type(
    type_name: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
):
    types = await _load_types(db)
    existing = _resolve_existing(types, type_name)
    if not existing:
        raise HTTPException(status_code=404, detail="Type not found")

    in_use_count = await db.scalar(select(func.count(Category.id)).where(func.lower(Category.type) == _normalize(existing)))
    if (in_use_count or 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete type that is used by categories")

    updated_types = [t for t in types if t != existing]
    if not updated_types:
        raise HTTPException(status_code=400, detail="At least one type must remain")

    await _save_types(db, updated_types)
    await db.commit()
    return updated_types
