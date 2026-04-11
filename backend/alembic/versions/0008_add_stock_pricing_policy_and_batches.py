"""add stock pricing policy tracking and receipt batches

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product_variants", sa.Column("last_buying_price", sa.Numeric(12, 2), nullable=True))
    op.add_column("product_variants", sa.Column("average_buying_price", sa.Numeric(12, 2), nullable=True))
    op.add_column("product_variants", sa.Column("current_selling_price", sa.Numeric(12, 2), nullable=True))

    op.execute(
        """
        UPDATE product_variants pv
        SET current_selling_price = p.price
        FROM products p
        WHERE pv.product_id = p.id
        """
    )

    op.create_table(
        "stock_receipt_batches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=False),
        sa.Column("stock_order_id", sa.Integer(), nullable=True),
        sa.Column("stock_order_item_id", sa.Integer(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("buying_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("suggested_selling_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("applied_selling_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("margin_percent", sa.Numeric(7, 2), nullable=True),
        sa.Column("received_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"]),
        sa.ForeignKeyConstraint(["stock_order_id"], ["stock_orders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["stock_order_item_id"], ["stock_order_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("stock_receipt_batches")

    op.drop_column("product_variants", "current_selling_price")
    op.drop_column("product_variants", "average_buying_price")
    op.drop_column("product_variants", "last_buying_price")
