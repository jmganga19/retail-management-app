from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None
    actor_username: str | None = None
    action: str
    target_type: str
    target_id: int | None
    description: str | None
    created_at: datetime
