from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .database import engine
from .routers import (
    audit_logs,
    auth,
    categories,
    category_types,
    customers,
    dashboard,
    orders,
    preorders,
    products,
    sales,
    settings as app_settings,
    users,
)

app = FastAPI(title="Retail Management System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(audit_logs.router, prefix=PREFIX)
app.include_router(app_settings.router, prefix=PREFIX)
app.include_router(category_types.router, prefix=PREFIX)
app.include_router(categories.router, prefix=PREFIX)
app.include_router(products.router, prefix=PREFIX)
app.include_router(customers.router, prefix=PREFIX)
app.include_router(sales.router, prefix=PREFIX)
app.include_router(orders.router, prefix=PREFIX)
app.include_router(preorders.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)


@app.get("/")
async def root():
    return {"message": "Retail Management System API"}


@app.get("/healthz")
async def healthz():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        return {"status": "degraded", "database": "error"}
