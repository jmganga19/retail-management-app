from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.audit_log import AuditLog
from ..models.user import User
from ..schemas.audit_log import AuditLogOut
from ..utils.deps import require_admin

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("/", response_model=list[AuditLogOut])
async def list_audit_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    action: str | None = Query(default=None),
    target_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = (
        select(AuditLog, User.username)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .order_by(desc(AuditLog.created_at))
        .offset(skip)
        .limit(limit)
    )

    if action:
        q = q.where(AuditLog.action == action)
    if target_type:
        q = q.where(AuditLog.target_type == target_type)

    result = await db.execute(q)
    rows = result.all()

    return [
        AuditLogOut(
            id=log.id,
            actor_user_id=log.actor_user_id,
            actor_username=username,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            description=log.description,
            created_at=log.created_at,
        )
        for log, username in rows
    ]
