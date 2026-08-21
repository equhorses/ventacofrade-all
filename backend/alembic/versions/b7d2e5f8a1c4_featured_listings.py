"""add featured_until to products

Revision ID: b7d2e5f8a1c4
Revises: a3b6c9d1e4f7
Create Date: 2026-08-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d2e5f8a1c4'
down_revision: Union[str, Sequence[str], None] = 'a3b6c9d1e4f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'products' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('products')}
    if 'featured_until' not in existing_columns:
        op.add_column(
            'products',
            sa.Column('featured_until', sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('products', 'featured_until')
