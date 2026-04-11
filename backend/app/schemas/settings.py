from typing import Literal

from pydantic import BaseModel, Field


class AppSettingsOut(BaseModel):
    app_name: str
    currency_code: str
    business_phone: str | None = None
    pricing_update_policy: Literal["manual", "latest_received"]
    low_margin_warning_percent: float


class AppSettingsUpdate(BaseModel):
    app_name: str = Field(min_length=2, max_length=100)
    currency_code: str = Field(min_length=3, max_length=10)
    business_phone: str | None = Field(default=None, max_length=30)
    pricing_update_policy: Literal["manual", "latest_received"] = "manual"
    low_margin_warning_percent: float = Field(default=10, ge=0, le=1000)
