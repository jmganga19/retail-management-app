from pydantic import BaseModel, Field


class AppSettingsOut(BaseModel):
    app_name: str
    currency_code: str
    business_phone: str | None = None


class AppSettingsUpdate(BaseModel):
    app_name: str = Field(min_length=2, max_length=100)
    currency_code: str = Field(min_length=3, max_length=10)
    business_phone: str | None = Field(default=None, max_length=30)
