"""add house_ads table

Revision ID: d8a1c4f7b2e5
Revises: c4f7a2d9e6b3
Create Date: 2026-08-21 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8a1c4f7b2e5'
down_revision: Union[str, Sequence[str], None] = 'c4f7a2d9e6b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'house_ads' not in inspector.get_table_names():
        op.create_table(
            'house_ads',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('slot', sa.String(length=50), nullable=False, unique=True, index=True),
            sa.Column('title', sa.String(length=200), nullable=False),
            sa.Column('image_url', sa.String(), nullable=False),
            sa.Column('link_url', sa.String(), nullable=False),
            sa.Column('active', sa.Boolean(), nullable=True, default=True, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('house_ads')
