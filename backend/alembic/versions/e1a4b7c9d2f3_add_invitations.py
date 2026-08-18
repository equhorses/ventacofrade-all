"""add free_access_until and invitations table

Revision ID: e1a4b7c9d2f3
Revises: c7e2f9a1b3d4
Create Date: 2026-08-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a4b7c9d2f3'
down_revision: Union[str, Sequence[str], None] = 'c7e2f9a1b3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'seller_profiles' in existing_tables:
        existing_columns = {col['name'] for col in inspector.get_columns('seller_profiles')}
        if 'free_access_until' not in existing_columns:
            op.add_column(
                'seller_profiles',
                sa.Column('free_access_until', sa.DateTime(timezone=True), nullable=True),
            )

    if 'invitations' not in existing_tables:
        op.create_table(
            'invitations',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False, index=True),
            sa.Column('token', sa.String(length=64), nullable=False, unique=True, index=True),
            sa.Column('months', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
            sa.Column('invited_by', sa.String(), nullable=True),
            sa.Column('redeemed_by_user_id', sa.String(), nullable=True),
            sa.Column('redeemed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('invitations')
    op.drop_column('seller_profiles', 'free_access_until')
