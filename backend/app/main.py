from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import categories, products, customers, sales, orders, preorders, dashboard

app = FastAPI(title="Retail Management System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
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
