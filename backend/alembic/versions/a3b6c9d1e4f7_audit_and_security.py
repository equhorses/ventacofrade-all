"""add audit_log and login_attempts tables

Revision ID: a3b6c9d1e4f7
Revises: f4c8d1e6a9b2
Create Date: 2026-08-18 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b6c9d1e4f7'
down_revision: Union[str, Sequence[str], None] = 'f4c8d1e6a9b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'audit_log' not in existing_tables:
        op.create_table(
            'audit_log',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('actor_id', sa.String(), nullable=True),
            sa.Column('actor_email', sa.String(length=255), nullable=True),
            sa.Column('action', sa.String(length=100), nullable=False),
            sa.Column('target', sa.String(length=255), nullable=True),
            sa.Column('details', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    if 'login_attempts' not in existing_tables:
        op.create_table(
            'login_attempts',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False, index=True),
            sa.Column('method', sa.String(length=20), nullable=False),
            sa.Column('success', sa.Boolean(), nullable=False),
            sa.Column('reason', sa.String(length=255), nullable=True),
            sa.Column('ip_address', sa.String(length=64), nullable=True),
            sa.Column('user_agent', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('login_attempts')
    op.drop_table('audit_log')
