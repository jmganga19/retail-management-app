"""enforce unique product name case-insensitive

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    duplicates = conn.execute(
        sa.text(
            """
            SELECT lower(name) AS normalized_name, count(*) AS cnt
            FROM products
            GROUP BY lower(name)
            HAVING count(*) > 1
            ORDER BY cnt DESC, normalized_name
            LIMIT 5
            """
        )
    ).fetchall()
    if duplicates:
        sample = ", ".join([f"{row.normalized_name} ({row.cnt})" for row in duplicates])
        raise RuntimeError(
            "Cannot enforce unique product names: duplicate names exist (case-insensitive). "
            f"Examples: {sample}. Resolve duplicates first, then rerun migration."
        )

    op.create_index(
        "uq_products_name_lower",
        "products",
        [sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_products_name_lower", table_name="products")

