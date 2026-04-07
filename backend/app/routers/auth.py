from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.user import User
from ..schemas.auth import (
    BootstrapAdminCreate,
    BootstrapStatus,
    PasswordChange,
    Token,
    UserOut,
)
from ..utils.deps import get_current_user
from ..utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/bootstrap-status", response_model=BootstrapStatus)
async def bootstrap_status(db: AsyncSession = Depends(get_db)):
    user_count = await db.scalar(select(func.count(User.id)))
    return BootstrapStatus(bootstrap_required=(user_count or 0) == 0)


@router.post("/bootstrap-admin", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def bootstrap_admin(payload: BootstrapAdminCreate, db: AsyncSession = Depends(get_db)):
    user_count = await db.scalar(select(func.count(User.id)))
    if (user_count or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bootstrap already completed",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role="admin",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    token = create_access_token(subject=user.id, role=user.role)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_own_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
