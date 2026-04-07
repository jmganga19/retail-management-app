from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.system_setting import SystemSetting
from ..models.user import User
from ..schemas.settings import AppSettingsOut, AppSettingsUpdate
from ..utils.deps import get_current_user, require_admin

router = APIRouter(prefix="/settings", tags=["Settings"])

DEFAULTS = {
    "app_name": "RetailPro",
    "currency_code": "TZS",
    "business_phone": "",
}


async def _settings_map(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(SystemSetting))
    items = result.scalars().all()
    data = {row.key: row.value for row in items}
    for key, value in DEFAULTS.items():
        data.setdefault(key, value)
    return data


async def _upsert_setting(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=key, value=value))


@router.get("/public", response_model=AppSettingsOut)
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    data = await _settings_map(db)
    return AppSettingsOut(
        app_name=data["app_name"],
        currency_code=data["currency_code"],
        business_phone=data["business_phone"] or None,
    )


@router.get("/", response_model=AppSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = await _settings_map(db)
    return AppSettingsOut(
        app_name=data["app_name"],
        currency_code=data["currency_code"],
        business_phone=data["business_phone"] or None,
    )


@router.put("/", response_model=AppSettingsOut)
async def update_settings(
    payload: AppSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    await _upsert_setting(db, "app_name", payload.app_name.strip())
    await _upsert_setting(db, "currency_code", payload.currency_code.strip().upper())
    await _upsert_setting(db, "business_phone", (payload.business_phone or "").strip())
    await db.commit()

    data = await _settings_map(db)
    return AppSettingsOut(
        app_name=data["app_name"],
        currency_code=data["currency_code"],
        business_phone=data["business_phone"] or None,
    )
