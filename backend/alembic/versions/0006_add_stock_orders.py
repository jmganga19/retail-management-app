"""add stock orders tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_number", sa.String(length=50), nullable=False, unique=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("total_purchase", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_potential_sales", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_profit", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_stock_orders_order_number", "stock_orders", ["order_number"], unique=True)

    op.create_table(
        "stock_order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_order_id", sa.Integer(), sa.ForeignKey("stock_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", sa.Integer(), sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("buying_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("selling_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("purchase_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_selling_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("profit_amount", sa.Numeric(12, 2), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("stock_order_items")
    op.drop_index("idx_stock_orders_order_number", table_name="stock_orders")
    op.drop_table("stock_orders")
