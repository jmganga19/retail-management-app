"""link orders to sales for conversion tracking

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("sale_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_orders_sale_id_sales",
        "orders",
        "sales",
        ["sale_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("idx_orders_sale_id", "orders", ["sale_id"])


def downgrade() -> None:
    op.drop_index("idx_orders_sale_id", table_name="orders")
    op.drop_constraint("fk_orders_sale_id_sales", "orders", type_="foreignkey")
    op.drop_column("orders", "sale_id")
