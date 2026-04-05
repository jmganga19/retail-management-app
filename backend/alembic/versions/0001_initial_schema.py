"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-05
"""

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- categories ---
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # --- products ---
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("image_url", sa.String(500)),
        sa.Column("low_stock_threshold", sa.Integer(), server_default="5"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_products_category_id", "products", ["category_id"])
    op.create_index("idx_products_is_active", "products", ["is_active"])

    # --- product_variants ---
    op.create_table(
        "product_variants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("size", sa.String(50)),
        sa.Column("color", sa.String(50)),
        sa.Column("sku", sa.String(100), unique=True),
        sa.Column("stock_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_product_variants_product_id", "product_variants", ["product_id"])
    op.create_index("idx_product_variants_stock_qty", "product_variants", ["stock_qty"])

    # --- customers ---
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(30)),
        sa.Column("email", sa.String(255)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # --- sales ---
    op.create_table(
        "sales",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sale_number", sa.String(50), nullable=False, unique=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="SET NULL")),
        sa.Column("payment_method", sa.String(20), nullable=False),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("discount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("sold_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_sales_sold_at", "sales", ["sold_at"])
    op.create_index("idx_sales_customer_id", "sales", ["customer_id"])

    # --- sale_items ---
    op.create_table(
        "sale_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sale_id", sa.Integer(), sa.ForeignKey("sales.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", sa.Integer(), sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
    )
    op.create_index("idx_sale_items_sale_id", "sale_items", ["sale_id"])

    # --- orders ---
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_number", sa.String(50), nullable=False, unique=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("discount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_orders_status", "orders", ["status"])
    op.create_index("idx_orders_customer_id", "orders", ["customer_id"])

    # --- order_items ---
    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", sa.Integer(), sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
    )

    # --- preorders ---
    op.create_table(
        "preorders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("preorder_number", sa.String(50), nullable=False, unique=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("expected_arrival_date", sa.Date()),
        sa.Column("deposit_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "balance_due",
            sa.Numeric(12, 2),
            sa.Computed("total_amount - deposit_amount", persisted=True),
        ),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_preorders_status", "preorders", ["status"])
    op.create_index("idx_preorders_expected_arrival", "preorders", ["expected_arrival_date"])

    # --- preorder_items ---
    op.create_table(
        "preorder_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("preorder_id", sa.Integer(), sa.ForeignKey("preorders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", sa.Integer(), sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("preorder_items")
    op.drop_table("preorders")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("sale_items")
    op.drop_table("sales")
    op.drop_table("customers")
    op.drop_table("product_variants")
    op.drop_table("products")
    op.drop_table("categories")
