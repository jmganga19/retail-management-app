"""expand stock orders for pending/received flow and new product lines

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stock_orders", sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"))
    op.add_column("stock_orders", sa.Column("received_at", sa.TIMESTAMP(timezone=True), nullable=True))

    op.add_column("stock_order_items", sa.Column("category_id", sa.Integer(), nullable=True))
    op.add_column("stock_order_items", sa.Column("item_name", sa.String(length=255), nullable=True))
    op.add_column("stock_order_items", sa.Column("variant_size", sa.String(length=50), nullable=True))
    op.add_column("stock_order_items", sa.Column("variant_color", sa.String(length=50), nullable=True))
    op.add_column("stock_order_items", sa.Column("variant_sku", sa.String(length=100), nullable=True))
    op.create_foreign_key("fk_stock_order_items_category", "stock_order_items", "categories", ["category_id"], ["id"])

    op.alter_column("stock_order_items", "variant_id", existing_type=sa.Integer(), nullable=True)

    op.execute(
        """
        UPDATE stock_order_items soi
        SET item_name = p.name,
            category_id = p.category_id,
            variant_size = pv.size,
            variant_color = pv.color,
            variant_sku = pv.sku
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE soi.variant_id = pv.id
        """
    )
    op.alter_column("stock_order_items", "item_name", existing_type=sa.String(length=255), nullable=False)

    op.execute("UPDATE stock_orders SET status = 'received', received_at = created_at")


def downgrade() -> None:
    op.alter_column("stock_order_items", "variant_id", existing_type=sa.Integer(), nullable=False)
    op.drop_constraint("fk_stock_order_items_category", "stock_order_items", type_="foreignkey")
    op.drop_column("stock_order_items", "variant_sku")
    op.drop_column("stock_order_items", "variant_color")
    op.drop_column("stock_order_items", "variant_size")
    op.drop_column("stock_order_items", "item_name")
    op.drop_column("stock_order_items", "category_id")

    op.drop_column("stock_orders", "received_at")
    op.drop_column("stock_orders", "status")
