"""add plan and cancel_at_period_end to seller_profiles

Revision ID: f4c8d1e6a9b2
Revises: e1a4b7c9d2f3
Create Date: 2026-08-18 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4c8d1e6a9b2'
down_revision: Union[str, Sequence[str], None] = 'e1a4b7c9d2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'seller_profiles' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('seller_profiles')}

    if 'plan' not in existing_columns:
        op.add_column('seller_profiles', sa.Column('plan', sa.String(length=20), nullable=True))

    if 'cancel_at_period_end' not in existing_columns:
        op.add_column(
            'seller_profiles',
            sa.Column('cancel_at_period_end', sa.Boolean(), nullable=True, server_default='false'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('seller_profiles', 'cancel_at_period_end')
    op.drop_column('seller_profiles', 'plan')
