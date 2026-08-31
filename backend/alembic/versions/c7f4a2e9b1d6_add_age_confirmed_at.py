"""add age_confirmed_at to users

Revision ID: c7f4a2e9b1d6
Revises: a3f8d1c6e9b2
Create Date: 2026-08-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7f4a2e9b1d6'
down_revision: Union[str, Sequence[str], None] = 'a3f8d1c6e9b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'users' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('users')}
        if 'age_confirmed_at' not in existing_columns:
            op.add_column(
                'users',
                sa.Column('age_confirmed_at', sa.DateTime(timezone=True), nullable=True),
            )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'users' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('users')}
        if 'age_confirmed_at' in existing_columns:
            op.drop_column('users', 'age_confirmed_at')
