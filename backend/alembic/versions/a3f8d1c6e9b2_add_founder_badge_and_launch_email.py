"""add is_founder to seller_profiles and launch_email_sent_at to waitlist

Revision ID: a3f8d1c6e9b2
Revises: b6d2e8f4a1c7
Create Date: 2026-08-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f8d1c6e9b2'
down_revision: Union[str, Sequence[str], None] = 'b6d2e8f4a1c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'seller_profiles' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('seller_profiles')}
        if 'is_founder' not in existing_columns:
            op.add_column(
                'seller_profiles',
                sa.Column('is_founder', sa.Boolean(), nullable=True, server_default='false'),
            )

    if 'waitlist' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('waitlist')}
        if 'launch_email_sent_at' not in existing_columns:
            op.add_column(
                'waitlist',
                sa.Column('launch_email_sent_at', sa.DateTime(timezone=True), nullable=True),
            )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('waitlist', 'launch_email_sent_at')
    op.drop_column('seller_profiles', 'is_founder')
