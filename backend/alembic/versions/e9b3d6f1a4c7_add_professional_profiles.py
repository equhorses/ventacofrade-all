"""add professional_profiles table

Revision ID: e9b3d6f1a4c7
Revises: d8a1c4f7b2e5
Create Date: 2026-08-22 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9b3d6f1a4c7'
down_revision: Union[str, Sequence[str], None] = 'd8a1c4f7b2e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'professional_profiles' not in inspector.get_table_names():
        op.create_table(
            'professional_profiles',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('user_id', sa.String(), nullable=False, index=True),
            sa.Column('business_name', sa.String(length=200), nullable=False),
            sa.Column('specialty', sa.String(length=100), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('province', sa.String(length=100), nullable=False),
            sa.Column('city', sa.String(length=100), nullable=True),
            sa.Column('phone', sa.String(length=20), nullable=True),
            sa.Column('whatsapp', sa.String(length=20), nullable=True),
            sa.Column('portfolio_images', sa.Text(), nullable=True),
            # Free for now (activation_paid always true / no paywall enforced yet),
            # but the column exists already so a future paid activation is a small
            # change, not a schema migration.
            sa.Column('activation_paid', sa.Boolean(), nullable=True, default=True, server_default='true'),
            sa.Column('is_active', sa.Boolean(), nullable=True, default=True, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('professional_profiles')
