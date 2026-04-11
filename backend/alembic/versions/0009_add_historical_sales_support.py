"""add historical sales support

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-11
"""

from alembic import op
import sqlalchemy as sa


revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("is_historical", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.add_column("sale_items", sa.Column("product_name_snapshot", sa.String(length=200), nullable=True))
    op.add_column("sale_items", sa.Column("sku_snapshot", sa.String(length=100), nullable=True))
    op.alter_column("sale_items", "variant_id", existing_type=sa.Integer(), nullable=True)

    op.execute(
        """
        UPDATE sale_items si
        SET product_name_snapshot = p.name,
            sku_snapshot = pv.sku
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE si.variant_id = pv.id
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM sale_items WHERE variant_id IS NULL")
    op.alter_column("sale_items", "variant_id", existing_type=sa.Integer(), nullable=False)

    op.drop_column("sale_items", "sku_snapshot")
    op.drop_column("sale_items", "product_name_snapshot")
    op.drop_column("sales", "is_historical")
