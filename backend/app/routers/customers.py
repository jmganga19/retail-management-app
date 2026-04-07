from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Customer
from ..schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from ..utils.deps import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[CustomerOut])
async def list_customers(
    name: str | None = Query(default=None),
    phone: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(Customer)
    if name:
        q = q.where(Customer.name.ilike(f"%{name}%"))
    if phone:
        q = q.where(Customer.phone.ilike(f"%{phone}%"))
    q = q.offset(skip).limit(limit).order_by(Customer.name)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(payload: CustomerCreate, db: AsyncSession = Depends(get_db)):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: int, payload: CustomerUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(customer, field, value)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.delete(customer)
    await db.commit()
