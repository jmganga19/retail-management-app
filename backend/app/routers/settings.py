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
    "pricing_update_policy": "manual",
    "low_margin_warning_percent": "10",
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


def _to_out(data: dict[str, str]) -> AppSettingsOut:
    policy = (data.get("pricing_update_policy") or "manual").strip().lower()
    if policy not in {"manual", "latest_received"}:
        policy = "manual"

    try:
        low_margin = float(data.get("low_margin_warning_percent") or "10")
    except ValueError:
        low_margin = 10.0

    return AppSettingsOut(
        app_name=data["app_name"],
        currency_code=data["currency_code"],
        business_phone=data["business_phone"] or None,
        pricing_update_policy=policy,
        low_margin_warning_percent=low_margin,
    )


@router.get("/public", response_model=AppSettingsOut)
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    data = await _settings_map(db)
    return _to_out(data)


@router.get("/", response_model=AppSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = await _settings_map(db)
    return _to_out(data)


@router.put("/", response_model=AppSettingsOut)
async def update_settings(
    payload: AppSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    await _upsert_setting(db, "app_name", payload.app_name.strip())
    await _upsert_setting(db, "currency_code", payload.currency_code.strip().upper())
    await _upsert_setting(db, "business_phone", (payload.business_phone or "").strip())
    await _upsert_setting(db, "pricing_update_policy", payload.pricing_update_policy)
    await _upsert_setting(db, "low_margin_warning_percent", str(payload.low_margin_warning_percent))
    await db.commit()

    data = await _settings_map(db)
    return _to_out(data)
