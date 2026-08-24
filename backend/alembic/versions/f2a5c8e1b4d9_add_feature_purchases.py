"""add feature_purchases table

Revision ID: f2a5c8e1b4d9
Revises: e9b3d6f1a4c7
Create Date: 2026-08-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a5c8e1b4d9'
down_revision: Union[str, Sequence[str], None] = 'e9b3d6f1a4c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'feature_purchases' not in inspector.get_table_names():
        op.create_table(
            'feature_purchases',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=False, index=True),
            sa.Column('seller_user_id', sa.String(), nullable=False, index=True),
            sa.Column('days', sa.Integer(), nullable=False),
            sa.Column('amount_cents', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('feature_purchases')
