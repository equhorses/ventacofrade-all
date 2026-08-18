"""add free_listing_used to seller_profiles

Revision ID: c7e2f9a1b3d4
Revises: a1b2c3d4e5f6
Create Date: 2026-08-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e2f9a1b3d4'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'seller_profiles' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('seller_profiles')}
    if 'free_listing_used' not in existing_columns:
        op.add_column(
            'seller_profiles',
            sa.Column('free_listing_used', sa.Boolean(), nullable=True, server_default='false'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('seller_profiles', 'free_listing_used')
