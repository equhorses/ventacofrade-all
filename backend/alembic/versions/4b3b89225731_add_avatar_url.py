"""add avatar_url to users

Revision ID: 4b3b89225731
Revises: a9dbe6a8a480
Create Date: 2026-08-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b3b89225731'
down_revision: Union[str, Sequence[str], None] = 'a9dbe6a8a480'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'users' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('users')}
    if 'avatar_url' not in existing_columns:
        op.add_column('users', sa.Column('avatar_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'avatar_url')
