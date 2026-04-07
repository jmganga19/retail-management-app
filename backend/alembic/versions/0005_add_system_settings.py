"""add system settings table

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=100), nullable=False, unique=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_system_settings_key", "system_settings", ["key"], unique=True)


def downgrade() -> None:
    op.drop_index("idx_system_settings_key", table_name="system_settings")
    op.drop_table("system_settings")
