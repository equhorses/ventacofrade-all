"""add reviews table

Revision ID: c4f7a2d9e6b3
Revises: b7d2e5f8a1c4
Create Date: 2026-08-21 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4f7a2d9e6b3'
down_revision: Union[str, Sequence[str], None] = 'b7d2e5f8a1c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'reviews' not in inspector.get_table_names():
        op.create_table(
            'reviews',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('seller_profile_id', sa.Integer(), nullable=False, index=True),
            sa.Column('reviewer_user_id', sa.String(), nullable=False),
            sa.Column('rating', sa.Integer(), nullable=False),
            sa.Column('comment', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint('seller_profile_id', 'reviewer_user_id', name='uq_review_seller_reviewer'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('reviews')
