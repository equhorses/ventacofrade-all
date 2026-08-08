"""add password auth fields to users

Revision ID: a9dbe6a8a480
Revises: 996a0957a885
Create Date: 2026-08-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9dbe6a8a480'
down_revision: Union[str, Sequence[str], None] = '996a0957a885'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'users' not in inspector.get_table_names():
        # Table may not exist yet if this is a brand new database;
        # create_all() will handle it with the new column already included.
        return

    existing_columns = {col['name'] for col in inspector.get_columns('users')}
    if 'password_hash' not in existing_columns:
        op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=True))

    existing_indexes = {idx['name'] for idx in inspector.get_indexes('users')}
    if 'ix_users_email' not in existing_indexes:
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_column('users', 'password_hash')
