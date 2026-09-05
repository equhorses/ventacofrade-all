"""add invite_email_sent_at to invitations

Revision ID: b1e5f8a3d6c9
Revises: d4b8e1f6c3a9
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1e5f8a3d6c9'
down_revision: Union[str, Sequence[str], None] = 'd4b8e1f6c3a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'invitations' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('invitations')}
        if 'invite_email_sent_at' not in existing_columns:
            op.add_column(
                'invitations',
                sa.Column('invite_email_sent_at', sa.DateTime(timezone=True), nullable=True),
            )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'invitations' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('invitations')}
        if 'invite_email_sent_at' in existing_columns:
            op.drop_column('invitations', 'invite_email_sent_at')
