"""add launch campaign reminder tracking columns

Revision ID: c3f6a9d2e5b8
Revises: b1e5f8a3d6c9
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f6a9d2e5b8'
down_revision: Union[str, Sequence[str], None] = 'b1e5f8a3d6c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'invitations' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('invitations')}
        if 'catalog_reminder_sent_at' not in existing_columns:
            op.add_column(
                'invitations',
                sa.Column('catalog_reminder_sent_at', sa.DateTime(timezone=True), nullable=True),
            )
        if 'activation_reminder_sent_at' not in existing_columns:
            op.add_column(
                'invitations',
                sa.Column('activation_reminder_sent_at', sa.DateTime(timezone=True), nullable=True),
            )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'invitations' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('invitations')}
        if 'activation_reminder_sent_at' in existing_columns:
            op.drop_column('invitations', 'activation_reminder_sent_at')
        if 'catalog_reminder_sent_at' in existing_columns:
            op.drop_column('invitations', 'catalog_reminder_sent_at')
