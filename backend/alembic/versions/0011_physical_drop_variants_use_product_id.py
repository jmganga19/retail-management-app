"""physical drop variants and use product_id

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("stock_qty", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("products", sa.Column("last_buying_price", sa.Numeric(12, 2), nullable=True))
    op.add_column("products", sa.Column("average_buying_price", sa.Numeric(12, 2), nullable=True))
    op.add_column("products", sa.Column("current_selling_price", sa.Numeric(12, 2), nullable=True))

    op.execute(
        """
        UPDATE products p
        SET stock_qty = COALESCE(v.total_stock, 0)
        FROM (
            SELECT product_id, SUM(stock_qty)::int AS total_stock
            FROM product_variants
            GROUP BY product_id
        ) v
        WHERE v.product_id = p.id
        """
    )
    op.execute(
        """
        UPDATE products p
        SET
            last_buying_price = v.last_buying_price,
            average_buying_price = v.average_buying_price,
            current_selling_price = COALESCE(v.current_selling_price, p.price)
        FROM (
            SELECT DISTINCT ON (product_id)
                product_id, last_buying_price, average_buying_price, current_selling_price
            FROM product_variants
            ORDER BY product_id, id ASC
        ) v
        WHERE v.product_id = p.id
        """
    )
    op.execute("UPDATE products SET current_selling_price = price WHERE current_selling_price IS NULL")

    op.add_column("sale_items", sa.Column("product_id", sa.Integer(), nullable=True))
    op.add_column("order_items", sa.Column("product_id", sa.Integer(), nullable=True))
    op.add_column("preorder_items", sa.Column("product_id", sa.Integer(), nullable=True))
    op.add_column("stock_order_items", sa.Column("product_id", sa.Integer(), nullable=True))
    op.add_column("stock_receipt_batches", sa.Column("product_id", sa.Integer(), nullable=True))

    op.execute(
        """
        UPDATE sale_items si
        SET product_id = pv.product_id
        FROM product_variants pv
        WHERE si.variant_id = pv.id
        """
    )
    op.execute(
        """
        UPDATE order_items oi
        SET product_id = pv.product_id
        FROM product_variants pv
        WHERE oi.variant_id = pv.id
        """
    )
    op.execute(
        """
        UPDATE preorder_items pi
        SET product_id = pv.product_id
        FROM product_variants pv
        WHERE pi.variant_id = pv.id
        """
    )
    op.execute(
        """
        UPDATE stock_order_items soi
        SET product_id = pv.product_id
        FROM product_variants pv
        WHERE soi.variant_id = pv.id
        """
    )
    op.execute(
        """
        UPDATE stock_receipt_batches srb
        SET product_id = pv.product_id
        FROM product_variants pv
        WHERE srb.variant_id = pv.id
        """
    )

    op.create_foreign_key("fk_sale_items_product_id_products", "sale_items", "products", ["product_id"], ["id"])
    op.create_foreign_key("fk_order_items_product_id_products", "order_items", "products", ["product_id"], ["id"])
    op.create_foreign_key("fk_preorder_items_product_id_products", "preorder_items", "products", ["product_id"], ["id"])
    op.create_foreign_key("fk_stock_order_items_product_id_products", "stock_order_items", "products", ["product_id"], ["id"])
    op.create_foreign_key("fk_stock_receipt_batches_product_id_products", "stock_receipt_batches", "products", ["product_id"], ["id"])

    op.alter_column("order_items", "product_id", nullable=False)
    op.alter_column("preorder_items", "product_id", nullable=False)
    op.alter_column("stock_receipt_batches", "product_id", nullable=False)

    op.drop_column("sale_items", "variant_id")
    op.drop_column("order_items", "variant_id")
    op.drop_column("preorder_items", "variant_id")
    op.drop_column("stock_order_items", "variant_id")
    op.drop_column("stock_order_items", "variant_size")
    op.drop_column("stock_order_items", "variant_color")
    op.drop_column("stock_order_items", "variant_sku")
    op.drop_column("stock_receipt_batches", "variant_id")

    op.drop_table("product_variants")


def downgrade() -> None:
    raise RuntimeError("Downgrade not supported for physical variant removal migration")
