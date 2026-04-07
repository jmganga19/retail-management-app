from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit_log import AuditLog


async def create_audit_log(
    db: AsyncSession,
    *,
    actor_user_id: int | None,
    action: str,
    target_type: str,
    target_id: int | None,
    description: str,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            description=description,
        )
    )
