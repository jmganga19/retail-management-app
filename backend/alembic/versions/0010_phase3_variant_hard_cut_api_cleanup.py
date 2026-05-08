"""phase3 variant hard cut api cleanup scaffold

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This revision is intentionally a no-op.
    # Phase 3 removes variant exposure from API/contracts while internal
    # product_variants rows are still used by stock/sales/order/preorder FKs.
    #
    # A future physical schema cut should:
    # 1) add product_id-based columns to dependent item tables,
    # 2) backfill from product_variants.product_id,
    # 3) migrate reads/writes to product_id columns,
    # 4) drop variant_id FKs and product_variants table.
    pass


def downgrade() -> None:
    pass
