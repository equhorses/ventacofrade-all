"""add account status and deletion fields to users

Revision ID: f1a2b3c4d5e6
Revises: ab560de10505
Create Date: 2026-08-16 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'ab560de10505'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'users' not in inspector.get_table_names():
        return
    existing_columns = {col['name'] for col in inspector.get_columns('users')}

    if 'account_status' not in existing_columns:
        op.add_column(
            'users',
            sa.Column('account_status', sa.String(length=20), nullable=False, server_default='active'),
        )
    if 'deletion_reasons' not in existing_columns:
        op.add_column('users', sa.Column('deletion_reasons', sa.String(length=500), nullable=True))
    if 'deletion_feedback' not in existing_columns:
        op.add_column('users', sa.Column('deletion_feedback', sa.Text(), nullable=True))
    if 'suspended_at' not in existing_columns:
        op.add_column('users', sa.Column('suspended_at', sa.DateTime(timezone=True), nullable=True))
    if 'deletion_requested_at' not in existing_columns:
        op.add_column('users', sa.Column('deletion_requested_at', sa.DateTime(timezone=True), nullable=True))
    if 'scheduled_purge_at' not in existing_columns:
        op.add_column('users', sa.Column('scheduled_purge_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'scheduled_purge_at')
    op.drop_column('users', 'deletion_requested_at')
    op.drop_column('users', 'suspended_at')
    op.drop_column('users', 'deletion_feedback')
    op.drop_column('users', 'deletion_reasons')
    op.drop_column('users', 'account_status')
