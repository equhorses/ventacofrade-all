"""add stripe columns to seller_profiles

Revision ID: ab560de10505
Revises: 4b3b89225731
Create Date: 2026-08-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ab560de10505'
down_revision: Union[str, Sequence[str], None] = '4b3b89225731'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'seller_profiles' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('seller_profiles')}
    if 'stripe_customer_id' not in existing_columns:
        op.add_column('seller_profiles', sa.Column('stripe_customer_id', sa.String(length=100), nullable=True))
    if 'stripe_subscription_id' not in existing_columns:
        op.add_column('seller_profiles', sa.Column('stripe_subscription_id', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('seller_profiles', 'stripe_subscription_id')
    op.drop_column('seller_profiles', 'stripe_customer_id')
