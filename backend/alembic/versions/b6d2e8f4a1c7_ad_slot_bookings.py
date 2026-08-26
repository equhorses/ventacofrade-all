"""ad slot self-service: pricing config + advertiser bookings

Revision ID: b6d2e8f4a1c7
Revises: a5c1f7b3d9e2
Create Date: 2026-08-25 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6d2e8f4a1c7'
down_revision: Union[str, Sequence[str], None] = 'a5c1f7b3d9e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Keep in sync with routers/house_ads.py KNOWN_SLOTS.
KNOWN_SLOTS = ["home_top", "explorar_top"]
DEFAULT_PRICE_CENTS = 4999  # 49.99€/mes — starting default, editable from the admin panel


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'ad_slot_configs' not in inspector.get_table_names():
        op.create_table(
            'ad_slot_configs',
            sa.Column('slot', sa.String(length=50), primary_key=True, nullable=False),
            sa.Column('price_cents', sa.Integer(), nullable=False, server_default=str(DEFAULT_PRICE_CENTS)),
            sa.Column('self_service_enabled', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        )
        ad_slot_configs = sa.table(
            'ad_slot_configs',
            sa.column('slot', sa.String),
            sa.column('price_cents', sa.Integer),
            sa.column('self_service_enabled', sa.Boolean),
        )
        op.bulk_insert(
            ad_slot_configs,
            [{'slot': slot, 'price_cents': DEFAULT_PRICE_CENTS, 'self_service_enabled': True} for slot in KNOWN_SLOTS],
        )

    if 'ad_bookings' not in inspector.get_table_names():
        op.create_table(
            'ad_bookings',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('slot', sa.String(length=50), nullable=False, index=True),
            sa.Column('user_id', sa.String(), nullable=False, index=True),
            sa.Column('advertiser_name', sa.String(length=200), nullable=False),
            sa.Column('advertiser_email', sa.String(length=255), nullable=False),
            sa.Column('title', sa.String(length=200), nullable=False),
            sa.Column('image_url', sa.String(), nullable=False),
            sa.Column('link_url', sa.String(), nullable=False),
            sa.Column('amount_cents', sa.Integer(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending_payment'),
            sa.Column('stripe_session_id', sa.String(length=200), nullable=True),
            sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('approved_by', sa.String(), nullable=True),
            sa.Column('rejected_reason', sa.String(), nullable=True),
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'ad_bookings' in inspector.get_table_names():
        op.drop_table('ad_bookings')
    if 'ad_slot_configs' in inspector.get_table_names():
        op.drop_table('ad_slot_configs')
