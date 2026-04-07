from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.audit_log import AuditLog
from ..models.user import User
from ..schemas.auth import UserCreate, UserOut, UserUpdate
from ..utils.deps import require_admin
from ..utils.security import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


async def add_audit_log(
    db: AsyncSession,
    *,
    actor_user_id: int | None,
    action: str,
    target_id: int | None,
    description: str,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            target_type="user",
            target_id=target_id,
            description=description,
        )
    )


@router.get("/", response_model=list[UserOut])
async def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    role: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    q: str | None = Query(default=None, description="Search username/email/full name"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            or_(
                User.username.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like),
            )
        )

    query = query.offset(skip).limit(limit).order_by(User.username)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    existing = await db.execute(
        select(User).where((User.username == payload.username) | (User.email == payload.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already taken")

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()

    await add_audit_log(
        db,
        actor_user_id=current_admin.id,
        action="create_user",
        target_id=user.id,
        description=f"Created user '{user.username}' with role '{user.role}'",
    )

    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    changes = payload.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(user, field, value)

    if changes:
        changed_keys = ", ".join(changes.keys())
        await add_audit_log(
            db,
            actor_user_id=current_admin.id,
            action="update_user",
            target_id=user.id,
            description=f"Updated user '{user.username}' fields: {changed_keys}",
        )

    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def admin_reset_password(
    user_id: int,
    new_password: str = Query(..., min_length=8),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(new_password)

    await add_audit_log(
        db,
        actor_user_id=current_admin.id,
        action="reset_user_password",
        target_id=user.id,
        description=f"Reset password for user '{user.username}'",
    )

    await db.commit()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    username = user.username
    await db.delete(user)

    await add_audit_log(
        db,
        actor_user_id=current_admin.id,
        action="delete_user",
        target_id=user_id,
        description=f"Deleted user '{username}'",
    )

    await db.commit()
